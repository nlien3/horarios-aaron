import { describe, expect, it } from "vitest";

import { includesNormalizedText, normalizeSearchText } from "@/lib/utils";

describe("search utils", () => {
  it("normalizes accents and casing", () => {
    expect(normalizeSearchText("  Álvarez ")).toBe("alvarez");
  });

  it("matches search terms without case sensitivity", () => {
    expect(includesNormalizedText("Prof. Soto", "sOtO")).toBe(true);
  });

  it("returns false when there are no matches", () => {
    expect(includesNormalizedText("Lic. Vega", "martinez")).toBe(false);
  });
});
