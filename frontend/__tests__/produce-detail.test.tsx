import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockParams = jest.fn(), mockBack = jest.fn(), mockPush = jest.fn(), mockFrom = jest.fn(), mockDirections = jest.fn();
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, useLocalSearchParams: () => mockParams(), router: { back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; }, useSafeAreaInsets: () => ({ top: 20 }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("@/components/save-button", () => ({ SaveButton: () => null }));
jest.mock("@/lib/directions", () => ({ openDirections: (...a: unknown[]) => mockDirections(...a) }));
jest.mock("@/lib/supabase", () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", surface: "#fff", card: "#eee", border: { light: "#ddd" },
  text: { primary: "#111", secondary: "#555", tertiary: "#777" },
} }) }));

import ProduceDetailScreen from "@/app/produce/[id]";

function query(result: any) { const q: any = {}; for (const m of ["select", "eq", "order"]) q[m] = jest.fn().mockReturnValue(q); q.single = jest.fn().mockResolvedValue(result); q.then = (resolve: any) => Promise.resolve(result).then(resolve); return q; }
const item = { id: "p1", name: "Kale", category: "Vegetables", description: "Fresh kale", default_sold_by: "bunch" };
const farm = { id: "f1", name: "Ada Farm", rating: 4.5, reviews: 7, latitude: 1, longitude: 2, street: "1 Main", city: "Oakland", state: "CA", postal_code: "94601", country: "US" };
const listing = { id: "l1", price: 3.5, currency: "USD", sold_by: "bunch", image_url: "kale.jpg", farms: farm, produce_varieties: { id: "v1", name: "Curly" } };

describe("produce detail screen", () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams.mockReturnValue({ id: "p1" }); jest.spyOn(console, "log").mockImplementation(() => {}); mockDirections.mockResolvedValue(undefined); });

  function results({ itemResult = { data: item, error: null }, monthResult = { data: [{ month: 8 }, { month: 6 }, { month: 7 }], error: null }, listingResult = { data: [listing], error: null } }: any = {}) {
    mockFrom.mockImplementation((table: string) => query(table === "produce_items" ? itemResult : table === "produce_item_season_months" ? monthResult : listingResult));
  }

  it("validates a missing route id", async () => {
    mockParams.mockReturnValue({});
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByText("This produce item is missing a valid id.")).toBeTruthy());
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    [{ data: null, error: new Error("missing") }],
    [{ data: null, error: null }],
  ])("handles missing produce item data", async (itemResult) => {
    results({ itemResult });
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByText("We could not load this produce item.")).toBeTruthy());
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("loads details, months, listings and supports farm and direction actions", async () => {
    results({ listingResult: { data: [
      listing,
      { ...listing, id: "l2", price: 2, currency: "BAD", image_url: null, farms: [farm], produce_varieties: [{ id: "v2", name: "" }] },
      { ...listing, id: "bad-farm", farms: null }, { ...listing, id: "bad-variety", produce_varieties: null },
    ], error: null } });
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByText("Fresh kale")).toBeTruthy());
    expect(screen.getByText("Jun · Jul · Aug")).toBeTruthy();
    expect(screen.getByText("2 farm listings · lowest price first")).toBeTruthy();
    expect(screen.getByText("$3.50")).toBeTruthy();
    expect(screen.getByText("BAD 2.00")).toBeTruthy();
    expect(screen.getAllByText("Ada Farm")).toHaveLength(2);
    expect(screen.getAllByText("4.5 · 7 reviews")).toHaveLength(2);
    expect(screen.getAllByText("1 Main Oakland, CA, 94601 US")).toHaveLength(2);
    await fireEvent.press(screen.getAllByLabelText("View Ada Farm")[0]); expect(mockPush).toHaveBeenCalledWith("/farm/f1");
    await fireEvent.press(screen.getAllByLabelText("Directions to Ada Farm")[0]);
    expect(mockDirections).toHaveBeenCalledWith("1 Main Oakland, CA, 94601 US");
    await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
  });

  it("uses description, season, address, rating, price, and direction fallbacks", async () => {
    const sparseFarm = { ...farm, rating: null, street: null, city: null, state: null, postal_code: null, country: null };
    results({ itemResult: { data: { ...item, description: "" }, error: null }, monthResult: { data: null, error: new Error("months") }, listingResult: { data: [{ ...listing, currency: "", farms: sparseFarm, produce_varieties: { id: "v", name: "" } }], error: null } });
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByText("Fresh, locally listed produce from farms near you.")).toBeTruthy());
    expect(screen.getByText("Season varies")).toBeTruthy();
    expect(screen.getByText("Location available on farm page")).toBeTruthy();
    expect(screen.queryByText(/reviews/)).toBeNull();
    await fireEvent.press(screen.getByLabelText("Directions to Ada Farm"));
    expect(mockDirections).toHaveBeenCalledWith("1,2");
    expect(console.log).toHaveBeenCalledWith("Season months error:", expect.any(Error));
  });

  it("reports listing failures after loading the produce item", async () => {
    results({ listingResult: { data: null, error: new Error("listings") } });
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByText("We could not load nearby farm listings.")).toBeTruthy());
  });

  it("shows the successful no-listings state", async () => {
    results({ monthResult: { data: [], error: null }, listingResult: { data: null, error: null } });
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByText("Nothing listed today")).toBeTruthy());
    expect(screen.getByText("0 farm listings · lowest price first")).toBeTruthy();
  });

  it("swallows native direction-opening failures", async () => {
    results(); mockDirections.mockRejectedValue(new Error("no maps"));
    const screen = await render(<ProduceDetailScreen />);
    await waitFor(() => expect(screen.getByLabelText("Directions to Ada Farm")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Directions to Ada Farm"));
    await waitFor(() => expect(console.log).toHaveBeenCalledWith("Could not open directions", expect.any(Error)));
  });
});
