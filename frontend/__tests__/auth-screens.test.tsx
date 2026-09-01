import React from "react";
import { Keyboard } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn(), mockPush = jest.fn();
const mockSignIn = jest.fn(), mockSignUp = jest.fn(), mockGoogle = jest.fn();
const mockKeyboardListeners: Record<string, () => void> = {};
const mockKeyboardRemovers: jest.Mock[] = [];

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({
  signInWithPassword: (...a: unknown[]) => mockSignIn(...a),
  signUpWithPassword: (...a: unknown[]) => mockSignUp(...a),
  signInWithGoogle: (...a: unknown[]) => mockGoogle(...a),
}) }));
jest.mock("@/components/ui/input", () => ({ Input: (props: any) => { const React = require("react"); const { TextInput } = require("react-native"); return <TextInput {...props} />; } }));
jest.mock("@/components/ui/button", () => ({ Button: ({ children, onPress }: any) => { const React = require("react"); const { Pressable, Text } = require("react-native"); return <Pressable accessibilityRole="button" onPress={onPress}><Text>{children}</Text></Pressable>; } }));
jest.mock("@/components/ui/typography", () => {
  const React = require("react"); const { Text } = require("react-native");
  const T = ({ children, ...props }: any) => <Text {...props}>{children}</Text>;
  return { Typography: { H2: T, H5: T } };
});
jest.mock("@/assets/images/art_login.svg", () => () => { const React = require("react"); const { View } = require("react-native"); return <View testID="login-art" />; });
jest.mock("@/assets/images/art_signup.svg", () => () => { const React = require("react"); const { View } = require("react-native"); return <View testID="signup-art" />; });
jest.mock("@expo/vector-icons", () => ({ AntDesign: "AntDesign" }));
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: { View }, FadeInUp: { delay: (value: number) => value } };
});
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; } }));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", card: "#eee", border: { default: "#ddd" },
  text: { primary: "#111", secondary: "#555", tertiary: "#777" },
} }) }));

import Login from "@/app/(auth)/login";
import SignUp from "@/app/(auth)/signup";

describe("authentication screens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockKeyboardListeners).forEach((key) => delete mockKeyboardListeners[key]);
    mockKeyboardRemovers.length = 0;
    jest.spyOn(Keyboard, "addListener").mockImplementation((event: any, callback: any) => {
      mockKeyboardListeners[event] = callback;
      const remove = jest.fn(); mockKeyboardRemovers.push(remove);
      return { remove } as any;
    });
    jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
    global.alert = jest.fn();
    mockSignIn.mockResolvedValue(null); mockSignUp.mockResolvedValue(null); mockGoogle.mockResolvedValue(null);
  });

  it("validates login, reports auth errors, succeeds, and submits from password", async () => {
    const screen = await render(<Login />);
    await fireEvent.press(screen.getByText("Log in"));
    expect(global.alert).toHaveBeenCalledWith("Please fill in all fields");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "ada@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "secret");
    mockSignIn.mockResolvedValueOnce("Invalid login");
    await fireEvent.press(screen.getByText("Log in"));
    await waitFor(() => expect(global.alert).toHaveBeenCalledWith("Invalid login"));
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent(screen.getByPlaceholderText("Password"), "submitEditing");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(mockSignIn).toHaveBeenLastCalledWith("ada@example.com", "secret");
  });

  it("handles Google login and opens signup", async () => {
    const screen = await render(<Login />);
    mockGoogle.mockResolvedValueOnce("Google failed");
    await fireEvent.press(screen.getByText("Sign in with Google"));
    expect(global.alert).toHaveBeenCalledWith("Google failed");
    mockGoogle.mockResolvedValueOnce(null);
    await fireEvent.press(screen.getByText("Sign in with Google"));
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Create an account"));
    expect(mockPush).toHaveBeenCalledWith("/(auth)/signup");
  });

  it("reacts to keyboard visibility and removes listeners on login unmount", async () => {
    const screen = await render(<Login />);
    expect(screen.getByTestId("login-art")).toBeTruthy();
    await act(async () => mockKeyboardListeners.keyboardDidShow());
    await waitFor(() => expect(screen.queryByTestId("login-art")).toBeNull());
    await act(async () => mockKeyboardListeners.keyboardDidHide());
    await waitFor(() => expect(screen.getByTestId("login-art")).toBeTruthy());
    await screen.unmount();
    expect(mockKeyboardRemovers.every((remove) => remove.mock.calls.length === 1)).toBe(true);
  });

  it("validates signup, reports errors, succeeds, and submits from username", async () => {
    const screen = await render(<SignUp />);
    await fireEvent.press(screen.getByText("Sign Up"));
    expect(global.alert).toHaveBeenCalledWith("Please fill in all fields");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "ada@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "secret");
    await fireEvent.changeText(screen.getByPlaceholderText("Full Name"), "Ada Farmer");
    await fireEvent.changeText(screen.getByPlaceholderText("Username"), "ada");
    mockSignUp.mockResolvedValueOnce("Username taken");
    await fireEvent.press(screen.getByText("Sign Up"));
    await waitFor(() => expect(global.alert).toHaveBeenCalledWith("Username taken"));
    await fireEvent(screen.getByPlaceholderText("Username"), "submitEditing");
    await waitFor(() => expect(global.alert).toHaveBeenCalledWith("Check your email to confirm your account."));
    expect(mockSignUp).toHaveBeenLastCalledWith("ada@example.com", "secret", { name: "Ada Farmer", username: "ada" });
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("handles Google signup, login navigation, and keyboard lifecycle", async () => {
    const screen = await render(<SignUp />);
    expect(screen.getByTestId("signup-art")).toBeTruthy();
    mockGoogle.mockResolvedValueOnce("No Google");
    await fireEvent.press(screen.getByText("Sign up with Google"));
    expect(global.alert).toHaveBeenCalledWith("No Google");
    await fireEvent.press(screen.getByText("Sign up with Google"));
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Log in"));
    expect(mockPush).toHaveBeenCalledWith("/(auth)/login");
    await act(async () => mockKeyboardListeners.keyboardDidShow());
    await waitFor(() => expect(screen.queryByTestId("signup-art")).toBeNull());
    await act(async () => mockKeyboardListeners.keyboardDidHide());
    await waitFor(() => expect(screen.getByTestId("signup-art")).toBeTruthy());
    await screen.unmount();
    expect(mockKeyboardRemovers.every((remove) => remove.mock.calls.length === 1)).toBe(true);
  });
});
