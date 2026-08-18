import { buildListingRows, filterListingRows } from "@/lib/listing-browser";
import type { MarketplaceListing } from "@/lib/marketplace";

const listing = (overrides: Partial<MarketplaceListing> = {}): MarketplaceListing => ({
  id: "l1", farmId: "f1", farmName: "Sunny Farm", farmImageUrl: null, latitude: 1, longitude: 1,
  city: "Davis", state: "CA", postal_code: "95616", country: "USA", produceItemId: "p1",
  produceItemName: "Tomato", category: "Vegetables", varietyId: "v1", varietyName: "Roma",
  varietyDescription: "Sweet red tomatoes", price: 3, currency: "USD", soldBy: "lb", available: true, imageUrl: null,
  ...overrides,
});

describe("listing browser", () => {
  const rows = buildListingRows([listing()], null);
  test("formats listing display values", () => expect(rows[0]).toMatchObject({ name: "Tomato", price: "USD 3.00", unit: "Sold by lb" }));
  test.each(["tomato", "vegetables", "sweet", "sunny", "davis", "ca"])("searches across listing fields: %s", (query) => expect(filterListingRows(rows, "All", query)).toHaveLength(1));
  test("search is case insensitive and trimmed", () => expect(filterListingRows(rows, "All", "  TOMATO ")).toHaveLength(1));
  test("category filter excludes other categories", () => expect(filterListingRows(rows, "Fruit", "")).toHaveLength(0));
  test("distance sorting is applied before row creation", () => {
    const result = buildListingRows([listing({ id: "far", farmId: "far", latitude: 3, longitude: 3 }), listing({ id: "near", farmId: "near", latitude: 0.1, longitude: 0.1 })], { latitude: 0, longitude: 0 });
    expect(result.map((x) => x.id)).toEqual(["near", "far"]);
  });
});
