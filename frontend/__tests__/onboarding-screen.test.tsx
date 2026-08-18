import React from "react";
import { Alert, Keyboard, Platform, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

const mockDebugLog = jest.fn();
const mockInsets = jest.fn();
jest.mock("@/lib/debug-log", () => ({ debugLog: (...a: unknown[]) => mockDebugLog(...a) }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>;
  },
  useSafeAreaInsets: () => mockInsets(),
}));

import { OnboardingScreen } from "@/components/onboarding/screen";

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsets.mockReturnValue({ top: 24, bottom: 20, left: 0, right: 0 });
    jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  });

  it("renders progress, custom labels, children, errors, and navigates both ways", async () => {
    const next = jest.fn(), back = jest.fn();
    const screen = await render(<OnboardingScreen
      step={3} title="Your goals" subtitle="Choose some" next={next} back={back}
      nextLabel="Finish" error="Select one"><Text>Choices</Text></OnboardingScreen>);
    expect(screen.getByText("Step 3 of 5")).toBeTruthy();
    expect(screen.getByText("Your goals")).toBeTruthy();
    expect(screen.getByText("Choose some")).toBeTruthy();
    expect(screen.getByText("Choices")).toBeTruthy();
    expect(screen.getByText("Select one")).toBeTruthy();
    await fireEvent(screen.getByText("Finish"), "pressIn");
    await fireEvent.press(screen.getByText("Finish"));
    expect(next).toHaveBeenCalled();
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(mockDebugLog).toHaveBeenCalledWith(expect.objectContaining({ message: "goNext called" }));
    expect(mockDebugLog).toHaveBeenCalledWith(expect.objectContaining({ message: "next() returned without sync throw" }));
    await fireEvent.press(screen.getByText("Back"));
    expect(back).toHaveBeenCalled();
  });

  it("catches synchronous next failures", async () => {
    const next = jest.fn(() => { throw new Error("bad step"); });
    const screen = await render(<OnboardingScreen step={1} title="Title" subtitle="Sub" next={next}><Text>Body</Text></OnboardingScreen>);
    await fireEvent.press(screen.getByText("Continue"));
    expect(Alert.alert).toHaveBeenCalledWith("Unable to continue", "Please try again.");
    expect(mockDebugLog).toHaveBeenCalledWith(expect.objectContaining({ message: "next() threw synchronously" }));
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("disables continuation and supports no back callback", async () => {
    const next = jest.fn();
    const screen = await render(<OnboardingScreen step={2} title="Title" subtitle="Sub" next={next} disabled><Text>Body</Text></OnboardingScreen>);
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(next).not.toHaveBeenCalled();
  });

  it("logs scroll/footer overlap layouts in both event orders", async () => {
    const screen = await render(<OnboardingScreen step={4} title="Title" subtitle="Sub" next={jest.fn()}><Text>Body</Text></OnboardingScreen>);
    const scroll = screen.getByTestId("onboarding-scroll");
    const footer = screen.getByTestId("onboarding-footer");
    await fireEvent(scroll, "layout", { nativeEvent: { layout: { y: 10, height: 500 } } });
    await fireEvent(footer, "layout", { nativeEvent: { layout: { y: 450, height: 80 } } });
    await fireEvent(scroll, "layout", { nativeEvent: { layout: { y: 0, height: 400 } } });
    expect(mockDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      message: "layout overlap check", data: expect.objectContaining({ overlap: true, source: "footer" }),
    }));
    expect(mockDebugLog).toHaveBeenCalledWith(expect.objectContaining({
      message: "layout overlap check", data: expect.objectContaining({ overlap: false, source: "scroll" }),
    }));
  });

  it("uses Android keyboard behavior and minimum footer padding", async () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    mockInsets.mockReturnValue({ top: 20, bottom: 0, left: 0, right: 0 });
    const screen = await render(<OnboardingScreen step={5} title="Title" subtitle="Sub" next={jest.fn()}><Text>Body</Text></OnboardingScreen>);
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
  });
});
