import { describe, expect, it } from "vitest";
import { normalizeMoroccanPhone } from "./phone";

describe("normalizeMoroccanPhone", () => {
  it("normalizes local 06 format", () => {
    expect(normalizeMoroccanPhone("0612345678")).toBe("+212612345678");
  });

  it("normalizes local 07 format", () => {
    expect(normalizeMoroccanPhone("0712345678")).toBe("+212712345678");
  });

  it("normalizes spaced local format", () => {
    expect(normalizeMoroccanPhone("06 12 34 56 78")).toBe("+212612345678");
  });

  it("normalizes +212 format", () => {
    expect(normalizeMoroccanPhone("+212612345678")).toBe("+212612345678");
  });

  it("rejects non-Moroccan-mobile input", () => {
    expect(normalizeMoroccanPhone("0512345678")).toBeNull();
    expect(normalizeMoroccanPhone("not a phone")).toBeNull();
  });
});
