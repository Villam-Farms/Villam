import { addDistanceAndSort, distanceMiles, type FarmWithCoords } from "@/lib/location";

const farm = (id: string, latitude: number, longitude: number): FarmWithCoords => ({
  id, name: id, latitude, longitude, rating: 0, reviews: 0, products: "",
});

describe("location", () => {
  test("returns zero for identical coordinates", () => expect(distanceMiles({ latitude: 1, longitude: 2 }, { latitude: 1, longitude: 2 })).toBeCloseTo(0));
  test("calculates a realistic SF to LA distance", () => expect(distanceMiles({ latitude: 37.7749, longitude: -122.4194 }, { latitude: 34.0522, longitude: -118.2437 })).toBeCloseTo(347, 0));
  test("sorts nearest farms first", () => expect(addDistanceAndSort([farm("far", 2, 2), farm("near", 0.1, 0.1)], { latitude: 0, longitude: 0 }).map((x) => x.id)).toEqual(["near", "far"]));
  test("preserves farms and uses null distance without location", () => expect(addDistanceAndSort([farm("a", 1, 1)], null)[0]).toMatchObject({ id: "a", distanceMi: null }));
});
