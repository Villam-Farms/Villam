import React from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn(), mockUseOnboarding = jest.fn(), mockUseAuth = jest.fn();
const mockDebugLog = jest.fn(), mockSetQueryData = jest.fn(), mockInvalidate = jest.fn();
const mockComplete = jest.fn(), mockUploadAvatar = jest.fn();
const mockCameraPermission = jest.fn(), mockLibraryPermission = jest.fn();
const mockLaunchCamera = jest.fn(), mockLaunchLibrary = jest.fn();
const mockLocationPermission = jest.fn(), mockPosition = jest.fn(), mockReverseGeocode = jest.fn();

jest.mock("expo-router", () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock("@/context/onboarding-context", () => ({ useOnboarding: () => mockUseOnboarding() }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/lib/debug-log", () => ({ debugLog: (...a: unknown[]) => mockDebugLog(...a) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ setQueryData: mockSetQueryData, invalidateQueries: mockInvalidate }) }));
jest.mock("@/lib/follows", () => ({
  completeOnboarding: (...a: unknown[]) => mockComplete(...a), uploadMyAvatar: (...a: unknown[]) => mockUploadAvatar(...a),
}));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: () => mockCameraPermission(), requestMediaLibraryPermissionsAsync: () => mockLibraryPermission(),
  launchCameraAsync: (...a: unknown[]) => mockLaunchCamera(...a), launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
}));
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: () => mockLocationPermission(), getCurrentPositionAsync: (...a: unknown[]) => mockPosition(...a),
  reverseGeocodeAsync: (...a: unknown[]) => mockReverseGeocode(...a),
}));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("@/components/ui/input", () => ({ Input: ({ label, ...props }: any) => { const React = require("react"); const { View, Text, TextInput } = require("react-native"); return <View><Text>{label}</Text><TextInput accessibilityLabel={label} {...props} /></View>; } }));
jest.mock("@/components/ui/button", () => ({ Button: ({ children, onPress }: any) => { const React = require("react"); const { Pressable, Text } = require("react-native"); return <Pressable accessibilityRole="button" onPress={onPress}><Text>{children}</Text></Pressable>; } }));
jest.mock("@/components/onboarding/screen", () => ({
  OnboardingScreen: ({ title, children, next, back, error, nextLabel = "Continue", disabled }: any) => { const React = require("react"); const { View, Text, Pressable } = require("react-native"); return <View>
    <Text>{title}</Text>{children}{error ? <Text>{error}</Text> : null}
    {back ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} /> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} disabled={disabled} onPress={next} />
  </View>; },
  onboardingStyles: { photo: {}, image: {} },
}));

import ProfileStep from "@/app/(onboarding)/profile";
import LocationStep from "@/app/(onboarding)/location";
import PhotoStep from "@/app/(onboarding)/photo";

const baseDraft = { fullName: "Ada Farmer", username: "ada", city: "Oakland", region: "CA", goals: ["support_local"], produce: ["fruits"], photoUri: "", photoRemoteUrl: "" };

describe("profile onboarding step", () => {
  const update = jest.fn();
  beforeEach(() => { jest.clearAllMocks(); mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft }, update }); });

  it("validates the display name and username", async () => {
    mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft, fullName: " " }, update });
    let screen = await render(<ProfileStep />);
    await fireEvent.press(screen.getByLabelText("Continue"));
    expect(screen.getByText("Enter your display name.")).toBeTruthy();
    await screen.unmount();
    mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft, username: "A!" }, update });
    screen = await render(<ProfileStep />);
    await fireEvent.press(screen.getByLabelText("Continue"));
    expect(screen.getByText(/Username must use/)).toBeTruthy();
  });

  it("sanitizes edits, clears errors, normalizes, and advances", async () => {
    const screen = await render(<ProfileStep />);
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Ada B");
    expect(update).toHaveBeenCalledWith({ fullName: "Ada B" });
    await fireEvent.changeText(screen.getByLabelText("Username"), "Ada-B!_2");
    expect(update).toHaveBeenCalledWith({ username: "adab_2" });
    await fireEvent.press(screen.getByLabelText("Continue"));
    expect(update).toHaveBeenCalledWith({ username: "ada" });
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/location");
    expect(mockDebugLog).toHaveBeenCalledWith(expect.objectContaining({ message: "profile calling router.replace to location" }));
  });
});

describe("location onboarding step", () => {
  const update = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, "alert").mockImplementation(() => {}); jest.spyOn(console, "log").mockImplementation(() => {});
    mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft }, update });
    mockLocationPermission.mockResolvedValue({ status: "granted" });
    mockPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    mockReverseGeocode.mockResolvedValue([{ city: "Berkeley", region: "CA" }]);
  });

  it("edits, validates, advances, and goes back", async () => {
    const draft = { ...baseDraft, city: "", region: "" }; mockUseOnboarding.mockReturnValue({ draft, update });
    const screen = await render(<LocationStep />);
    await fireEvent.changeText(screen.getByLabelText("City"), "Oakland"); expect(update).toHaveBeenCalledWith({ city: "Oakland" });
    await fireEvent.changeText(screen.getByLabelText("State or region"), "CA"); expect(update).toHaveBeenCalledWith({ region: "CA" });
    await fireEvent.press(screen.getByLabelText("Continue")); expect(screen.getByText("Enter both your city and region.")).toBeTruthy();
    draft.city = "Oakland"; draft.region = "CA"; await screen.rerender(<LocationStep />);
    await fireEvent.press(screen.getByLabelText("Continue")); expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/goals");
    await fireEvent.press(screen.getByLabelText("Back")); expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/profile");
  });

  it("auto-fills location and handles permission and geocode failures", async () => {
    let screen = await render(<LocationStep />);
    await fireEvent.press(screen.getByText("Use my current location"));
    await waitFor(() => expect(update).toHaveBeenCalledWith({ city: "Berkeley", region: "CA" }));
    await screen.unmount();
    mockLocationPermission.mockResolvedValue({ status: "denied" });
    screen = await render(<LocationStep />); await fireEvent.press(screen.getByText("Use my current location"));
    expect(Alert.alert).toHaveBeenCalledWith("Location permission needed", expect.any(String));
    await screen.unmount();
    mockLocationPermission.mockResolvedValue({ status: "granted" }); mockReverseGeocode.mockResolvedValue([{ city: null, region: "CA" }]);
    screen = await render(<LocationStep />); await fireEvent.press(screen.getByText("Use my current location"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Location unavailable", expect.any(String)));
  });
});

describe("photo onboarding step", () => {
  const update = jest.fn(), clear = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft }, update, clear });
    mockUseAuth.mockReturnValue({ session: { access_token: "token", user: { id: "u1" } } });
    mockCameraPermission.mockResolvedValue({ granted: true }); mockLibraryPermission.mockResolvedValue({ granted: true });
    mockLaunchCamera.mockResolvedValue({ canceled: false, assets: [{ uri: "camera.jpg" }] });
    mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: "library.jpg" }] });
    mockInvalidate.mockResolvedValue(undefined); clear.mockResolvedValue(undefined);
  });

  it("chooses library/camera photos and handles permission or cancellation", async () => {
    let screen = await render(<PhotoStep />);
    expect(screen.getByText("Add photo")).toBeTruthy();
    await fireEvent.press(screen.getByText("Choose from library"));
    expect(update).toHaveBeenCalledWith({ photoUri: "library.jpg", photoRemoteUrl: "" });
    await fireEvent.press(screen.getByText("Take a photo"));
    expect(update).toHaveBeenCalledWith({ photoUri: "camera.jpg", photoRemoteUrl: "" });
    mockCameraPermission.mockResolvedValue({ granted: false });
    await fireEvent.press(screen.getByText("Take a photo"));
    expect(Alert.alert).toHaveBeenCalledWith("Permission needed", "Allow access to add your photo.");
    mockLibraryPermission.mockResolvedValue({ granted: true }); mockLaunchLibrary.mockResolvedValue({ canceled: true });
    await fireEvent.press(screen.getByText("Choose from library"));
  });

  it("requires authentication and a photo", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    let screen = await render(<PhotoStep />); await fireEvent.press(screen.getByLabelText("Finish"));
    expect(screen.getByText("Unable to complete onboarding. Please sign in again.")).toBeTruthy();
    await screen.unmount();
    mockUseAuth.mockReturnValue({ session: { access_token: "token", user: { id: "u1" } } });
    screen = await render(<PhotoStep />); await fireEvent.press(screen.getByLabelText("Finish"));
    expect(screen.getByText("Add a profile photo.")).toBeTruthy();
  });

  it("uploads a local avatar, completes onboarding, caches, clears, and advances", async () => {
    mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft, photoUri: "local.jpg" }, update, clear });
    mockUploadAvatar.mockResolvedValue({ profile: { avatar_url: "remote.jpg" } });
    mockComplete.mockResolvedValue({ profile: { id: "u1", username: "ada" } });
    const screen = await render(<PhotoStep />);
    await fireEvent.press(screen.getByLabelText("Finish"));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith("token", expect.objectContaining({ avatar_url: "remote.jpg", full_name: "Ada Farmer", username: "ada" })));
    expect(mockSetQueryData).toHaveBeenCalledWith(["me", "u1"], expect.objectContaining({ id: "u1" }));
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["me", "u1"], refetchType: "active" });
    expect(clear).toHaveBeenCalled(); expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("uses a remote avatar and handles username and generic failures", async () => {
    mockUseOnboarding.mockReturnValue({ draft: { ...baseDraft, photoRemoteUrl: "remote.jpg" }, update, clear });
    mockComplete.mockRejectedValueOnce(new Error("Username already exists"));
    let screen = await render(<PhotoStep />); await fireEvent.press(screen.getByLabelText("Finish"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Username unavailable", "Username already exists"));
    expect(mockReplace).toHaveBeenCalledWith("/(onboarding)/profile");
    await screen.unmount();
    mockComplete.mockRejectedValueOnce("bad");
    screen = await render(<PhotoStep />); await fireEvent.press(screen.getByLabelText("Finish"));
    await waitFor(() => expect(screen.getByText("Please try again")).toBeTruthy());
  });
});
