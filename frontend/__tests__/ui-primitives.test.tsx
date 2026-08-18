import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const mockUseTheme = jest.fn(() => ({
  isDark: false,
  colors: { text: { primary: "black", secondary: "gray", tertiary: "silver" }, background: "white" },
}));
jest.mock("@/hooks/useTheme", () => ({ useTheme: () => mockUseTheme() }));
jest.mock("@/hooks/use-theme-color", () => ({ useThemeColor: () => "papayawhip" }));

describe("UI primitives", () => {
  test.each(["primary", "secondary", "outline", "tertiary"] as const)("renders and presses %s buttons", async (variant) => {
    const onPress = jest.fn();
    const view = await render(<Button variant={variant} size="sm" onPress={onPress}>Continue</Button>);
    fireEvent.press(view.getByText("Continue"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  test.each(["sm", "md", "lg"] as const)("renders %s button sizes", async (size) => expect((await render(<Button size={size}>Size</Button>)).getByText("Size")).toBeTruthy());
  test("renders input label, value changes, and error", async () => {
    const onChangeText = jest.fn();
    const view = await render(<Input label="Username" error="Required" value="a" onChangeText={onChangeText} />);
    fireEvent.changeText(view.getByDisplayValue("a"), "ada");
    expect(view.getByText("Username")).toBeTruthy(); expect(view.getByText("Required")).toBeTruthy(); expect(onChangeText).toHaveBeenCalledWith("ada");
  });
  test("renders input without optional labels", async () => expect((await render(<Input placeholder="Name" />)).getByPlaceholderText("Name")).toBeTruthy());
  test.each(Object.entries(Typography))("renders Typography.%s", async (name, Component) => {
    const C = Component as React.ComponentType<any>;
    expect((await render(<C color="purple" className="copy">{name}</C>)).getByText(name)).toBeTruthy();
  });
  test.each(["default", "title", "defaultSemiBold", "subtitle", "link"] as const)("renders themed text type %s", async (type) => expect((await render(<ThemedText type={type}>{type}</ThemedText>)).getByText(type)).toBeTruthy());
  test("uses light and dark custom text colors", async () => {
    const first = await render(<ThemedText lightColor="red" darkColor="blue">custom</ThemedText>); expect(first.getByText("custom")).toBeTruthy(); await first.unmount();
    mockUseTheme.mockReturnValueOnce({ isDark: true, colors: { text: { primary: "black", secondary: "gray", tertiary: "silver" }, background: "white" } });
    expect((await render(<ThemedText lightColor="red" darkColor="blue">dark</ThemedText>)).getByText("dark")).toBeTruthy();
  });
  test("renders themed view children", async () => expect((await render(<ThemedView><ThemedText>inside</ThemedText></ThemedView>)).getByText("inside")).toBeTruthy());
});
