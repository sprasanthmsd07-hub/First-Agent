import axios, { AxiosError } from 'axios';
import { ProductInventory, ProductSearchParams, ProductSummary } from '../types';

const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3003';
const DEFAULT_LIMIT = 8;

function mapProduct(row: any): ProductSummary | null {
  if (!row || typeof row !== 'object' || row.id == null || !row.name) {
    return null;
  }

  const price = typeof row.price === 'number' ? row.price : parseFloat(row.price);

  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    price: Number.isFinite(price) ? price : 0,
    category: row.category ? String(row.category) : undefined,
    brand: row.brand ? String(row.brand) : undefined,
    imageUrl: row.image_url ? String(row.image_url) : undefined,
  };
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSummary[]> {
  const url = `${PRODUCTS_SERVICE_URL}/`;
  const query: Record<string, string | number> = {
    limit: params.limit && params.limit > 0 ? params.limit : DEFAULT_LIMIT,
  };

  if (params.search) {
    query.search = params.search;
  }
  if (params.category) {
    query.category = params.category;
  }
  if (typeof params.minPrice === 'number' && Number.isFinite(params.minPrice)) {
    query.minPrice = params.minPrice;
  }
  if (typeof params.maxPrice === 'number' && Number.isFinite(params.maxPrice)) {
    query.maxPrice = params.maxPrice;
  }

  try {
    const response = await axios.get(url, {
      params: query,
      timeout: 10000,
    });

    const body = response.data;

    if (!body || body.success !== true || !body.data || !Array.isArray(body.data.products)) {
      throw new Error('Product service returned an invalid search response');
    }

    return body.data.products
      .map(mapProduct)
      .filter((product: ProductSummary | null): product is ProductSummary => product !== null);
  } catch (error) {
    throw translateClientError(error, 'search');
  }
}

export async function getProductById(id: string): Promise<ProductSummary> {
  try {
    const row = await fetchProductRow(id);
    const product = mapProduct(row);
    if (!product) {
      throw new Error('Product service returned an invalid product response');
    }
    return product;
  } catch (error) {
    throw translateClientError(error, 'get');
  }
}

export async function getProductInventory(id: string): Promise<ProductInventory> {
  try {
    const row = await fetchProductRow(id);
    const quantityRaw = row.inventory_quantity;
    const inventoryQuantity =
      typeof quantityRaw === 'number' ? quantityRaw : parseInt(String(quantityRaw), 10);

    if (row.id == null || !row.name) {
      throw new Error('Product service returned an invalid product response');
    }

    return {
      id: String(row.id),
      name: String(row.name),
      inventoryQuantity: Number.isFinite(inventoryQuantity) ? inventoryQuantity : 0,
    };
  } catch (error) {
    throw translateClientError(error, 'get');
  }
}

async function fetchProductRow(id: string): Promise<any> {
  const url = `${PRODUCTS_SERVICE_URL}/${encodeURIComponent(id)}`;
  const response = await axios.get(url, { timeout: 10000 });
  const body = response.data;

  if (!body || body.success !== true || !body.data) {
    throw new Error('Product service returned an invalid product response');
  }

  return body.data;
}

function translateClientError(error: unknown, action: 'search' | 'get'): Error {
  const verb = action === 'search' ? 'search' : 'get product';

  if (error instanceof AxiosError) {
    const status = error.response?.status;
    const remoteError = error.response?.data?.error;

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new Error(`Product service is unreachable at ${PRODUCTS_SERVICE_URL}`);
    }

    if (error.code === 'ECONNABORTED') {
      return new Error('Product service request timed out');
    }

    if (status === 404) {
      return new Error(remoteError || 'Product not found');
    }

    if (status) {
      return new Error(
        remoteError
          ? `Product service ${verb} failed (${status}): ${remoteError}`
          : `Product service ${verb} failed with status ${status}`
      );
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(`Product service ${verb} failed`);
}
