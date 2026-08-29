import { createOrder } from '../../clients/orderClient';
import { CreateOrderInput, CreateOrderResult, OrderAddress } from '../../types';
import { invalidProductIdError, isCanonicalProductId } from '../productId';

function isAddress(value: unknown): value is OrderAddress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const address = value as OrderAddress;
  return (
    typeof address.street === 'string' &&
    address.street.trim() !== '' &&
    typeof address.city === 'string' &&
    address.city.trim() !== '' &&
    typeof address.state === 'string' &&
    address.state.trim() !== '' &&
    typeof address.zipCode === 'string' &&
    address.zipCode.trim() !== '' &&
    typeof address.country === 'string' &&
    address.country.trim() !== ''
  );
}

export async function create_order(input: CreateOrderInput): Promise<CreateOrderResult> {
  const userId = typeof input?.userId === 'string' ? input.userId.trim() : '';
  const items = Array.isArray(input?.items) ? input.items : [];
  const shippingAddress = input?.shippingAddress;

  if (!userId) {
    return {
      success: false,
      error: 'userId is required; do not invent a customer id',
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      error: 'items must contain at least one { productId, quantity }',
    };
  }

  for (const item of items) {
    if (typeof item?.productId !== 'string' || item.productId.trim() === '') {
      return {
        success: false,
        error: 'each item requires a productId',
      };
    }

    const productId = item.productId.trim();
    if (!isCanonicalProductId(productId)) {
      return {
        success: false,
        code: 'INVALID_PRODUCT_ID',
        invalidProductId: productId,
        error: invalidProductIdError(productId),
      };
    }

    if (typeof item?.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) {
      return {
        success: false,
        error: 'each item requires a quantity greater than 0',
      };
    }
  }

  if (!isAddress(shippingAddress)) {
    return {
      success: false,
      error: 'shippingAddress requires street, city, state, zipCode, and country',
    };
  }

  try {
    const order = await createOrder({
      userId,
      items: items.map((item) => ({
        productId: item.productId.trim(),
        quantity: item.quantity,
      })),
      shippingAddress,
    });

    return {
      success: true,
      order,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';

    return {
      success: false,
      error: message,
    };
  }
}
