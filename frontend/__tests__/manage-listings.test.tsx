import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockUseQuery = jest.fn(); const mockInvalidate = jest.fn(); const mockAlert = jest.spyOn(Alert, "alert");
const mockUpdate = jest.fn(); const mockDelete = jest.fn(); const mockUpload = jest.fn(); const mockClear = jest.fn();
const mockPermission = jest.fn(); const mockLaunch = jest.fn(); const mockBack = jest.fn(); const mockReplace = jest.fn();
let mockSession: any = { user: { id: "u" }, access_token: "token" };

jest.mock("expo-router", () => { const React = require("react"); const { View } = require("react-native"); return { Stack: { Screen: () => <View /> }, router: { canGoBack: () => true, back: (...a: any[]) => mockBack(...a), replace: (...a: any[]) => mockReplace(...a) } }; });
jest.mock("@tanstack/react-query", () => ({ useQuery: (o: any) => mockUseQuery(o), useQueryClient: () => ({ invalidateQueries: (...a: any[]) => mockInvalidate(...a) }) }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: { background: "white", surface: "white", card: "#eee", border: { light: "gray", default: "gray" }, text: { primary: "black", secondary: "gray", tertiary: "gray" }, input: { background: "white", placeholder: "gray", text: "black" } } }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock("react-native/Libraries/Modal/Modal", () => ({ __esModule: true, default: ({ children, visible }: any) => visible ? children : null }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" })); jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-image-picker", () => ({ MediaTypeOptions: { Images: "Images" }, requestMediaLibraryPermissionsAsync: (...a: any[]) => mockPermission(...a), launchImageLibraryAsync: (...a: any[]) => mockLaunch(...a) }));
jest.mock("@/lib/marketplace", () => ({
  CURRENCY_OPTIONS: ["USD", "CAD"], SOLD_BY_OPTIONS: ["lb", "each"],
  fetchFarmListingsByFarmId: jest.fn(), fetchProduceCatalog: jest.fn(),
  updateFarmListing: (...a: any[]) => mockUpdate(...a), deleteFarmListing: (...a: any[]) => mockDelete(...a), uploadFarmListingImage: (...a: any[]) => mockUpload(...a), clearFarmListingImage: (...a: any[]) => mockClear(...a),
}));

import ManageListingsScreen from "@/app/listing/manage";

const listing = { id: "l1", produceItemId: "p1", varietyId: "v1", produceItemName: "Carrot", varietyName: "Nantes", soldBy: "lb", currency: "USD", price: 4, available: true, imageUrl: "old.jpg" };
const catalog = { items: [{ id: "p1", name: "Carrot", category: "Roots" }, { id: "p2", name: "Apple", category: "Fruit" }], varieties: [{ id: "v1", produce_item_id: "p1", name: "Nantes", description: "Sweet" }, { id: "v2", produce_item_id: "p2", name: "Gala", description: "Crisp" }] };
let farm: any; let listings: any; let catalogResult: any;

describe("manage listings", () => {
  beforeEach(() => {
    jest.clearAllMocks(); mockSession = { user: { id: "u" }, access_token: "token" };
    farm = { data: { id: "f1" }, isLoading: false }; listings = { data: [listing], isLoading: false, error: null }; catalogResult = { data: catalog, isLoading: false };
    mockUseQuery.mockImplementation(({ queryKey }: any) => queryKey[0] === "owned-farm" ? farm : queryKey[0] === "owned-marketplace-listings" ? listings : catalogResult);
    mockPermission.mockResolvedValue({ granted: true }); mockLaunch.mockResolvedValue({ canceled: true }); mockUpdate.mockResolvedValue(undefined); mockDelete.mockResolvedValue(undefined);
  });

  it.each([
    [null, false, null, "Sign in to manage your listings."],
    [{ id: "f1" }, true, null, "Loading your listings…"],
    [null, false, null, "No farm yet"],
    [{ id: "f1" }, false, new Error("bad"), "Could not load your listings."],
  ])("renders account and remote states", async (farmData, loading, error, message) => {
    if (farmData === null && message.startsWith("Sign")) mockSession = null;
    farm.data = farmData; farm.isLoading = loading; listings.error = error;
    const screen = await render(<ManageListingsScreen />); expect(screen.getByText(message)).toBeTruthy();
  });

  it("renders the no-listings state", async () => { listings.data = []; const screen = await render(<ManageListingsScreen />); expect(screen.getByText("No listings yet")).toBeTruthy(); });

  it("edits and saves a listing", async () => {
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing"));
    expect(screen.getAllByText("Edit listing")).toHaveLength(2); await fireEvent.changeText(screen.getByDisplayValue("4"), "5.5"); await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "l1", price: 5.5 })));
    expect(mockInvalidate).toHaveBeenCalledTimes(2); expect(mockAlert).toHaveBeenCalledWith("Listing updated", expect.any(String));
  });

  it("validates price and reports update failures", async () => {
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing")); await fireEvent.changeText(screen.getByDisplayValue("4"), "0"); await fireEvent.press(screen.getByText("Save changes"));
    expect(mockAlert).toHaveBeenCalledWith("Valid price required", expect.any(String));
    await fireEvent.changeText(screen.getByDisplayValue("0"), "2"); mockUpdate.mockRejectedValueOnce(new Error("offline")); await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith("Update failed", "offline"));
  });

  it("changes selector values", async () => {
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing"));
    await fireEvent.press(screen.getAllByText("Carrot").at(-1)!); await fireEvent.press(screen.getByText("Apple")); expect(screen.getByText("Gala")).toBeTruthy();
    await fireEvent.press(screen.getByText("USD")); await fireEvent.press(screen.getByText("CAD"));
    await fireEvent.press(screen.getByText("lb")); await fireEvent.press(screen.getByText("each")); expect(screen.getByText("each")).toBeTruthy();
  });

  it("checks image permission, size, replacement, and removal", async () => {
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing"));
    mockPermission.mockResolvedValueOnce({ granted: false }); await fireEvent.press(screen.getByText("Change photo")); expect(mockAlert).toHaveBeenCalledWith("Permission needed", expect.any(String));
    mockPermission.mockResolvedValueOnce({ granted: true }); mockLaunch.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "huge.jpg", fileSize: 11 * 1024 * 1024 }] }); await fireEvent.press(screen.getByText("Change photo")); expect(mockAlert).toHaveBeenCalledWith("Too large", expect.any(String));
    mockPermission.mockResolvedValueOnce({ granted: true }); mockLaunch.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "new.jpg", mimeType: "image/png" }] }); await fireEvent.press(screen.getByText("Change photo")); await fireEvent.press(screen.getByText("Save changes")); await waitFor(() => expect(mockUpload).toHaveBeenCalledWith("token", "l1", expect.objectContaining({ uri: "new.jpg" })));
  });

  it("deletes after confirmation and reports deletion errors", async () => {
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing")); await fireEvent.press(screen.getByText("Delete listing"));
    const buttons = mockAlert.mock.calls.at(-1)?.[2] as any[]; await buttons[1].onPress(); await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("token", "l1"));
    expect(mockAlert).toHaveBeenCalledWith("Listing deleted", expect.any(String));
  });

  it("removes an existing listing image", async () => {
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing"));
    await fireEvent.press(screen.getByText("Remove")); await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockClear).toHaveBeenCalledWith("token", "l1"));
  });

  it("requires authentication and reports listing deletion failures", async () => {
    mockSession = { user: { id: "u" }, access_token: null };
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing")); await fireEvent.press(screen.getByText("Delete listing"));
    let buttons = mockAlert.mock.calls.at(-1)?.[2] as any[]; await buttons[1].onPress();
    expect(mockAlert).toHaveBeenCalledWith("Sign in required", expect.any(String));
  });

  it("reports listing deletion errors", async () => {
    mockDelete.mockRejectedValue(new Error("delete failed"));
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing")); await fireEvent.press(screen.getByText("Delete listing"));
    const buttons = mockAlert.mock.calls.at(-1)?.[2] as any[]; await buttons[1].onPress();
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith("Delete failed", "delete failed"));
  });

  it("normalizes unsupported listing values and closes editors", async () => {
    listings.data = [{ ...listing, soldBy: "crate", currency: "EUR", imageUrl: null }];
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing"));
    expect(screen.getByText("No listing image selected")).toBeTruthy(); expect(screen.getByText("USD")).toBeTruthy(); expect(screen.getByText("lb")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close listing editor")); expect(screen.queryByText("Save changes")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
  });

  it("handles missing catalog varieties and toggles availability", async () => {
    catalogResult.data = { items: catalog.items, varieties: [] };
    const screen = await render(<ManageListingsScreen />); await fireEvent.press(screen.getByText("Edit listing"));
    await fireEvent(screen.getByRole("switch"), "valueChange", false); await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ available: false })));
  });
});
