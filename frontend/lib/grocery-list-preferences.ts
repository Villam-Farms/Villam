import AsyncStorage from "@react-native-async-storage/async-storage";

const SHOW_UNITS_KEY = "villam:grocery-lists:show-units";
const SHOW_QUANTITIES_KEY = "villam:grocery-lists:show-quantities";

export async function getShowGroceryListUnits(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SHOW_UNITS_KEY);
  return value !== "false";
}

export async function setShowGroceryListUnits(showUnits: boolean): Promise<void> {
  await AsyncStorage.setItem(SHOW_UNITS_KEY, String(showUnits));
}

export async function getShowGroceryListQuantities(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SHOW_QUANTITIES_KEY);
  return value !== "false";
}

export async function setShowGroceryListQuantities(showQuantities: boolean): Promise<void> {
  await AsyncStorage.setItem(SHOW_QUANTITIES_KEY, String(showQuantities));
}
