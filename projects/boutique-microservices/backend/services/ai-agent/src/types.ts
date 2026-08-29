export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponseData {
  reply: string;
  products: ProductSummary[];
}

export interface ProductSummary {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
}

export interface ProductSearchParams {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface SearchProductsInput {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface SearchProductsResult {
  success: boolean;
  products: ProductSummary[];
  error?: string;
}

export interface GetProductInput {
  id: string;
}

export interface GetProductResult {
  success: boolean;
  product?: ProductSummary;
  error?: string;
}

export interface ProductInventory {
  id: string;
  name: string;
  inventoryQuantity: number;
}

export interface GetInventoryInput {
  id: string;
}

export interface GetInventoryResult {
  success: boolean;
  inventory?: ProductInventory;
  error?: string;
}

export interface OrderAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  userId: string;
  items: CreateOrderItemInput[];
  shippingAddress: OrderAddress;
}

export interface CreateOrderResult {
  success: boolean;
  order?: any;
  error?: string;
  code?: 'INVALID_PRODUCT_ID';
  invalidProductId?: string;
}

export interface CancelOrderInput {
  id: string;
}

export interface CancelOrderResult {
  success: boolean;
  order?: any;
  error?: string;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
