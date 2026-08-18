import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockParams = jest.fn();
const mockUseOnboarding = jest.fn();

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: any) => <View testID="stack">{children}</View>;
  Stack.Screen = ({ name }: any) => <View testID={`screen-${name}`} />;
  return {
    Stack,
    Redirect: ({ href }: any) => <View testID="redirect" accessibilityLabel={String(href)} />,
    router: {
      replace: (...args: unknown[]) => mockReplace(...args),
      push: (...args: unknown[]) => mockPush(...args),
      back: (...args: unknown[]) => mockBack(...args),
    },
    useLocalSearchParams: () => mockParams(),
  };
});
jest.mock("@/context/onboarding-context", () => ({
  OnboardingProvider: ({ children }: any) => {
    const React = require("react"); const { View } = require("react-native");
    return <View testID="onboarding-provider">{children}</View>;
  },
  useOnboarding: () => mockUseOnboarding(),
}));
jest.mock("@/components/onboarding/screen", () => ({
  OnboardingScreen: ({ title, children, next, back, error }: any) => {
    const React = require("react"); const { View, Text, Pressable } = require("react-native");
    return <View>
      <Text>{title}</Text>{children}{error ? <Text>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} />
      <Pressable accessibilityRole="button" accessibilityLabel="Next" onPress={next} />
    </View>;
  },
  onboardingStyles: { choices: {}, choice: {}, choiceActive: {}, choiceText: {} },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const React = require("react"); const { View } = require("react-native");
    return <View {...props}>{children}</View>;
  },
}));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => ({ colors: {
  background: "#fff", border: { light: "#ddd" }, text: { primary: "#111", secondary: "#555", tertiary: "#777" }, input: { background: "#eee" },
} }) }));

import AuthLayout from "@/app/(auth)/_layout";
import OnboardingLayout from "@/app/(onboarding)/_layout";
import OnboardingIndex from "@/app/(onboarding)/index";
import GoalsStep from "@/app/(onboarding)/goals";
import InterestsStep from "@/app/(onboarding)/interests";
import ProfileLayout from "@/app/(profile)/_layout";
import CreateScreen from "@/app/(tabs)/create";
import Index from "@/app/index";

describe("basic route layouts and redirects", () => {
  beforeEach(() => { jest.clearAllMocks(); mockParams.mockReturnValue({}); });

  it("declares auth screens", async () => {
    const screen = await render(<AuthLayout />);
    expect(screen.getByTestId("screen-login")).toBeTruthy();
    expect(screen.getByTestId("screen-signup")).toBeTruthy();
  });

  it("wraps onboarding routes in their provider", async () => {
    const screen = await render(<OnboardingLayout />);
    expect(screen.getByTestId("onboarding-provider")).toBeTruthy();
    expect(screen.getByTestId("stack")).toBeTruthy();
  });

  it("declares profile stack screens", async () => {
    const screen = await render(<ProfileLayout />);
    for (const name of ["addfriends", "followers", "following"]) expect(screen.getByTestId(`screen-${name}`)).toBeTruthy();
  });

  it("redirects onboarding index to profile", async () => {
    const screen = await render(<OnboardingIndex />);
    expect(screen.getByTestId("redirect").props.accessibilityLabel).toBe("/(onboarding)/profile");
  });

  it("resolves the root loading state and redirects signed-out users", async () => {
    const screen = await render(<Index />);
    await waitFor(() => expect(screen.getByTestId("redirect")).toBeTruthy());
    expect(screen.getByTestId("redirect").props.accessibilityLabel).toBe("/(auth)/login");
  });
});

describe("onboarding choice routes", () => {
  const update = jest.fn();
  beforeEach(() => { jest.clearAllMocks(); });

  it("validates, selects, removes, navigates, and goes back from goals", async () => {
    const draft = { goals: [] as string[], produce: [] as string[] };
    mockUseOnboarding.mockReturnValue({ draft, update });
    const screen = await render(<GoalsStep />);
    await fireEvent.press(screen.getByLabelText("Next"));
    expect(screen.getByText("Select at least one goal.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Discover nearby farms"));
    expect(update).toHaveBeenCalledWith({ goals: ["discover_farms"] });
    draft.goals = ["discover_farms"];
    await screen.rerender(<GoalsStep />);
    await fireEvent.press(screen.getByText("Discover nearby farms"));
    expect(update).toHaveBeenLastCalledWith({ goals: [] });
    await fireEvent.press(screen.getByLabelText("Next"));
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/interests");
    await fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/location");
  });

  it("validates, selects, removes, navigates, and goes back from interests", async () => {
    const draft = { goals: [], produce: [] as string[] };
    mockUseOnboarding.mockReturnValue({ draft, update });
    const screen = await render(<InterestsStep />);
    await fireEvent.press(screen.getByLabelText("Next"));
    expect(screen.getByText("Select at least one interest.")).toBeTruthy();
    await fireEvent.press(screen.getByText("Vegetables"));
    expect(update).toHaveBeenCalledWith({ produce: ["vegetables"] });
    draft.produce = ["vegetables"];
    await screen.rerender(<InterestsStep />);
    await fireEvent.press(screen.getByText("Vegetables"));
    expect(update).toHaveBeenLastCalledWith({ produce: [] });
    await fireEvent.press(screen.getByLabelText("Next"));
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/photo");
    await fireEvent.press(screen.getByLabelText("Back"));
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/goals");
  });
});

describe("create route", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [{ type: "recipe" }, "Recipe"],
    [{ type: "grocery" }, "Grocery List"],
    [{ type: "other" }, "Choose what you want to create"],
  ])("shows the selected create type", async (params, label) => {
    mockParams.mockReturnValue(params);
    const screen = await render(<CreateScreen />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("navigates back and to both create destinations", async () => {
    mockParams.mockReturnValue({});
    const screen = await render(<CreateScreen />);
    await fireEvent.press(screen.getByText("New Recipe"));
    await fireEvent.press(screen.getByText("New Grocery List"));
    expect(mockPush.mock.calls).toEqual([["/recipe/new"], ["/grocery-list/new"]]);
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockBack).toHaveBeenCalled();
  });
});
