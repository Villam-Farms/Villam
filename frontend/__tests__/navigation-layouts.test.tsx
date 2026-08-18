import React from "react";
import { act, render } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();
const mockUseProfile = jest.fn();
const mockSegments = jest.fn();
const mockHide = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react"); const { View } = require("react-native");
  const Stack = ({ children }: any) => <View testID="stack">{children}</View>;
  Stack.Screen = ({ name }: any) => <View testID={`stack-${name}`} />;
  const Tabs = ({ children }: any) => <View testID="tabs">{children}</View>;
  Tabs.Screen = ({ name, options }: any) => <View testID={`tab-${name}`}>{options?.tabBarIcon?.({ color: "green", focused: false })}{options?.tabBarIcon?.({ color: "green", focused: true })}{options?.tabBarButton?.({})}</View>;
  return { Stack, Tabs, useRouter: () => ({ replace: mockReplace }), useSegments: () => mockSegments() };
});
jest.mock("@/context/auth-context", () => ({ AuthProvider: ({ children }: any) => children, useAuth: () => mockUseAuth() }));
jest.mock("@/hooks/useMyProfile", () => ({ useMyProfile: () => mockUseProfile() }));
jest.mock("@/lib/debug-log", () => ({ debugLog: jest.fn() }));
jest.mock("expo-splash-screen", () => ({ preventAutoHideAsync: jest.fn(), hideAsync: () => mockHide() }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: ({ children }: any) => children }));
jest.mock("@react-navigation/native", () => ({ DarkTheme: {}, DefaultTheme: {}, ThemeProvider: ({ children }: any) => children }));
jest.mock("@tanstack/react-query", () => ({ QueryClient: jest.fn(), QueryClientProvider: ({ children }: any) => children }));
jest.mock("react-native-reanimated", () => ({}));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: { background: "white", border: { light: "gray" } } }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@/components/haptic-tab", () => ({ HapticTab: () => null }));
jest.mock("@/components/create-tab-button", () => ({ CreateTabButton: () => null }));

import RootLayout from "@/app/_layout";
import TabLayout from "@/app/(tabs)/_layout";

const completeProfile = { onboarding_completed_at: "now", username: "u", full_name: "User", avatar_url: "a", location_city: "c", location_region: "r", app_goals: ["g"], produce_interests: ["p"] };

describe("root navigation", () => {
  beforeEach(() => { jest.useFakeTimers(); mockUseAuth.mockReturnValue({ session: null, initialized: true }); mockUseProfile.mockReturnValue({ data: null, isFetching: false }); mockSegments.mockReturnValue(["(tabs)"]); });
  afterEach(() => jest.useRealTimers());

  async function mount() {
    const screen = await render(<RootLayout />);
    await act(async () => { jest.advanceTimersByTime(1000); });
    return screen;
  }

  it("waits for preparation, hides splash, and declares root screens", async () => {
    const screen = await mount();
    expect(mockHide).toHaveBeenCalled();
    for (const name of ["(tabs)", "(auth)", "(onboarding)", "(profile)", "user/[id]", "settings", "edit-profile"]) expect(screen.getByTestId(`stack-${name}`)).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it.each([
    [completeProfile, ["(auth)"], "/(tabs)"],
    [{}, ["(auth)"], "/(onboarding)/profile"],
    [{}, ["(tabs)"], "/(onboarding)/profile"],
  ])("enforces authenticated routing", async (profile, segments, destination) => {
    mockUseAuth.mockReturnValue({ session: { user: { id: "u" } }, initialized: true });
    mockUseProfile.mockReturnValue({ data: profile, isFetching: false });
    mockSegments.mockReturnValue(segments);
    await mount();
    expect(mockReplace).toHaveBeenCalledWith(destination);
  });

  it("does not redirect while authentication is initializing", async () => {
    mockUseAuth.mockReturnValue({ session: null, initialized: false });
    await mount();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

it("declares every primary tab", async () => {
  const screen = await render(<TabLayout />);
  for (const name of ["index", "map", "listings", "create", "grocerylist", "profile"]) expect(screen.getByTestId(`tab-${name}`)).toBeTruthy();
});
