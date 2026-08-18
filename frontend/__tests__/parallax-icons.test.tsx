import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

const mockColorScheme = jest.fn();
const mockThemeColor = jest.fn();
const mockInterpolate = jest.fn();
const mockOffset = { value: 0 };
const mockMaterialIcons = jest.fn((_props: unknown) => null);
const mockSymbolView = jest.fn((_props: unknown) => null);

jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => mockColorScheme() }));
jest.mock("@/hooks/use-theme-color", () => ({ useThemeColor: (...a: unknown[]) => mockThemeColor(...a) }));
jest.mock("react-native-reanimated", () => {
  const React = require("react"); const { ScrollView, View } = require("react-native");
  return {
    __esModule: true,
    default: { ScrollView, View },
    interpolate: (...a: unknown[]) => mockInterpolate(...a),
    useAnimatedRef: () => ({ current: null }),
    useScrollOffset: () => mockOffset,
    useAnimatedStyle: (fn: () => unknown) => fn(),
  };
});
jest.mock("@expo/vector-icons/MaterialIcons", () => ({ __esModule: true, default: (props: unknown) => mockMaterialIcons(props) }));
jest.mock("expo-symbols", () => ({ SymbolView: (props: unknown) => mockSymbolView(props) }));

import ParallaxScrollView from "@/components/parallax-scroll-view";
const { IconSymbol: MaterialIconSymbol } = require("../components/ui/icon-symbol.tsx") as typeof import("../components/ui/icon-symbol");
import { IconSymbol as IOSIconSymbol } from "@/components/ui/icon-symbol.ios";

describe("parallax and platform icons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockThemeColor.mockReturnValue("#fff");
    mockColorScheme.mockReturnValue("light");
    mockInterpolate.mockImplementation((_value, _input, output) => output[1]);
  });

  it.each(["light", "dark", null])("renders parallax content for %s scheme", async (scheme) => {
    mockColorScheme.mockReturnValue(scheme);
    const screen = await render(<ParallaxScrollView
      headerImage={<Text>Header image</Text>}
      headerBackgroundColor={{ light: "white", dark: "black" }}
    ><Text>Content</Text></ParallaxScrollView>);
    expect(screen.getByText("Header image")).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();
    expect(mockThemeColor).toHaveBeenCalledWith({}, "background");
    expect(mockInterpolate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["house.fill", "home"], ["paperplane.fill", "send"],
    ["chevron.left.forwardslash.chevron.right", "code"], ["chevron.right", "chevron-right"],
  ])("maps %s to Material icon %s", async (name, mapped) => {
    await render(<MaterialIconSymbol name={name as any} color="red" size={30} style={{ opacity: 0.5 }} />);
    expect(mockMaterialIcons).toHaveBeenCalledWith({ color: "red", size: 30, name: mapped, style: { opacity: 0.5 } });
  });

  it("uses the default Material icon size", async () => {
    await render(<MaterialIconSymbol name="house.fill" color="blue" />);
    expect(mockMaterialIcons).toHaveBeenCalledWith(expect.objectContaining({ size: 24 }));
  });

  it("forwards defaults and custom properties to the native symbol", async () => {
    await render(<IOSIconSymbol name="heart.fill" color="red" />);
    expect(mockSymbolView).toHaveBeenCalledWith(expect.objectContaining({ weight: "regular", tintColor: "red", name: "heart.fill", style: [{ width: 24, height: 24 }, undefined] }));
    await render(<IOSIconSymbol name="star.fill" color="gold" size={32} weight="bold" style={{ opacity: 0.8 }} />);
    expect(mockSymbolView).toHaveBeenLastCalledWith(expect.objectContaining({ weight: "bold", tintColor: "gold", name: "star.fill", style: [{ width: 32, height: 32 }, { opacity: 0.8 }] }));
  });
});
