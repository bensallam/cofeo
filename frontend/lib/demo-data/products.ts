/**
 * DEMO DATA — not real inventory. Every entry here is fictional and
 * exists only so the Homepage has something realistic to render before
 * a live WooCommerce catalogue exists (Phase 5/6). Never treat this as
 * production data; never wire it to a real order or cart flow.
 *
 * Field shape intentionally mirrors only the *public* product fields
 * from the COFEO data model — no purchase_price, margin, supplier info,
 * or other private fields belong here even as fake values.
 */

export type DemoProduct = {
  isDemo: true;
  id: string;
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  condition: "new" | "excellent" | "very-good" | "good";
  coffeeSystem: "capsules" | "ground" | "beans";
  available: boolean;
  warranty: boolean;
  badgeKey?: "used" | "refurbished";
};

export const DEMO_FEATURED_PRODUCTS: DemoProduct[] = [
  {
    isDemo: true,
    id: "demo-delonghi-magnifica-s",
    brand: "De'Longhi",
    name: "Magnifica S",
    price: 4990,
    condition: "new",
    coffeeSystem: "beans",
    available: true,
    warranty: true,
  },
  {
    isDemo: true,
    id: "demo-nespresso-vertuo-next",
    brand: "Nespresso",
    name: "Vertuo Next",
    price: 899,
    originalPrice: 1249,
    condition: "excellent",
    coffeeSystem: "capsules",
    available: true,
    warranty: true,
    badgeKey: "used",
  },
  {
    isDemo: true,
    id: "demo-krups-evidence",
    brand: "Krups",
    name: "Evidence",
    price: 2490,
    condition: "very-good",
    coffeeSystem: "beans",
    available: true,
    warranty: true,
    badgeKey: "refurbished",
  },
  {
    isDemo: true,
    id: "demo-jura-ena-8",
    brand: "Jura",
    name: "ENA 8",
    price: 6490,
    condition: "new",
    coffeeSystem: "beans",
    available: true,
    warranty: true,
  },
] as const;

/** Text-only, per the brand approval — no official logos used yet (licensing not confirmed). */
export const DEMO_BRANDS = ["Nespresso", "De'Longhi", "Krups", "Jura"] as const;
