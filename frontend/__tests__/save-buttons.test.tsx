import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockToggle = jest.fn();
const mockUseSavedItem = jest.fn();
const mockSaveSearch = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/hooks/useSaved", () => ({ useSavedItem: (...args: unknown[]) => mockUseSavedItem(...args) }));
jest.mock("@/lib/saved", () => ({ saveSearch: (...args: unknown[]) => mockSaveSearch(...args) }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }));
jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ colors: { text: { primary: "#111" }, background: "#fff", border: { light: "#ddd" } } }),
}));

import { SaveButton } from "@/components/save-button";
import { SaveSearchButton } from "@/components/save-search-button";

describe("SaveButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSavedItem.mockReturnValue({ isSaved: false, isLoading: false, toggle: mockToggle, error: null });
    mockToggle.mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("optimistically saves a farm and changes its accessible state", async () => {
    const screen = await render(<SaveButton type="farm" itemId="farm-1" />);
    await fireEvent.press(screen.getByLabelText("Save farm"));
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith(true));
  });

  it("optimistically removes a saved listing", async () => {
    mockUseSavedItem.mockReturnValue({ isSaved: true, isLoading: false, toggle: mockToggle, error: null });
    const screen = await render(<SaveButton type="listing" itemId="listing-1" light size={28} />);
    await fireEvent.press(screen.getByLabelText("Remove saved listing"));
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith(false));
    expect(screen.getByLabelText("Save listing")).toBeTruthy();
  });

  it("rolls the visual state back when saving fails", async () => {
    mockToggle.mockRejectedValue(new Error("offline"));
    const screen = await render(<SaveButton type="recipe" itemId="r1" />);
    await fireEvent.press(screen.getByLabelText("Save recipe"));
    await waitFor(() => expect(screen.getByLabelText("Save recipe")).toBeTruthy());
  });

  it("shows loading and reports migration-aware errors", async () => {
    mockUseSavedItem.mockReturnValue({
      isSaved: false, isLoading: true, toggle: mockToggle, error: new Error("saved_items does not exist"),
    });
    const screen = await render(<SaveButton type="produce" itemId="p1" />);
    expect(screen.getByLabelText("Save produce").props.accessibilityState.disabled).toBe(true);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Could not update favorite",
      expect.stringContaining("database migration"),
    );
  });

  it("uses a generic message for non-Error failures", async () => {
    mockUseSavedItem.mockReturnValue({ isSaved: false, isLoading: false, toggle: mockToggle, error: "bad" });
    await render(<SaveButton type="farm" itemId="f" />);
    expect(Alert.alert).toHaveBeenCalledWith("Could not update favorite", "Please try again.");
  });
});

describe("SaveSearchButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } } });
    mockSaveSearch.mockResolvedValue({ id: "s1" });
    mockInvalidateQueries.mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("does not render when hidden", async () => {
    const screen = await render(<SaveSearchButton context="home" query="corn" visible={false} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("saves, refreshes, and confirms a search", async () => {
    const screen = await render(
      <SaveSearchButton context="marketplace" query="corn" filters={{ category: "Vegetables" }} />,
    );
    await fireEvent.press(screen.getByLabelText("Save this search"));
    await waitFor(() => expect(mockSaveSearch).toHaveBeenCalledWith(
      "u1", "marketplace", "corn", { category: "Vegetables" },
    ));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["saved-searches", "u1"] });
    expect(Alert.alert).toHaveBeenCalledWith("Search saved", expect.stringContaining("Profile"));
  });

  it("reports Error and non-Error save failures", async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error("Network unavailable"));
    let screen = await render(<SaveSearchButton context="home" query="corn" />);
    await fireEvent.press(screen.getByLabelText("Save this search"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not save search", "Network unavailable"));
    await screen.unmount();

    mockSaveSearch.mockRejectedValueOnce("bad");
    screen = await render(<SaveSearchButton context="produce" query="melon" />);
    await fireEvent.press(screen.getByLabelText("Save this search"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not save search", "Please try again."));
  });

  it("does nothing without a signed-in user", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    const screen = await render(<SaveSearchButton context="home" query="corn" />);
    await fireEvent.press(screen.getByLabelText("Save this search"));
    expect(mockSaveSearch).not.toHaveBeenCalled();
  });
});
