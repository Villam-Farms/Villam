import { getListingVisuals } from "@/lib/listing-visuals";

describe("listing visuals", () => {
  test.each([
    ["Leafy Greens", "leaf-outline"], ["Fresh Fruit", "sunny-outline"], ["Herbs", "flower-outline"],
    ["Root Vegetables", "nutrition-outline"], ["Eggs & Dairy", "sunny-outline"], ["unknown", "leaf-outline"], [null, "leaf-outline"],
  ])("maps %s to %s", (category, icon) => expect(getListingVisuals(category).icon).toBe(icon));
  test("normalizes whitespace and casing", () => expect(getListingVisuals("  BERRIES ")).toEqual(getListingVisuals("berries")));
  test("returns complete color tokens", () => expect(getListingVisuals("fruit")).toEqual(expect.objectContaining({ color: expect.stringMatching(/^#/), badgeColor: expect.stringMatching(/^#/), badgeTextColor: expect.stringMatching(/^#/), farmDotColor: expect.stringMatching(/^#/) })));
});
