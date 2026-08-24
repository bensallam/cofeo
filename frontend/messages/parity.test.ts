import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";
import ar from "./ar.json";

/**
 * Guards the exact key-parity discipline established across Phase 4A
 * (orderStatus), 4B (OrderStatusEmail), and 4C (OrderTimeline) — three
 * locale catalogs that must always declare the identical set of keys,
 * never just the identical top-level namespaces. A future addition to
 * one file without its siblings would silently fall back to next-intl's
 * default-locale behavior at runtime rather than fail loudly; this
 * test is what fails loudly instead, at build/test time.
 */
function collectKeys(value: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (typeof value !== "object" || value === null) return keys;
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === "object" && nested !== null) {
      for (const nestedKey of collectKeys(nested, path)) keys.add(nestedKey);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

describe("i18n key parity (fr/en/ar)", () => {
  it("declare exactly the same set of keys", () => {
    const frKeys = [...collectKeys(fr)].sort();
    const enKeys = [...collectKeys(en)].sort();
    const arKeys = [...collectKeys(ar)].sort();

    expect(enKeys).toEqual(frKeys);
    expect(arKeys).toEqual(frKeys);
  });

  it("Phase 4C: OrderTimeline correction keys exist in all three locales", () => {
    for (const messages of [fr, en, ar] as const) {
      expect(messages.OrderTimeline.correctionHeading.length).toBeGreaterThan(0);
      expect(messages.OrderTimeline.correctionNotice).toContain("{fromLabel}");
      expect(messages.OrderTimeline.correctionNotice).toContain("{toLabel}");
      expect(messages.OrderTimeline.correctionNotice).toContain("{fromDate}");
      expect(messages.OrderTimeline.correctionNotice).toContain("{toDate}");
    }
  });
});
