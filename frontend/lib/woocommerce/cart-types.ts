/**
 * Pure data shapes and constants only — no server-only imports
 * (fetch, serverEnv, etc.). Client Components that need `Cart`/
 * `CartItem` or the `EMPTY_CART` fallback must import from HERE, not
 * from lib/woocommerce/cart.ts: that module pulls in config/env.ts's
 * server-only WORDPRESS_API_URL check at module-evaluation time, and
 * importing even one value export from it (e.g. EMPTY_CART) drags the
 * whole module — and that check — into the client bundle, where the
 * env var is undefined and the check throws at runtime.
 */
export type CartItem = {
  key: string;
  productId: number;
  slug: string;
  name: string;
  image?: { src: string; alt: string };
  quantity: number;
  quantityMin: number;
  quantityMax: number;
  unitPrice: number;
  lineSubtotal: number;
  lineTotal: number;
};

export type Cart = {
  items: CartItem[];
  itemsCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  /** null = no shipping rate calculated yet (no/invalid city set). A
   * real 0 means a resolved free rate (default tier or promo), not
   * "unknown" — the two are never conflated. */
  shippingCost: number | null;
  total: number;
  currency: string;
};

export const EMPTY_CART: Cart = {
  items: [],
  itemsCount: 0,
  subtotal: 0,
  discount: 0,
  tax: 0,
  shippingCost: null,
  total: 0,
  currency: "MAD",
};
