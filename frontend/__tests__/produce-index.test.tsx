import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn(), mockPush = jest.fn(), mockParams = jest.fn(), mockFrom = jest.fn();
const mockSaveSearch = jest.fn((_props: unknown) => null), mockSaveButton = jest.fn((_props: unknown) => null);
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, router: { back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a) }, useLocalSearchParams: () => mockParams() }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; }, useSafeAreaInsets: () => ({ top: 20 }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/components/save-button", () => ({ SaveButton: (props: unknown) => mockSaveButton(props) }));
jest.mock("@/components/save-search-button", () => ({ SaveSearchButton: (props: unknown) => mockSaveSearch(props) }));
jest.mock("@/lib/supabase", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", card: "#eee", input: { background: "#eee", placeholder: "#888", text: "#111" },
  border: { light: "#ddd" }, text: { primary: "#111", secondary: "#555", tertiary: "#777" },
} }) }));

import SeasonalProduceScreen from "@/app/produce/index";

function query(result: any) { const q: any = {}; q.select = jest.fn().mockReturnValue(q); q.eq = jest.fn().mockReturnValue(q); q.then = (resolve: any) => Promise.resolve(result).then(resolve); return q; }

describe("seasonal produce screen", () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockParams.mockReturnValue({}); jest.spyOn(console, "log").mockImplementation(() => {});
    mockFrom.mockReturnValue(query({ data: [], error: null }));
  });

  it("loads, deduplicates, sorts, filters, searches, saves, and navigates", async () => {
    mockFrom.mockReturnValue(query({ data: [
      { produce_items: { id: "k", name: "Kale", category: "Vegetables", default_sold_by: "bunch" } },
      { produce_items: [{ id: "a", name: "Apple", category: "Fruit", default_sold_by: "lb" }] },
      { produce_items: { id: "k", name: "Kale", category: "Vegetables", default_sold_by: "bunch" } },
      { produce_items: null },
    ], error: null }));
    const screen = await render(<SeasonalProduceScreen />);
    await waitFor(() => expect(screen.getByText("2 items")).toBeTruthy());
    expect(screen.getByText("Apple")).toBeTruthy(); expect(screen.getByText("Kale")).toBeTruthy();
    expect(mockSaveSearch).toHaveBeenLastCalledWith({ context: "produce", query: "", filters: { category: "All" }, visible: false });
    await fireEvent.press(screen.getAllByText("Fruit")[0]);
    expect(screen.getByText("1 item")).toBeTruthy(); expect(screen.queryByText("Kale")).toBeNull();
    await fireEvent.changeText(screen.getByPlaceholderText("Search seasonal produce"), "veg");
    expect(screen.getByText("No matches found")).toBeTruthy();
    expect(mockSaveSearch).toHaveBeenLastCalledWith({ context: "produce", query: "veg", filters: { category: "Fruit" }, visible: true });
    await fireEvent.press(screen.getByLabelText("Clear search"));
    expect(screen.getByText("Apple")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("View Apple")); expect(mockPush).toHaveBeenCalledWith("/produce/a");
    await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
    expect(mockSaveButton).toHaveBeenCalledWith({ type: "produce", itemId: "a", size: 18 });
  });

  it("restores query and category route parameters", async () => {
    mockParams.mockReturnValue({ query: "apple", category: "Fruit" });
    mockFrom.mockReturnValue(query({ data: [{ produce_items: { id: "a", name: "Apple", category: "Fruit", default_sold_by: "lb" } }], error: null }));
    const screen = await render(<SeasonalProduceScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("apple")).toBeTruthy());
    expect(screen.getByText("1 item")).toBeTruthy();
  });

  it("shows database failures", async () => {
    mockFrom.mockReturnValue(query({ data: null, error: new Error("offline") }));
    const screen = await render(<SeasonalProduceScreen />);
    await waitFor(() => expect(screen.getByText("Couldn't load produce")).toBeTruthy());
    expect(screen.getByText("We could not load seasonal produce right now.")).toBeTruthy();
    expect(console.log).toHaveBeenCalledWith("Seasonal produce load error:", expect.any(Error));
  });

  it("renders a no-results state for an empty successful harvest", async () => {
    const screen = await render(<SeasonalProduceScreen />);
    await waitFor(() => expect(screen.getByText("No matches found")).toBeTruthy());
  });
});
