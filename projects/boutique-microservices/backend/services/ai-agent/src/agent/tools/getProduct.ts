import { getProductById } from '../../clients/productClient';
import { GetProductInput, GetProductResult } from '../../types';
import { invalidProductIdError, isCanonicalProductId } from '../productId';

export async function get_product(input: GetProductInput): Promise<GetProductResult> {
  const id = typeof input?.id === 'string' ? input.id.trim() : '';

  if (!id) {
    return {
      success: false,
      error: 'id is required',
    };
  }

  if (!isCanonicalProductId(id)) {
    return {
      success: false,
      error: invalidProductIdError(id),
    };
  }

  try {
    const product = await getProductById(id);

    return {
      success: true,
      product,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get product';

    return {
      success: false,
      error: message,
    };
  }
}
