import { searchProducts } from '../../clients/productClient';
import { SearchProductsInput, SearchProductsResult } from '../../types';

export async function search_products(
  input: SearchProductsInput
): Promise<SearchProductsResult> {
  const search = typeof input?.search === 'string' ? input.search.trim() : '';
  const category = typeof input?.category === 'string' ? input.category.trim() : '';
  const minPrice = typeof input?.minPrice === 'number' ? input.minPrice : undefined;
  const maxPrice = typeof input?.maxPrice === 'number' ? input.maxPrice : undefined;
  const limit = typeof input?.limit === 'number' ? input.limit : undefined;

  if (!search && !category && minPrice == null && maxPrice == null) {
    return {
      success: false,
      products: [],
      error: 'Provide at least one of search, category, minPrice, or maxPrice',
    };
  }

  try {
    const products = await searchProducts({
      search: search || undefined,
      category: category || undefined,
      minPrice,
      maxPrice,
      limit,
    });

    return {
      success: true,
      products,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search products';

    return {
      success: false,
      products: [],
      error: message,
    };
  }
}
