import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn(); const mockBack = jest.fn(); const mockOrder = jest.fn(); const mockSigned = jest.fn();
let mockResponse: any;
jest.mock("expo-router", () => { const React = require("react"); const { View } = require("react-native"); return { Stack: { Screen: () => <View /> }, router: { push: (...a: any[]) => mockPush(...a), back: (...a: any[]) => mockBack(...a) }, useFocusEffect: (cb: any) => { React.useEffect(cb, [cb]); } }; });
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock("@expo/vector-icons", () => { const React = require("react"); const { View } = require("react-native"); const Icon = (props: any) => <View {...props} />; Icon.glyphMap = {}; return { Ionicons: Icon }; });
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: { background: "white", card: "#eee", border: { light: "gray", default: "gray" }, text: { primary: "black", secondary: "gray", tertiary: "gray" }, input: { background: "#eee", placeholder: "gray", text: "black" } } }) }));
jest.mock("@/lib/supabase", () => ({ supabase: {
  from: () => ({ select: () => ({ order: (...a: any[]) => mockOrder(...a) }) }),
  storage: { from: () => ({ createSignedUrl: (...a: any[]) => mockSigned(...a) }) },
} }));

import RecipesScreen from "@/app/recipe/recipes";

const base = { user_id: "u", cover_image_url: null, cover_image_path: null, cover_media: null, prep_time_minutes: 10, cook_time_minutes: 20, additional_time_minutes: 0, total_time_minutes: 30, servings: 4, difficulty: "Easy", created_at: "2026-01-02", updated_at: "2026-01-02" };
const recipes = [
  { ...base, id: "r1", title: "Carrot Soup", description: "Warm roots", tags: ["Dinner", "Vegan"], ingredients: [{ position: 2, quantity: "2", unit: "cups", name: "carrots" }], steps: [{ position: 1, instruction: "Simmer", photo_paths: ["step.jpg"], photo_urls: [] }], cover_image_path: "cover.jpg", cover_media: [{ position: 1, path: "media.jpg" }] },
  { ...base, id: "r2", title: "Toast", description: null, tags: ["Breakfast"], ingredients: [], steps: [], total_time_minutes: 60, servings: null, difficulty: "Medium", cover_image_url: "https://image/toast.jpg" },
  { ...base, id: "r3", title: "Mystery Dish", description: "Secret", tags: [], ingredients: null, steps: null, total_time_minutes: 0, difficulty: "Hard", created_at: "bad-date" },
];

describe("recipe library", () => {
  beforeEach(() => { jest.clearAllMocks(); mockResponse = { data: recipes, error: null }; mockOrder.mockImplementation(async () => mockResponse); mockSigned.mockImplementation(async (path: string) => ({ data: { signedUrl: `signed:${path}` }, error: null })); });

  it("loads, hydrates, filters, searches, and opens recipes", async () => {
    const screen = await render(<RecipesScreen />);
    await waitFor(() => expect(screen.getAllByText("Carrot Soup").length).toBeGreaterThan(0));
    expect(mockSigned).toHaveBeenCalledWith("cover.jpg", 3600); expect(screen.getByText("45 min")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Breakfast")[0]); expect(screen.getAllByText("Toast").length).toBeGreaterThan(0); expect(screen.queryByText("Mystery Dish")).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText("Search recipes, tags, ingredients, or steps"), "nothing"); await waitFor(() => expect(screen.getByText("No recipes found")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Clear search")); await fireEvent.press(screen.getAllByText("All")[0]); await waitFor(() => expect(screen.getAllByText("Carrot Soup").length).toBeGreaterThan(0));
    await fireEvent.press(screen.getByText("Open recipe")); expect(mockPush).toHaveBeenCalledWith("/recipe/r1");
    await fireEvent.press(screen.getByText("Create")); expect(mockPush).toHaveBeenCalledWith("/recipe/new"); await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
  });

  it("shows empty state and opens creation", async () => {
    mockResponse = { data: [], error: null }; const screen = await render(<RecipesScreen />); await waitFor(() => expect(screen.getByText("No recipes yet")).toBeTruthy());
    await fireEvent.press(screen.getByText("Create recipe")); expect(mockPush).toHaveBeenCalledWith("/recipe/new");
  });

  it("shows an error and retries successfully", async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error("offline") }).mockResolvedValueOnce({ data: [], error: null });
    const screen = await render(<RecipesScreen />); await waitFor(() => expect(screen.getByText("offline")).toBeTruthy()); await fireEvent.press(screen.getByText("Try again")); await waitFor(() => expect(screen.getByText("No recipes yet")).toBeTruthy());
  });

  it("falls back when signed storage URLs fail", async () => {
    mockSigned.mockResolvedValue({ data: null, error: { message: "expired" } });
    const screen = await render(<RecipesScreen />); await waitFor(() => expect(screen.getAllByText("Carrot Soup").length).toBeGreaterThan(0)); expect(mockSigned).toHaveBeenCalled();
  });
});
