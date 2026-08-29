import { updateOrderStatus } from '../../clients/orderClient';
import { CancelOrderInput, CancelOrderResult } from '../../types';

export async function cancel_order(input: CancelOrderInput): Promise<CancelOrderResult> {
  const id = typeof input?.id === 'string' ? input.id.trim() : '';

  if (!id) {
    return {
      success: false,
      error: 'id is required',
    };
  }

  try {
    const order = await updateOrderStatus(id, 'cancelled');

    return {
      success: true,
      order,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel order';

    return {
      success: false,
      error: message,
    };
  }
}
