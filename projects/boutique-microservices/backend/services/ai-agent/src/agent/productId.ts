/** Canonical catalog product id: UUID as returned by product-service / search_products. */
export const PRODUCT_ID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isCanonicalProductId(value: string): boolean {
  return PRODUCT_ID_PATTERN.test(value);
}

export function invalidProductIdError(productId: string): string {
  return (
    `Invalid productId "${productId}": productId must be the exact UUID returned by ` +
    'search_products or get_product (8-4-4-4-12 hex). Do not invent ids or derive them from product names.'
  );
}
