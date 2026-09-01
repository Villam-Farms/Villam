import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn();
const mockUseQuery = jest.fn(); const mockUseFarms = jest.fn(); const mockParams = jest.fn();
const mockOpenDirections = jest.fn(); const mockFilter = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react"); const { View } = require("react-native");
  const Stack = { Screen: () => <View testID="stack-screen" /> };
  return { Stack, router: { push: (...args: any[]) => mockPush(...args), replace: (...args: any[]) => mockReplace(...args), back: (...args: any[]) => mockBack(...args) }, useLocalSearchParams: () => mockParams() };
});
jest.mock("@tanstack/react-query", () => ({ useQuery: (options: any) => mockUseQuery(options) }));
jest.mock("@/hooks/useFarms", () => ({ useFarms: () => mockUseFarms() }));
jest.mock("@/hooks/useCurrentLocation", () => ({ useCurrentLocation: () => ({ coords: { latitude: 1, longitude: 2 } }) }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({ session: { user: { id: "user-1" } } }) }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: { background: "#fff", surface: "#fff", card: "#eee", border: { light: "#ddd" }, text: { primary: "#111", secondary: "#555", tertiary: "#777" }, input: { background: "#eee", placeholder: "#888" } } }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; }, useSafeAreaInsets: () => ({ top: 0 }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@/components/save-button", () => ({ SaveButton: ({ itemId }: any) => { const React = require("react"); const { View } = require("react-native"); return <View testID={`save-${itemId}`} />; } }));
jest.mock("@/components/save-search-button", () => ({ SaveSearchButton: ({ visible, query }: any) => { const React = require("react"); const { Text } = require("react-native"); return visible ? <Text>Save {query || "filtered"}</Text> : null; } }));
jest.mock("@/lib/directions", () => ({ openDirections: (...args: any[]) => mockOpenDirections(...args) }));
jest.mock("@/lib/address", () => ({ formatAddress: (farm: any) => farm.address || "" }));
jest.mock("@/lib/listing-browser", () => ({
  buildListingRows: (rows: any[]) => rows,
  filterListingRows: (...args: any[]) => mockFilter(...args),
}));
jest.mock("@/lib/listing-visuals", () => ({ getListingVisuals: () => ({ badgeColor: "orange", badgeTextColor: "black" }) }));

import ListingsScreen from "@/app/(tabs)/listings";
import ListingSearchScreen from "@/app/listing/search";

const row = { id: "listing-1", farmId: "farm-1", farmName: "Sunny Farm", name: "Carrots", category: "Vegetables", price: "$4", unit: "bunch", note: "Fresh", color: "#eee", badgeColor: "#ddd", badgeTextColor: "#111", farmDotColor: "green", icon: "leaf", city: "Town", state: "CA", postal_code: "1", country: "US", imageUrl: "photo.jpg" };

describe("owned marketplace listings", () => {
  let farmResult: any; let listingResult: any;
  beforeEach(() => {
    jest.clearAllMocks();
    farmResult = { data: { id: "farm-1", name: "Sunny Farm", imageUrl: "farm.jpg" }, isLoading: false, error: null, refetch: jest.fn().mockResolvedValue({ data: { id: "farm-1" } }) };
    listingResult = { data: [row], isLoading: false, error: null, refetch: jest.fn() };
    mockUseQuery.mockImplementation(({ queryKey }: any) => queryKey[0] === "owned-farm" ? farmResult : listingResult);
    mockFilter.mockImplementation((rows: any[], category: string) => category === "All" ? rows : rows.filter(x => x.category === category));
  });

  it("shows owned listings, filters them, and opens create/manage actions", async () => {
    const screen = await render(<ListingsScreen />);
    expect(screen.getByText("Sunny Farm")).toBeTruthy(); expect(screen.getByText("Carrots")).toBeTruthy(); expect(screen.getByTestId("save-listing-1")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Vegetables")[0]); expect(screen.getByText("Carrots")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Create listing")); await fireEvent.press(screen.getByLabelText("Manage farm")); await fireEvent.press(screen.getByLabelText("Manage listings")); await fireEvent.press(screen.getByText("Carrots"));
    expect(mockPush.mock.calls).toEqual([["/listing/new"], ["/farm/manage"], ["/listing/manage"], ["/listing/manage"]]);
  });

  it("lets users without a farm choose whether to start setup", async () => {
    farmResult.data = null;
    const screen = await render(<ListingsScreen />);
    expect(screen.getByText("No farm yet")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Set up your farm"));
    expect(mockPush).toHaveBeenCalledWith("/listing/new");
  });

  it.each([
    [true, null, "Loading listings…"],
    [false, new Error("no"), "Could not load listings."],
  ])("renders loading and failure states", async (isLoading, error, message) => {
    farmResult.isLoading = isLoading; farmResult.error = error;
    const screen = await render(<ListingsScreen />); expect(screen.getByText(message)).toBeTruthy();
  });

  it("renders an empty category", async () => {
    mockFilter.mockReturnValue([]);
    const screen = await render(<ListingsScreen />); expect(screen.getByText("You have no listings in this category yet.")).toBeTruthy();
  });
});

describe("marketplace search", () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockParams.mockReturnValue({});
    mockUseFarms.mockReturnValue({ data: [{ id: "farm-1", address: "1 Farm Road", latitude: 1, longitude: 2 }], isLoading: false, error: null });
    mockUseQuery.mockReturnValue({ data: [row], isLoading: false, error: null });
    mockFilter.mockImplementation((rows: any[], category: string, query: string) => rows.filter(x => (category === "All" || x.category === category) && (!query || x.name.toLowerCase().includes(query.toLowerCase()))));
  });

  it("restores parameters, edits and clears search, filters, and saves it", async () => {
    mockParams.mockReturnValue({ query: "Car", category: "Vegetables" });
    const screen = await render(<ListingSearchScreen />);
    expect(screen.getByDisplayValue("Car")).toBeTruthy(); expect(screen.getByText("Save Car")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Search produce, farm, or category"), "Nope"); expect(screen.getByText("No listings matched your search.")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Clear search")); expect(screen.getByText("Carrots")).toBeTruthy();
  });

  it("opens farms, directions, and back navigation", async () => {
    const screen = await render(<ListingSearchScreen />);
    await fireEvent.press(screen.getByText("Carrots")); expect(mockPush).toHaveBeenCalledWith("/farm/farm-1");
    await fireEvent.press(screen.getByLabelText("Directions to Sunny Farm")); expect(mockOpenDirections).toHaveBeenCalledWith("1 Farm Road");
    await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
  });

  it.each([
    [{ isLoading: true, error: null }, "Loading listings…"],
    [{ isLoading: false, error: new Error("no") }, "Could not load listings."],
  ])("renders remote states", async (state, message) => {
    mockUseFarms.mockReturnValue({ data: [], ...state });
    const screen = await render(<ListingSearchScreen />); expect(screen.getByText(message)).toBeTruthy();
  });

  it("handles unavailable farms and rejected map launches", async () => {
    mockUseFarms.mockReturnValue({ data: [], isLoading: false, error: null });
    let screen = await render(<ListingSearchScreen />); await fireEvent.press(screen.getByLabelText("Directions to Sunny Farm")); expect(mockOpenDirections).not.toHaveBeenCalled();
    mockUseFarms.mockReturnValue({ data: [{ id: "farm-1", address: "", latitude: 1, longitude: 2 }], isLoading: false, error: null }); mockOpenDirections.mockRejectedValueOnce(new Error("map"));
    screen.unmount(); screen = await render(<ListingSearchScreen />); await fireEvent.press(screen.getByLabelText("Directions to Sunny Farm")); expect(mockOpenDirections).toHaveBeenCalled();
  });
});
