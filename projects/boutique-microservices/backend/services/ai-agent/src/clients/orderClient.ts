import axios, { AxiosError } from 'axios';
import { CreateOrderInput } from '../types';

const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://localhost:3005';

export async function createOrder(input: CreateOrderInput): Promise<any> {
  const url = `${ORDERS_SERVICE_URL}/`;

  try {
    const response = await axios.post(
      url,
      {
        userId: input.userId,
        items: input.items,
        shippingAddress: input.shippingAddress,
      },
      { timeout: 10000 }
    );

    const body = response.data;
    if (!body || body.success !== true) {
      throw new Error(body?.error || 'Orders service returned an invalid create-order response');
    }

    return body.data;
  } catch (error) {
    throw translateOrderError(error, 'create order');
  }
}

export async function updateOrderStatus(id: string, status: string): Promise<any> {
  const url = `${ORDERS_SERVICE_URL}/${encodeURIComponent(id)}/status`;

  try {
    const response = await axios.patch(url, { status }, { timeout: 10000 });
    const body = response.data;

    if (!body || body.success !== true) {
      throw new Error(body?.error || 'Orders service returned an invalid status-update response');
    }

    return body.data;
  } catch (error) {
    throw translateOrderError(error, 'update order status');
  }
}

function translateOrderError(error: unknown, action: string): Error {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const remoteError = error.response?.data?.error;

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new Error(`Orders service is unreachable at ${ORDERS_SERVICE_URL}`);
    }

    if (error.code === 'ECONNABORTED') {
      return new Error('Orders service request timed out');
    }

    if (status) {
      return new Error(
        remoteError
          ? `Orders service ${action} failed (${status}): ${remoteError}`
          : `Orders service ${action} failed with status ${status}`
      );
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`Orders service ${action} failed`);
}
