import { getMockFarmProfile } from "@/lib/mock-farms";

describe("mock farm profiles", () => {
  test("returns known seeded profiles", () => expect(getMockFarmProfile("1").title).toBe("Golden Hour Farm"));
  test("uses live farm data for unknown ids", () => expect(getMockFarmProfile("unknown", { id: "x", name: "My Farm", products: "Apples, Pears", rating: 4.2, reviews: 3, latitude: 0, longitude: 0 }).produce).toEqual(["Apples", "Pears"]));
  test("provides useful fallback listings", () => expect(getMockFarmProfile("unknown").produceListings.length).toBeGreaterThan(0));
  test("provides reviews for every profile", () => expect(getMockFarmProfile("2").reviewEntries.every((review) => review.rating > 0)).toBe(true));
});
