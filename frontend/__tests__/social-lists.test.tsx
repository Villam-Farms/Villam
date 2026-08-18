import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn(), mockPush = jest.fn(), mockUseAuth = jest.fn();
const mockSearch = jest.fn(), mockFollowers = jest.fn(), mockFollowing = jest.fn(), mockFollow = jest.fn(), mockUnfollow = jest.fn();
const mockImpact = jest.fn(), mockNotification = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a) }) }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/lib/follows", () => ({
  searchUsers: (...a: unknown[]) => mockSearch(...a), listFollowers: (...a: unknown[]) => mockFollowers(...a), listFollowing: (...a: unknown[]) => mockFollowing(...a),
  followUser: (...a: unknown[]) => mockFollow(...a), unfollowUser: (...a: unknown[]) => mockUnfollow(...a),
}));
jest.mock("expo-haptics", () => ({
  impactAsync: (...a: unknown[]) => mockImpact(...a), notificationAsync: (...a: unknown[]) => mockNotification(...a),
  ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; } }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", input: { background: "#eee", text: "#111", placeholder: "#888" }, border: { light: "#ddd" },
  text: { primary: "#111", secondary: "#555", tertiary: "#777" },
} }) }));

import AddFriends from "@/app/(profile)/addfriends";
import FollowersScreen from "@/app/(profile)/followers";
import FollowingScreen from "@/app/(profile)/following";

const users = [
  { id: "u2", full_name: "Bob Farmer", username: "bob", avatar_url: "bob.jpg", is_following: false },
  { id: "u3", full_name: null, username: "cara", avatar_url: null, is_following: true },
  { id: "u4", full_name: null, username: null, avatar_url: null, is_following: false },
];

async function flushSearch() {
  await act(async () => { jest.advanceTimersByTime(250); await Promise.resolve(); });
}

describe("social profile lists", () => {
  beforeEach(() => {
    jest.clearAllMocks(); jest.useFakeTimers(); jest.spyOn(Alert, "alert").mockImplementation(() => {}); jest.spyOn(console, "log").mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ session: { access_token: "token" } });
    mockSearch.mockResolvedValue(users); mockFollowers.mockResolvedValue(users); mockFollowing.mockResolvedValue(users);
    mockFollow.mockResolvedValue(undefined); mockUnfollow.mockResolvedValue(undefined); mockImpact.mockResolvedValue(undefined); mockNotification.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it("searches add-friends, opens profiles, follows, unfollows, and navigates back", async () => {
    const screen = await render(<AddFriends />); await flushSearch();
    await waitFor(() => expect(screen.getByText("Bob Farmer")).toBeTruthy());
    expect(screen.getByText("@bob")).toBeTruthy(); expect(screen.getByText("Unknown user")).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith("token", "", 50);
    await fireEvent.changeText(screen.getByPlaceholderText("Search people..."), "  bob  "); await flushSearch();
    expect(mockSearch).toHaveBeenLastCalledWith("token", "bob", 50);
    await fireEvent.press(screen.getByLabelText("Open Bob Farmer"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/user/[id]", params: { id: "u2", from: "addfriends" } });
    await fireEvent.press(screen.getByLabelText("Follow Bob Farmer"));
    await waitFor(() => expect(mockFollow).toHaveBeenCalledWith("token", "u2"));
    expect(mockNotification).toHaveBeenCalledWith("success");
    await fireEvent.press(screen.getByLabelText("Unfollow cara"));
    await waitFor(() => expect(mockUnfollow).toHaveBeenCalledWith("token", "u3"));
    expect(mockImpact).toHaveBeenCalledWith("light");
    await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
  });

  it("lists followers, searches, opens, follows and unfollows", async () => {
    const screen = await render(<FollowersScreen />); await flushSearch();
    await waitFor(() => expect(screen.getByText("Bob Farmer")).toBeTruthy());
    expect(mockFollowers).toHaveBeenCalledWith("token", "", 200);
    await fireEvent.changeText(screen.getByPlaceholderText("Search followers..."), " cara "); await flushSearch();
    expect(mockFollowers).toHaveBeenLastCalledWith("token", "cara", 200);
    await fireEvent.press(screen.getByLabelText("Open Bob Farmer"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/user/[id]", params: { id: "u2", from: "followers" } });
    await fireEvent.press(screen.getByLabelText("Follow Bob Farmer")); await waitFor(() => expect(mockFollow).toHaveBeenCalled());
    await fireEvent.press(screen.getByLabelText("Unfollow cara")); await waitFor(() => expect(mockUnfollow).toHaveBeenCalled());
  });

  it("lists following users and removes an unfollowed user", async () => {
    mockFollowing.mockResolvedValue([{ ...users[1], is_following: true }]);
    const screen = await render(<FollowingScreen />); await flushSearch();
    await waitFor(() => expect(screen.getByText("@cara")).toBeTruthy());
    expect(mockFollowing).toHaveBeenCalledWith("token", "", 200);
    await fireEvent.press(screen.getByLabelText("Open cara"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/user/[id]", params: { id: "u3", from: "following" } });
    await fireEvent.press(screen.getByLabelText("Unfollow cara"));
    await waitFor(() => expect(screen.queryByText("@cara")).toBeNull());
    expect(mockUnfollow).toHaveBeenCalledWith("token", "u3");
    expect(screen.getByText("You’re not following anyone yet.")).toBeTruthy();
  });

  it.each([
    [AddFriends, mockSearch, "Unable to load users"],
    [FollowersScreen, mockFollowers, "Unable to load followers"],
    [FollowingScreen, mockFollowing, "Unable to load following"],
  ])("reports unknown loading failures for %p", async (Component, loader, message) => {
    loader.mockRejectedValueOnce("bad");
    await render(<Component />); await flushSearch();
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Error", message));
  });

  it("reports follow failures and safely renders signed out", async () => {
    mockFollow.mockRejectedValueOnce(new Error("Cannot follow"));
    let screen = await render(<AddFriends />); await flushSearch();
    await waitFor(() => expect(screen.getByLabelText("Follow Bob Farmer")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Follow Bob Farmer"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Error", "Cannot follow"));
    await screen.unmount();
    mockUseAuth.mockReturnValue({ session: null });
    screen = await render(<FollowersScreen />);
    expect(mockFollowers).not.toHaveBeenCalled(); expect(screen.getByText("No followers yet.")).toBeTruthy();
  });
});
