import OpenAI from 'openai';
import {
  CancelOrderInput,
  ChatMessage,
  CreateOrderInput,
  GetInventoryInput,
  GetProductInput,
  ProductSummary,
  SearchProductsInput,
} from '../types';
import { search_products } from './tools/searchProducts';
import { get_product } from './tools/getProduct';
import { get_inventory } from './tools/getInventory';
import { create_order } from './tools/createOrder';
import { cancel_order } from './tools/cancelOrder';
import {
  aiAgentLlmDurationSeconds,
  aiAgentLlmRequestsTotal,
  aiAgentToolCallsTotal,
  aiAgentToolErrorsTotal,
} from '../metrics';

const MAX_TOOL_TURNS = 5;

const INSTRUMENTED_TOOLS = new Set([
  'search_products',
  'get_product',
  'get_inventory',
  'create_order',
  'cancel_order',
]);

const CATALOG_CATEGORIES = ['Dresses', 'Accessories', 'Bags', 'Outerwear', 'Shoes'] as const;

const SYSTEM_PROMPT = `You are a shopping assistant for a luxury boutique store.
Do not invent products. Only describe items returned by tools.

When to use tools:
- search_products: when the user wants to find, search, or browse products, or asks for products matching criteria. Use this first if you do not yet have a product id.
- get_product: when the user wants detailed information about one specific product and a product id is available (from the user or from a previous search_products result).
- get_inventory: when the user asks whether a product is in stock or how many units are available, and a product id is available.
- create_order: only when the user clearly asks to place an order AND provides userId, line items (productId + quantity), and a full shipping address. Do not guess missing fields. Do not create an order from a vague question.
- cancel_order: only when the user clearly asks to cancel a specific order AND provides the order id. Do not guess an id.

There is no get-order-by-id API. If the user asks for order status by id and you have no other supported tool, say you cannot look up a single order by id.

Never invent product IDs. Never turn a product name into a fake id (for example product_id_for_silk_evening_gown).
When search_products or get_product returns a product, copy the exact id field into get_product, get_inventory, and create_order. That id is the only valid product identifier.
If you do not have a real product id from a tool result or the user, do not call create_order, get_product, or get_inventory.

If the user asks to find a product and then wants details, call search_products first, then get_product with the exact id from that result.
If they ask about availability after a search, call get_inventory with that same id.

How to fill search_products:
- search: a single distinctive substring for name/description (material or product name fragment). Do not send full sentences or stacked phrases like "silk dresses".
- category: only an exact catalog category when the user is asking for that group.
- Catalog categories: ${CATALOG_CATEGORIES.join(', ')}. If the user asks for a type that is not one of these, put it in search instead of inventing a category.
- minPrice / maxPrice: only when the user states a numeric amount. Do not invent a price for words like expensive, cheap, or luxury.

If a tool returns no products, say so clearly.
Keep answers concise and helpful.`;

const SEARCH_PRODUCTS_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_products',
    description:
      'Use when the user wants to find, search, or browse products, or asks for products matching criteria. Read-only catalog search via GET /. Each result includes a canonical `id` UUID. Later tools must use that exact `id`; never invent one. search is a simple substring. category must match a catalog category exactly.',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Substring match against product name and description. Use one keyword such as silk, gown, cashmere, or jewelry.',
        },
        category: {
          type: 'string',
          enum: [...CATALOG_CATEGORIES],
          description: 'Exact catalog category filter.',
        },
        minPrice: {
          type: 'number',
          description: 'Minimum price. Set only when the user gives a numeric lower bound.',
        },
        maxPrice: {
          type: 'number',
          description: 'Maximum price. Set only when the user gives a numeric upper bound.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of products to return. Defaults to 8.',
        },
      },
    },
  },
};

const GET_PRODUCT_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_product',
    description:
      'Use when the user wants detailed information about one specific product and a product ID is available. Read-only lookup via GET /:id. Do not guess an id; use one returned by search_products or provided by the user.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Exact product UUID from search_products (field `id`) or provided by the user. Never invent or derive from the product name.',
        },
      },
      required: ['id'],
    },
  },
};

const GET_INVENTORY_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_inventory',
    description:
      'Use when the user asks about stock or availability for one product and a product ID is available. Read-only. Uses product-service GET /:id and returns inventory_quantity. Do not guess an id.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Exact product UUID from search_products (field `id`) or provided by the user. Never invent or derive from the product name.',
        },
      },
      required: ['id'],
    },
  },
};

const CREATE_ORDER_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'create_order',
    description:
      'Use only when the user explicitly asks to place an order and has provided userId, items, and a complete shipping address. Each item.productId must be the exact UUID from search_products or get_product (`id`). Never invent product IDs or derive them from names. If no real product id is available, do not call this tool. Do not invent customer, quantity, or address values. Calls orders POST /.',
    parameters: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'Existing customer user id. Required. Do not invent one.',
        },
        items: {
          type: 'array',
          description: 'Line items to order.',
          items: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                description:
                  'Canonical product UUID from search_products/get_product field `id`. Must match 8-4-4-4-12 hex. Never invent or use a product name.',
                pattern:
                  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
              },
              quantity: { type: 'number', description: 'Quantity greater than 0.' },
            },
            required: ['productId', 'quantity'],
          },
        },
        shippingAddress: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            zipCode: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['street', 'city', 'state', 'zipCode', 'country'],
        },
      },
      required: ['userId', 'items', 'shippingAddress'],
    },
  },
};

const CANCEL_ORDER_TOOL: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'cancel_order',
    description:
      'Use only when the user explicitly asks to cancel a specific order and provides the order id. Calls orders PATCH /:id/status with status cancelled. Do not guess the id.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The order id to cancel.',
        },
      },
      required: ['id'],
    },
  },
};

export class AgentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentConfigError';
  }
}

export interface AgentResult {
  reply: string;
  products: ProductSummary[];
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new AgentConfigError(
      'OPENAI_API_KEY is not set. Add it to the environment (for example in a .env file) before calling POST /chat.'
    );
  }

  return new OpenAI({ apiKey });
}

function toOpenAIMessages(history: ChatMessage[], message: string): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  for (const item of history) {
    if (item.role !== 'user' && item.role !== 'assistant') {
      continue;
    }
    if (typeof item.content !== 'string' || item.content.trim() === '') {
      continue;
    }
    messages.push({ role: item.role, content: item.content });
  }

  messages.push({ role: 'user', content: message });
  return messages;
}

function extractSearchInput(rawArguments: string): SearchProductsInput {
  try {
    const parsed = JSON.parse(rawArguments) as SearchProductsInput;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : undefined,
      category: typeof parsed.category === 'string' ? parsed.category : undefined,
      minPrice: typeof parsed.minPrice === 'number' ? parsed.minPrice : undefined,
      maxPrice: typeof parsed.maxPrice === 'number' ? parsed.maxPrice : undefined,
      limit: typeof parsed.limit === 'number' ? parsed.limit : undefined,
    };
  } catch {
    return {};
  }
}

function extractGetProductInput(rawArguments: string): GetProductInput {
  try {
    const parsed = JSON.parse(rawArguments) as { id?: unknown };
    return { id: typeof parsed.id === 'string' ? parsed.id : '' };
  } catch {
    return { id: '' };
  }
}

function extractGetInventoryInput(rawArguments: string): GetInventoryInput {
  try {
    const parsed = JSON.parse(rawArguments) as { id?: unknown };
    return { id: typeof parsed.id === 'string' ? parsed.id : '' };
  } catch {
    return { id: '' };
  }
}

function extractCreateOrderInput(rawArguments: string): CreateOrderInput {
  try {
    const parsed = JSON.parse(rawArguments) as CreateOrderInput;
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      shippingAddress: parsed.shippingAddress,
    };
  } catch {
    return {
      userId: '',
      items: [],
      shippingAddress: { street: '', city: '', state: '', zipCode: '', country: '' },
    };
  }
}

function extractCancelOrderInput(rawArguments: string): CancelOrderInput {
  try {
    const parsed = JSON.parse(rawArguments) as { id?: unknown };
    return { id: typeof parsed.id === 'string' ? parsed.id : '' };
  } catch {
    return { id: '' };
  }
}

function recordToolError(tool: string): void {
  if (INSTRUMENTED_TOOLS.has(tool)) {
    aiAgentToolErrorsTotal.inc({ tool });
  }
}

function toolFailed(resultJson: string): boolean {
  try {
    const parsed = JSON.parse(resultJson) as { success?: unknown };
    return parsed.success !== true;
  } catch {
    return true;
  }
}

async function executeToolCall(
  toolCall: OpenAI.Chat.ChatCompletionMessageToolCall
): Promise<{ result: string; products: ProductSummary[] }> {
  if (toolCall.type !== 'function') {
    return {
      result: JSON.stringify({
        success: false,
        error: `Unknown tool: ${toolCall.type}`,
      }),
      products: [],
    };
  }

  const toolName = toolCall.function.name;
  if (INSTRUMENTED_TOOLS.has(toolName)) {
    aiAgentToolCallsTotal.inc({ tool: toolName });
  }

  try {
    const executed = await dispatchToolCall(toolCall);
    if (INSTRUMENTED_TOOLS.has(toolName) && toolFailed(executed.result)) {
      recordToolError(toolName);
    }
    return executed;
  } catch (error) {
    recordToolError(toolName);
    throw error;
  }
}

async function dispatchToolCall(
  toolCall: OpenAI.Chat.ChatCompletionMessageToolCall
): Promise<{ result: string; products: ProductSummary[] }> {
  if (toolCall.type !== 'function') {
    return {
      result: JSON.stringify({
        success: false,
        error: `Unknown tool: ${toolCall.type}`,
      }),
      products: [],
    };
  }

  if (toolCall.function.name === 'search_products') {
    const searchResult = await search_products(extractSearchInput(toolCall.function.arguments));
    return {
      result: JSON.stringify(searchResult),
      products: searchResult.success ? searchResult.products : [],
    };
  }

  if (toolCall.function.name === 'get_product') {
    const getResult = await get_product(extractGetProductInput(toolCall.function.arguments));
    return {
      result: JSON.stringify(getResult),
      products: getResult.success && getResult.product ? [getResult.product] : [],
    };
  }

  if (toolCall.function.name === 'get_inventory') {
    const inventoryResult = await get_inventory(extractGetInventoryInput(toolCall.function.arguments));
    return {
      result: JSON.stringify(inventoryResult),
      products: [],
    };
  }

  if (toolCall.function.name === 'create_order') {
    const createResult = await create_order(extractCreateOrderInput(toolCall.function.arguments));
    return {
      result: JSON.stringify(createResult),
      products: [],
    };
  }

  if (toolCall.function.name === 'cancel_order') {
    const cancelResult = await cancel_order(extractCancelOrderInput(toolCall.function.arguments));
    return {
      result: JSON.stringify(cancelResult),
      products: [],
    };
  }

  return {
    result: JSON.stringify({
      success: false,
      error: `Unknown tool: ${toolCall.function.name}`,
    }),
    products: [],
  };
}

export async function runAgent(
  message: string,
  history: ChatMessage[] = []
): Promise<AgentResult> {
  const client = getClient();
  const model = process.env.LLM_MODEL || 'gpt-4o';
  const messages = toOpenAIMessages(history, message);

  let products: ProductSummary[] = [];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const stopLlmTimer = aiAgentLlmDurationSeconds.startTimer();
    aiAgentLlmRequestsTotal.inc();
    let response: OpenAI.Chat.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model,
        messages,
        tools: [SEARCH_PRODUCTS_TOOL, GET_PRODUCT_TOOL, GET_INVENTORY_TOOL, CREATE_ORDER_TOOL, CANCEL_ORDER_TOOL],
        tool_choice: 'auto',
      });
    } finally {
      stopLlmTimer();
    }

    const choice = response.choices[0]?.message;
    if (!choice) {
      throw new Error('OpenAI returned an empty response');
    }

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      });

      for (const toolCall of choice.tool_calls) {
        const executed = await executeToolCall(toolCall);

        if (executed.products.length > 0) {
          products = executed.products;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: executed.result,
        });
      }

      continue;
    }

    return {
      reply: (choice.content || '').trim() || 'I could not generate a response.',
      products,
    };
  }

  throw new Error('Agent exceeded the maximum number of tool-calling turns');
}
