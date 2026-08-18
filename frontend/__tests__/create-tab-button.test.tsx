import React from "react";
import { Animated, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

const mockNavigate = jest.fn();
const mockImpactAsync = jest.fn();
const mockUseTheme = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }) }));
jest.mock("expo-haptics", () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("@react-navigation/elements", () => ({
  PlatformPressable: ({ children, onPress, ...props }: any) => {
    const { Pressable } = require("react-native");
    return <Pressable {...props} onPress={onPress}>{children}</Pressable>;
  },
}));
jest.mock("@/hooks/useTheme", () => ({
  useTheme: () => mockUseTheme(),
}));

const lightTheme = {
    isDark: false,
    colors: {
      card: "#eee", background: "#fff", border: { strong: "#999", light: "#ddd" },
      text: { primary: "#111", tertiary: "#777" },
    },
};

import { CreateTabButton } from "@/components/create-tab-button";

describe("CreateTabButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockImpactAsync.mockResolvedValue(undefined);
    mockUseTheme.mockReturnValue(lightTheme);
    jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: (callback?: any) => callback?.() } as any));
    jest.spyOn(Animated, "parallel").mockImplementation((animations: any[]) => ({
      start: (callback?: any) => { animations.forEach((animation) => animation.start()); callback?.(); },
    } as any));
  });

  afterEach(() => jest.useRealTimers());

  async function openMenu() {
    const screen = await render(React.createElement(CreateTabButton, {
      testID: "create-tab", children: <Text>Create</Text>,
    } as any));
    await fireEvent.press(screen.getByTestId("create-tab"));
    expect(screen.getByText("Recipe")).toBeTruthy();
    expect(screen.getByText("Grocery List")).toBeTruthy();
    return screen;
  }

  it("opens and closes the create menu from the tab", async () => {
    const screen = await openMenu();
    expect(mockImpactAsync).toHaveBeenCalledWith("light");
    await fireEvent.press(screen.getByTestId("create-tab"));
    expect(screen.queryByText("Recipe")).toBeNull();
  });

  it.each([
    ["Recipe", "/recipe/new"],
    ["Grocery List", "/grocery-list/new"],
  ])("navigates from the %s choice after closing", async (choice, route) => {
    const screen = await openMenu();
    await fireEvent.press(screen.getByText(choice));
    expect(mockImpactAsync).toHaveBeenLastCalledWith("medium");
    jest.advanceTimersByTime(150);
    expect(mockNavigate).toHaveBeenCalledWith(route);
    expect(screen.queryByText("Recipe")).toBeNull();
  });

  it("dismisses through the overlay", async () => {
    const screen = await openMenu();
    await fireEvent.press(screen.getByLabelText("Close create menu"));
    expect(screen.queryByText("Recipe")).toBeNull();
  });

  it("ignores unsupported haptics failures", async () => {
    mockImpactAsync.mockRejectedValue(new Error("unsupported"));
    const screen = await render(React.createElement(CreateTabButton, { testID: "create-tab", children: <Text>Create</Text> } as any));
    await expect(fireEvent.press(screen.getByTestId("create-tab"))).resolves.not.toThrow();
    expect(screen.getByText("Recipe")).toBeTruthy();
  });

  it("renders and operates with dark menu colors", async () => {
    mockUseTheme.mockReturnValue({ ...lightTheme, isDark: true });
    const screen = await openMenu();
    await fireEvent(screen.getByText("Recipe"), "pressIn");
    await fireEvent(screen.getByText("Grocery List"), "pressIn");
    expect(screen.getByText("Create a new recipe")).toBeTruthy();
  });
});
