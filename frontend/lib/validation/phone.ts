import { z } from "zod";

/**
 * Moroccan mobile numbers only (brief section 18). Accepts the formats
 * explicitly listed there: 06/07 local, spaced local, and +212 forms.
 * Landline prefixes and other countries are out of scope until the
 * business defines that requirement — see docs/adr for the open
 * question tracked from the Phase 0 audit.
 */
const MOROCCAN_MOBILE_PATTERN = /^(?:\+212|0)([67])(\d{2})(\d{2})(\d{2})(\d{2})$/;

export function normalizeMoroccanPhone(rawInput: string): string | null {
  const digitsAndPlus = rawInput.replace(/[\s.-]/g, "");
  const match = digitsAndPlus.match(MOROCCAN_MOBILE_PATTERN);
  if (!match) return null;

  const [, trunk, p2, p3, p4, p5] = match;
  return `+212${trunk}${p2}${p3}${p4}${p5}`;
}

export const moroccanPhoneSchema = z
  .string()
  .transform((value, ctx) => {
    const normalized = normalizeMoroccanPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "INVALID_PHONE",
      });
      return z.NEVER;
    }
    return normalized;
  });
