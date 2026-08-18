import React from "react";
import { Alert, Animated } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUseSavedItems = jest.fn();
const mockUseSavedSearches = jest.fn();
const mockUseFarms = jest.fn();
const mockUseAuth = jest.fn();
const mockInvalidate = jest.fn();
const mockFetchListings = jest.fn();
const mockSetItemSaved = jest.fn();
const mockRenameSearch = jest.fn();
const mockDeleteSearch = jest.fn();
const mockFrom = jest.fn();
const mockCreateSignedUrl = jest.fn();

jest.mock("expo-router", () => {
  const Stack = { Screen: () => null };
  return { Stack, router: { back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a) } };
});
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => {
  const React = require("react"); const { View } = require("react-native");
  return <View {...props}>{children}</View>;
} }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("@/components/save-button", () => ({ SaveButton: () => null }));
jest.mock("@/hooks/useSaved", () => ({
  useSavedItems: () => mockUseSavedItems(), useSavedSearches: () => mockUseSavedSearches(),
}));
jest.mock("@/hooks/useFarms", () => ({ useFarms: () => mockUseFarms() }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
jest.mock("@/lib/marketplace", () => ({ fetchMarketplaceListings: () => mockFetchListings() }));
jest.mock("@/lib/saved", () => ({
  setItemSaved: (...a: unknown[]) => mockSetItemSaved(...a),
  renameSavedSearch: (...a: unknown[]) => mockRenameSearch(...a),
  deleteSavedSearch: (...a: unknown[]) => mockDeleteSearch(...a),
}));
jest.mock("@/lib/supabase", () => ({ supabase: {
  from: (...a: unknown[]) => mockFrom(...a),
  storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a) }) },
} }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", card: "#eee", surface: "#fff", input: { background: "#eee" },
  border: { light: "#ddd" }, text: { primary: "#111", secondary: "#555" },
} }) }));

import SavedScreen from "@/app/saved";

function query(result: any) {
  const q: any = { select: jest.fn(), in: jest.fn() };
  q.select.mockReturnValue(q); q.in.mockResolvedValue(result);
  return q;
}

const saved = (id: string, type: string, itemId: string) => ({
  id, user_id: "u1", item_type: type, item_id: itemId, created_at: "now", updated_at: "now",
});

describe("SavedScreen favorites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Animated, "spring").mockImplementation(() => ({ start: (cb?: any) => cb?.() } as any));
    jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: (cb?: any) => cb?.() } as any));
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } } });
    mockUseSavedSearches.mockReturnValue({ data: [], isLoading: false });
    mockUseFarms.mockReturnValue({ data: [{ id: "f1", name: "Ada Farm", products: "Kale" }], isLoading: false });
    mockUseSavedItems.mockReturnValue({ data: [], isLoading: false });
    mockFetchListings.mockResolvedValue([]);
    mockInvalidate.mockResolvedValue(undefined);
    mockSetItemSaved.mockResolvedValue(undefined);
    mockRenameSearch.mockResolvedValue(undefined);
    mockDeleteSearch.mockResolvedValue(undefined);
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "signed-recipe.jpg" } });
    mockFrom.mockImplementation((table: string) => query({ data: table === "produce_items" ? [] : [], error: null }));
  });

  it("renders empty and loading favorites and navigates back", async () => {
    let screen = await render(<SavedScreen />);
    await waitFor(() => expect(screen.getByText("No saved farms yet.")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockBack).toHaveBeenCalled();
    await screen.unmount();

    mockUseSavedItems.mockReturnValue({ data: [], isLoading: true });
    screen = await render(<SavedScreen />);
    expect(screen.getByLabelText("Loading saved favorites")).toBeTruthy();
  });

  it("hydrates every favorite type, filters, opens routes, and identifies stale content", async () => {
    const dbId = "123e4567-e89b-12d3-a456-426614174000";
    mockUseSavedItems.mockReturnValue({ data: [
      saved("s1", "farm", "f1"), saved("s2", "produce", "p1"), saved("s3", "listing", "l1"),
      saved("s4", "recipe", "1"), saved("s5", "recipe", dbId), saved("s6", "farm", "missing"),
    ], isLoading: false });
    mockFrom.mockImplementation((table: string) => query({
      data: table === "produce_items" ? [{ id: "p1", name: "Kale", category: "Vegetables" }]
        : [{ id: dbId, title: "DB Soup", description: "Warm", cover_image_path: "cover/path", cover_media: [] }],
      error: null,
    }));
    mockFetchListings.mockResolvedValue([{ id: "l1", varietyName: "Curly", produceItemName: "Kale", farmName: "Ada Farm", currency: "USD", price: 3, soldBy: "bunch", produceItemId: "p1", imageUrl: "listing.jpg" }]);

    const screen = await render(<SavedScreen />);
    await waitFor(() => expect(screen.getByText("Ada Farm")).toBeTruthy());
    expect(screen.getByText("Remove 1 unavailable item")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Open Ada Farm"));
    expect(mockPush).toHaveBeenCalledWith("/farm/f1");

    await fireEvent.press(screen.getByText("Produce"));
    await waitFor(() => expect(screen.getByText("Kale")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Open Kale"));
    expect(mockPush).toHaveBeenCalledWith("/produce/p1");

    await fireEvent.press(screen.getByText("Listings"));
    await waitFor(() => expect(screen.getByText("Curly Kale")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Open Curly Kale"));
    expect(mockPush).toHaveBeenCalledWith("/produce/p1");

    await fireEvent.press(screen.getByText("Recipes"));
    await waitFor(() => expect(screen.getByText("Banana Blueberry")).toBeTruthy());
    expect(screen.getByText("DB Soup")).toBeTruthy();
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("cover/path", 3600);

    await fireEvent.press(screen.getByText("Farms"));
    await fireEvent.press(screen.getByText("Remove 1 unavailable item"));
    expect(mockSetItemSaved).toHaveBeenCalledWith("u1", "farm", "missing", false);
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["saved-items", "u1"] });
  });

  it("uses subtitle and image fallbacks for sparse hydrated records", async () => {
    const dbId = "123e4567-e89b-12d3-a456-426614174000";
    mockUseFarms.mockReturnValue({ data: [{ id: "f1", name: "Farm", products: "" }], isLoading: false });
    mockUseSavedItems.mockReturnValue({ data: [saved("1", "farm", "f1"), saved("2", "recipe", dbId)], isLoading: false });
    mockFrom.mockImplementation((table: string) => query({ data: table === "recipes" ? [{ id: dbId, title: "Recipe", description: "", cover_image_url: "fallback.jpg", cover_media: [{ url: "media.jpg" }] }] : [], error: null }));
    const screen = await render(<SavedScreen />);
    await waitFor(() => expect(screen.getByText("Local farm")).toBeTruthy());
    await fireEvent.press(screen.getByText("Recipes"));
    await waitFor(() => expect(screen.getAllByText("Recipe").length).toBeGreaterThanOrEqual(1));
  });

  it("resolves recipe media fallbacks when signing is unavailable", async () => {
    const mediaId = "123e4567-e89b-12d3-a456-426614174001";
    const urlId = "123e4567-e89b-12d3-a456-426614174002";
    mockUseSavedItems.mockReturnValue({ data: [saved("1", "recipe", mediaId), saved("2", "recipe", urlId)], isLoading: false });
    mockCreateSignedUrl.mockResolvedValue({ data: null });
    mockFrom.mockImplementation((table: string) => query({ data: table === "recipes" ? [
      { id: mediaId, title: "Media Recipe", cover_media: [{ path: "media/path", url: "media-fallback.jpg" }] },
      { id: urlId, title: "URL Recipe", cover_media: { invalid: true }, cover_image_url: "cover-fallback.jpg" },
    ] : [], error: null }));
    const screen = await render(<SavedScreen />);
    await fireEvent.press(screen.getByText("Recipes"));
    await waitFor(() => expect(screen.getByText("Media Recipe")).toBeTruthy());
    expect(screen.getByText("URL Recipe")).toBeTruthy();
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("media/path", 3600);
  });

  it("shows plural stale cleanup and safely no-ops while signed out", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    mockUseSavedItems.mockReturnValue({ data: [saved("1", "farm", "missing-1"), saved("2", "farm", "missing-2")], isLoading: false });
    const screen = await render(<SavedScreen />);
    await waitFor(() => expect(screen.getByText("Remove 2 unavailable items")).toBeTruthy());
    await fireEvent.press(screen.getByText("Remove 2 unavailable items"));
    expect(mockSetItemSaved).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("waits for farms before hydrating", async () => {
    mockUseFarms.mockReturnValue({ data: [], isLoading: true });
    mockUseSavedItems.mockReturnValue({ data: [saved("1", "farm", "f1")], isLoading: false });
    const screen = await render(<SavedScreen />);
    expect(screen.getByLabelText("Loading saved favorites")).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    ["produce_items", new Error("produce failed"), "produce failed"],
    ["recipes", "bad", "Please try again."],
  ])("alerts when %s hydration fails", async (failedTable, error, message) => {
    const dbId = "123e4567-e89b-12d3-a456-426614174000";
    mockUseSavedItems.mockReturnValue({ data: [saved("p", "produce", "p1"), saved("r", "recipe", dbId)], isLoading: false });
    mockFrom.mockImplementation((table: string) => query({ data: [], error: table === failedTable ? error : null }));
    await render(<SavedScreen />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not load saved items", message));
  });
});

describe("SavedScreen searches", () => {
  const searches = [
    { id: "h", display_name: "Nearby kale", context: "home", query: "kale", filters: {} },
    { id: "p", display_name: "Produce", context: "produce", query: "", filters: { category: "Fruit" } },
    { id: "m", display_name: "Market", context: "marketplace", query: "corn", filters: { category: "Vegetables" } },
    { id: "a", display_name: "Everything", context: "home", query: "", filters: {} },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Animated, "spring").mockImplementation(() => ({ start: (cb?: any) => cb?.() } as any));
    jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: (cb?: any) => cb?.() } as any));
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } } });
    mockUseSavedItems.mockReturnValue({ data: [], isLoading: false });
    mockUseSavedSearches.mockReturnValue({ data: searches, isLoading: false });
    mockUseFarms.mockReturnValue({ data: [], isLoading: false });
    mockInvalidate.mockResolvedValue(undefined); mockRenameSearch.mockResolvedValue(undefined); mockDeleteSearch.mockResolvedValue(undefined);
  });

  it("opens all search contexts with restored query and category", async () => {
    const screen = await render(<SavedScreen />);
    await fireEvent.press(screen.getByText("Searches"));
    await fireEvent.press(screen.getByLabelText("Open saved search Nearby kale"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(tabs)", params: { query: "kale" } });
    await fireEvent.press(screen.getByLabelText("Open saved search Produce"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/produce", params: { query: "", category: "Fruit" } });
    await fireEvent.press(screen.getByLabelText("Open saved search Market"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/listing/search", params: { query: "corn", category: "Vegetables" } });
    expect(screen.getByText("home · All")).toBeTruthy();
  });

  it("renames and deletes a search, while rejecting a blank rename", async () => {
    const screen = await render(<SavedScreen />);
    await fireEvent.press(screen.getByText("Searches"));
    await fireEvent.press(screen.getByLabelText("Rename Nearby kale"));
    const input = screen.getByLabelText("Saved search name");
    await fireEvent.changeText(input, "   ");
    await fireEvent(input, "submitEditing");
    expect(mockRenameSearch).not.toHaveBeenCalled();
    await fireEvent.changeText(input, "My kale");
    await fireEvent(input, "submitEditing");
    await waitFor(() => expect(mockRenameSearch).toHaveBeenCalledWith("h", "My kale"));
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["saved-searches", "u1"] });
    await fireEvent.press(screen.getByLabelText("Delete Produce"));
    await waitFor(() => expect(mockDeleteSearch).toHaveBeenCalledWith("p"));
  });

  it("shows empty and loading search states", async () => {
    mockUseSavedSearches.mockReturnValue({ data: [], isLoading: false });
    let screen = await render(<SavedScreen />);
    await fireEvent.press(screen.getByText("Searches"));
    expect(screen.getByText("No saved searches yet.")).toBeTruthy();
    await screen.unmount();
    mockUseSavedSearches.mockReturnValue({ data: undefined, isLoading: true });
    screen = await render(<SavedScreen />);
    await fireEvent.press(screen.getByText("Searches"));
    expect(screen.getByLabelText("Loading saved searches")).toBeTruthy();
  });
});
