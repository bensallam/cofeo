import { z } from "zod";

/**
 * Accepts common Moroccan mobile input shapes (local 06/07..., or
 * international +2126/+2127... or 2126/2127...) and normalizes to a
 * single canonical E.164-ish form: +2126XXXXXXXX / +2127XXXXXXXX.
 * Landlines (05) and anything that doesn't reduce to a 9-digit 6/7-
 * prefixed number are rejected. This is the ONLY normalization this
 * app trusts — client-side validation is a UX convenience, this
 * function (called again server-side in the Server Action) is what
 * actually decides what reaches WooCommerce.
 */
export function normalizeMoroccanPhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-().]/g, "");

  let digits: string;
  if (stripped.startsWith("+212")) {
    digits = stripped.slice(4);
  } else if (stripped.startsWith("212")) {
    digits = stripped.slice(3);
  } else if (stripped.startsWith("0")) {
    digits = stripped.slice(1);
  } else {
    digits = stripped;
  }

  if (!/^[67]\d{8}$/.test(digits)) {
    return null;
  }

  return `+212${digits}`;
}

export const moroccanPhoneSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx) => {
    const normalized = normalizeMoroccanPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Invalid Moroccan mobile number" });
      return z.NEVER;
    }
    return normalized;
  });

/**
 * City is validated as a non-empty string here (shape only) — the
 * authoritative check is exact-match against the live backend city
 * list, done server-side in the Server Action, never trusted from the
 * client alone (the same discipline as cart item keys).
 */
/** Shape-only check for the city-triggered shipping preview — the
 * authoritative check is the live exact-match against the backend
 * city list, done server-side in the Server Action. */
export const checkoutCityInputSchema = z.string().trim().min(1).max(200);

/**
 * Optional customer email. Empty/omitted is always valid (this field
 * is not required — see the checkout page's email field) and passes
 * through as `undefined`, never an empty string, so callers can use a
 * simple `??` fallback. A non-empty value must be a real email shape.
 */
export const checkoutEmailSchema = z
  .union([z.literal(""), z.string().trim().max(254).email()])
  .optional()
  .transform((value) => (value ? value : undefined));

export const checkoutAddressInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: checkoutEmailSchema,
  phone: moroccanPhoneSchema,
  city: z.string().trim().min(1).max(200),
  address1: z.string().trim().min(1).max(300),
});

export type CheckoutAddressInput = z.infer<typeof checkoutAddressInputSchema>;

/**
 * Shape-only check for the payment method id — the authoritative
 * check is that it appears in the checkout draft's own live
 * `paymentMethods` list, done server-side, never trusted from the
 * client alone (same discipline as city).
 */
export const placeOrderInputSchema = checkoutAddressInputSchema.extend({
  paymentMethod: z.string().trim().min(1).max(100),
});

export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;

/**
 * Splits a single "full name" field into WooCommerce's native first/
 * last name pair — the last whitespace-separated segment becomes the
 * last name, everything before it the first name. A single-word name
 * becomes first_name only, matching how WooCommerce already treats a
 * missing last name.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return { firstName: trimmed.slice(0, lastSpace), lastName: trimmed.slice(lastSpace + 1) };
}
