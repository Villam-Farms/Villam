import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn(), mockPush = jest.fn(), mockReplace = jest.fn(), mockHaptic = jest.fn(), mockSignOut = jest.fn();
const mockUseAuth = jest.fn(), mockUseProfile = jest.fn();
const mockGetUnits = jest.fn(), mockGetQuantities = jest.fn(), mockSetUnits = jest.fn(), mockSetQuantities = jest.fn();
jest.mock("expo-router", () => ({ router: { back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock("expo-haptics", () => ({ impactAsync: (...a: unknown[]) => mockHaptic(...a), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/hooks/useMyProfile", () => ({ useMyProfile: () => mockUseProfile() }));
jest.mock("@/lib/grocery-list-preferences", () => ({
  getShowGroceryListUnits: () => mockGetUnits(), getShowGroceryListQuantities: () => mockGetQuantities(),
  setShowGroceryListUnits: (...a: unknown[]) => mockSetUnits(...a), setShowGroceryListQuantities: (...a: unknown[]) => mockSetQuantities(...a),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; } }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", card: "#eee", border: { default: "#ddd", strong: "#aaa" },
  text: { primary: "#111", secondary: "#555", tertiary: "#777" },
} }) }));

import SettingsScreen from "@/app/settings";

describe("settings screen", () => {
  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, "alert").mockImplementation(() => {}); jest.spyOn(console, "log").mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ signOut: mockSignOut, session: { user: { id: "u1", email: "ada@example.com", user_metadata: { name: "Ada" } } } });
    mockUseProfile.mockReturnValue({ data: { id: "u1", full_name: "Ada Farmer", username: "ada", avatar_url: null } });
    mockGetUnits.mockResolvedValue(false); mockGetQuantities.mockResolvedValue(true); mockSetUnits.mockResolvedValue(undefined); mockSetQuantities.mockResolvedValue(undefined);
    mockHaptic.mockResolvedValue(undefined); mockSignOut.mockResolvedValue(null);
  });

  it("loads preferences and renders profile fallbacks", async () => {
    const screen = await render(<SettingsScreen />);
    expect(screen.getByText("AF")).toBeTruthy(); expect(screen.getByText("Ada Farmer")).toBeTruthy(); expect(screen.getByText("@ada")).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("Show units").props.value).toBe(false));
    expect(screen.getByLabelText("Show quantities").props.value).toBe(true);
  });

  it("renders an avatar and metadata display without username", async () => {
    mockUseProfile.mockReturnValue({ data: null });
    mockUseAuth.mockReturnValue({ signOut: mockSignOut, session: { user: { email: "user@example.com", user_metadata: { full_name: "Metadata Name" } } } });
    const screen = await render(<SettingsScreen />);
    expect(screen.getByText("Metadata Name")).toBeTruthy(); expect(screen.queryByText(/^@/)).toBeNull();
  });

  it("navigates back and to edit profile with haptics", async () => {
    const screen = await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText("Go back")); await fireEvent.press(screen.getByLabelText("Edit profile"));
    expect(mockBack).toHaveBeenCalled(); expect(mockPush).toHaveBeenCalledWith("/edit-profile");
    expect(mockHaptic).toHaveBeenCalledTimes(2);
  });

  it("persists preference toggles and rolls each back on failure", async () => {
    const screen = await render(<SettingsScreen />);
    await waitFor(() => expect(screen.getByLabelText("Show units").props.value).toBe(false));
    await fireEvent(screen.getByLabelText("Show units"), "valueChange", true);
    expect(mockSetUnits).toHaveBeenCalledWith(true);
    mockSetUnits.mockRejectedValueOnce(new Error("storage"));
    await fireEvent(screen.getByLabelText("Show units"), "valueChange", false);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Setting not saved", "Please try again."));
    mockSetQuantities.mockRejectedValueOnce(new Error("storage"));
    await fireEvent(screen.getByLabelText("Show quantities"), "valueChange", false);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
  });

  it("ignores preference loading failures", async () => {
    mockGetUnits.mockRejectedValue(new Error("storage"));
    const screen = await render(<SettingsScreen />);
    expect(screen.getByLabelText("Show units").props.value).toBe(true);
  });

  it("confirms logout, reports failure, and redirects on success", async () => {
    const screen = await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText("Log out"));
    let buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    expect(buttons[0]).toEqual(expect.objectContaining({ text: "Cancel", style: "cancel" }));
    mockSignOut.mockResolvedValueOnce("Server error"); await buttons[1].onPress();
    expect(Alert.alert).toHaveBeenCalledWith("Unable to log out", "Server error");
    await fireEvent.press(screen.getByLabelText("Log out")); buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    mockSignOut.mockResolvedValueOnce(null); await buttons[1].onPress();
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("shows delete confirmation and runs its destructive callback", async () => {
    const screen = await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText("Delete Account"));
    const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
    buttons[1].onPress();
    expect(console.log).toHaveBeenCalledWith("Delete account");
  });
});
