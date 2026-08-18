import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

const mockOpenBrowserAsync = jest.fn();
const mockImpactAsync = jest.fn();

jest.mock("expo-router", () => ({
  Link: ({ children, onPress, ...props }: any) => {
    const { Text } = require("react-native");
    return <Text {...props} onPress={onPress}>{children}</Text>;
  },
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  WebBrowserPresentationStyle: { AUTOMATIC: "automatic" },
}));
jest.mock("expo-haptics", () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: "light" },
}));
jest.mock("@react-navigation/elements", () => ({
  PlatformPressable: ({ children, onPressIn, ...props }: any) => {
    const { Pressable } = require("react-native");
    return <Pressable {...props} onPressIn={onPressIn}>{children}</Pressable>;
  },
}));
jest.mock("react-native-reanimated", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: { Text } };
});
jest.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: "IconSymbol" }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: jest.fn(() => "light") }));

import { ExternalLink } from "@/components/external-link";
import { HapticTab } from "@/components/haptic-tab";
import { HelloWave } from "@/components/hello-wave";
import { Collapsible } from "@/components/ui/collapsible";

describe("small shared components", () => {
  const previousExpoOS = process.env.EXPO_OS;
  afterAll(() => { process.env.EXPO_OS = previousExpoOS; });
  beforeEach(() => jest.clearAllMocks());

  it("opens external links inside the native browser", async () => {
    process.env.EXPO_OS = "ios";
    const screen = await render(<ExternalLink href="https://example.test">Docs</ExternalLink>);
    const preventDefault = jest.fn();
    fireEvent(screen.getByText("Docs"), "press", { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(mockOpenBrowserAsync).toHaveBeenCalledWith("https://example.test", { presentationStyle: "automatic" });
  });

  it("runs iOS tab haptics and forwards press-in", async () => {
    process.env.EXPO_OS = "ios";
    const onPressIn = jest.fn();
    const screen = await render(React.createElement(HapticTab, { onPressIn, testID: "tab" } as any));
    fireEvent(screen.getByTestId("tab"), "pressIn", { nativeEvent: {} });
    expect(mockImpactAsync).toHaveBeenCalledWith("light");
    expect(onPressIn).toHaveBeenCalled();
  });

  it("renders the animated hello wave", async () => {
    const screen = await render(<HelloWave />);
    expect(screen.getByText("👋")).toBeTruthy();
  });

  it("opens and closes collapsible content", async () => {
    const screen = await render(<Collapsible title="Details"><Text>Hidden value</Text></Collapsible>);
    expect(screen.queryByText("Hidden value")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Details" }));
    await waitFor(() => expect(screen.getByText("Hidden value")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Details" }));
    await waitFor(() => expect(screen.queryByText("Hidden value")).toBeNull());
  });
});
