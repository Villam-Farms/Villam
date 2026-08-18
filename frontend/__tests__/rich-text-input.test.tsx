import React, { createRef } from "react";
import { View } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

const mockInjectJavaScript = jest.fn();
jest.mock("react-native-webview", () => {
  const React = require("react"); const { View } = require("react-native");
  return { WebView: React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: (...a: unknown[]) => mockInjectJavaScript(...a) }));
    return <View testID="webview" {...props} />;
  }) };
});

import RichTextInput, { type RichTextHandle } from "@/components/richtextinput";

describe("RichTextInput", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, "error").mockImplementation(() => {}); });

  it("builds customized editor HTML and forwards each bridge message", async () => {
    const onChangeText = jest.fn(), onFocus = jest.fn(), onBlur = jest.fn(), onSelectionChange = jest.fn();
    const screen = await render(<RichTextInput
      initialValue="<b>Hello</b>" placeholder="Write here" onChangeText={onChangeText}
      onFocus={onFocus} onBlur={onBlur} onSelectionChange={onSelectionChange}
      textColor="#123456" backgroundColor="#abcdef" placeholderColor="#654321" fontSize={20}
    />);
    const webview = screen.getByTestId("webview");
    const html = webview.props.source.html;
    expect(html).toContain("<b>Hello</b>");
    expect(html).toContain('data-placeholder="Write here"');
    expect(html).toContain("font-size: 20px");
    expect(html).toContain("color: #123456");
    expect(html).toContain("background-color: #abcdef");
    expect(html).toContain("color: #654321");

    for (const data of [
      { type: "change", html: "<i>x</i>", text: "x" }, { type: "focus" }, { type: "blur" },
      { type: "selectionChange", styles: { bold: true, italic: false, underline: false } }, { type: "unknown" },
    ]) await fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify(data) } });
    expect(onChangeText).toHaveBeenCalledWith("<i>x</i>", "x");
    expect(onFocus).toHaveBeenCalled(); expect(onBlur).toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenCalledWith({ bold: true, italic: false, underline: false });
  });

  it("uses defaults and tolerates omitted optional callbacks and malformed messages", async () => {
    const screen = await render(<RichTextInput onChangeText={jest.fn()} />);
    const webview = screen.getByTestId("webview");
    expect(webview.props.source.html).toContain("font-size: 16px");
    expect(webview.props.source.html).toContain("color: #000000");
    for (const type of ["focus", "blur", "selectionChange"]) {
      await fireEvent(webview, "message", { nativeEvent: { data: JSON.stringify({ type, styles: {} }) } });
    }
    await fireEvent(webview, "message", { nativeEvent: { data: "not-json" } });
    expect(console.error).toHaveBeenCalledWith("Error parsing message:", expect.any(Error));
  });

  it.each([
    ["focus", "focus()"], ["blur", "blur()"], ["getHTML", "type: 'getHTML'"],
    ["bold", "execCommand('bold'"], ["italic", "execCommand('italic'"], ["underline", "execCommand('underline'"],
  ])("exposes the %s imperative command", async (command, scriptPart) => {
    const ref = createRef<RichTextHandle>();
    await render(<RichTextInput ref={ref} onChangeText={jest.fn()} />);
    if (command === "bold" || command === "italic" || command === "underline") ref.current!.applyStyle(command);
    else ref.current![command as "focus" | "blur" | "getHTML"]();
    expect(mockInjectJavaScript).toHaveBeenCalledWith(expect.stringContaining(scriptPart));
  });
});
