import AsyncStorage from "@react-native-async-storage/async-storage";
import { getShowGroceryListQuantities, getShowGroceryListUnits, setShowGroceryListQuantities, setShowGroceryListUnits } from "@/lib/grocery-list-preferences";

describe("grocery preferences", () => {
  beforeEach(async () => AsyncStorage.clear());
  test("units default to visible", async () => expect(getShowGroceryListUnits()).resolves.toBe(true));
  test("quantities default to visible", async () => expect(getShowGroceryListQuantities()).resolves.toBe(true));
  test("persists hidden units", async () => { await setShowGroceryListUnits(false); await expect(getShowGroceryListUnits()).resolves.toBe(false); });
  test("persists hidden quantities", async () => { await setShowGroceryListQuantities(false); await expect(getShowGroceryListQuantities()).resolves.toBe(false); });
  test("can restore both preferences", async () => { await setShowGroceryListUnits(false); await setShowGroceryListQuantities(false); await setShowGroceryListUnits(true); await setShowGroceryListQuantities(true); expect(await Promise.all([getShowGroceryListUnits(), getShowGroceryListQuantities()])).toEqual([true, true]); });
});
