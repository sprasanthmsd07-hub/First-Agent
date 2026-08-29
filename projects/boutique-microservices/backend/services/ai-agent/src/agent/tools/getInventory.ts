import { getProductInventory } from '../../clients/productClient';
import { GetInventoryInput, GetInventoryResult } from '../../types';
import { invalidProductIdError, isCanonicalProductId } from '../productId';

export async function get_inventory(input: GetInventoryInput): Promise<GetInventoryResult> {
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
    const inventory = await getProductInventory(id);

    return {
      success: true,
      inventory,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get inventory';

    return {
      success: false,
      error: message,
    };
  }
}
