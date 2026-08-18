import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn(), mockUseAuth = jest.fn(), mockUseProfile = jest.fn();
const mockSetQuery = jest.fn(), mockInvalidate = jest.fn(), mockUpdateProfile = jest.fn(), mockUpload = jest.fn();
const mockPermission = jest.fn(), mockLaunch = jest.fn();
jest.mock("expo-router", () => ({ router: { back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/hooks/useMyProfile", () => ({ useMyProfile: () => mockUseProfile() }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ setQueryData: mockSetQuery, invalidateQueries: mockInvalidate }) }));
jest.mock("@/lib/follows", () => ({ updateMyProfile: (...a: unknown[]) => mockUpdateProfile(...a), uploadMyAvatar: (...a: unknown[]) => mockUpload(...a) }));
jest.mock("expo-image-picker", () => ({ requestMediaLibraryPermissionsAsync: () => mockPermission(), launchImageLibraryAsync: (...a: unknown[]) => mockLaunch(...a) }));
jest.mock("expo-image", () => ({ Image: "ExpoImage" }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children, ...props }: any) => { const React = require("react"); const { View } = require("react-native"); return <View {...props}>{children}</View>; } }));
jest.mock("@/components/ui/input", () => ({ Input: ({ label, error, ...props }: any) => { const React = require("react"); const { View, Text, TextInput } = require("react-native"); return <View><Text>{label}</Text><TextInput accessibilityLabel={label} {...props} />{error ? <Text>{error}</Text> : null}</View>; } }));
jest.mock("@/components/ui/button", () => ({ Button: ({ children, onPress, disabled }: any) => { const React = require("react"); const { Pressable, Text } = require("react-native"); return <Pressable accessibilityRole="button" accessibilityLabel={String(children)} disabled={disabled} onPress={onPress}><Text>{children}</Text></Pressable>; } }));

import EditProfileScreen from "@/app/edit-profile";

const profile = { id: "u1", full_name: "Ada Farmer", username: "ada", location_city: "Oakland", location_region: "CA", avatar_url: "avatar.jpg" };

describe("edit profile screen", () => {
  beforeEach(() => {
    jest.clearAllMocks(); jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ session: { access_token: "token", user: { id: "u1" } } });
    mockUseProfile.mockReturnValue({ data: profile });
    mockPermission.mockResolvedValue({ granted: true }); mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: "new.jpg" }] });
    mockUpdateProfile.mockResolvedValue({ profile: { ...profile, full_name: "Updated" } });
    mockUpload.mockResolvedValue({ profile: { ...profile, avatar_url: "new-remote.jpg" } });
    mockInvalidate.mockResolvedValue(undefined);
  });

  it("prefills fields, sanitizes usernames, and navigates back", async () => {
    const screen = await render(<EditProfileScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Ada Farmer")).toBeTruthy());
    expect(screen.getByDisplayValue("Oakland")).toBeTruthy(); expect(screen.getByDisplayValue("CA")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Username"), "Ada-NEW!_2");
    expect(screen.getByDisplayValue("adanew_2")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Go back")); expect(mockBack).toHaveBeenCalled();
  });

  it("chooses a photo and handles denied or canceled selection", async () => {
    let screen = await render(<EditProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Change profile photo"));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith({ allowsEditing: true, aspect: [1, 1], quality: 0.85 }));
    await screen.unmount();
    mockPermission.mockResolvedValue({ granted: false });
    screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Change profile photo"));
    expect(Alert.alert).toHaveBeenCalledWith("Permission needed", "Allow photo access to change your profile picture.");
    await screen.unmount();
    mockPermission.mockResolvedValue({ granted: true }); mockLaunch.mockResolvedValue({ canceled: true, assets: [] });
    screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Change profile photo"));
  });

  it("validates session, required fields, and username", async () => {
    mockUseAuth.mockReturnValue({ session: null });
    let screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Save changes"));
    expect(Alert.alert).toHaveBeenCalledWith("Session expired", "Please sign in again.");
    await screen.unmount();
    mockUseAuth.mockReturnValue({ session: { access_token: "token", user: { id: "u1" } } }); mockUseProfile.mockReturnValue({ data: { ...profile, full_name: "" } });
    screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Save changes"));
    expect(Alert.alert).toHaveBeenCalledWith("Missing information", expect.any(String));
    await screen.unmount();
    mockUseProfile.mockReturnValue({ data: { ...profile, username: "x" } });
    screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Save changes"));
    expect(screen.getByText("Use 3–30 lowercase letters, numbers, or underscores.")).toBeTruthy();
  });

  it("saves trimmed profile data without uploading when photo is unchanged", async () => {
    const screen = await render(<EditProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText("Display name"), " Ada Updated ");
    await fireEvent.press(screen.getByLabelText("Save changes"));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith("token", {
      full_name: "Ada Updated", username: "ada", location_city: "Oakland", location_region: "CA",
    }));
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSetQuery).toHaveBeenCalledWith(["me", "u1"], expect.any(Object));
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["me", "u1"] }); expect(mockBack).toHaveBeenCalled();
  });

  it("uploads a newly selected avatar after profile update", async () => {
    const screen = await render(<EditProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Change profile photo"));
    await fireEvent.press(screen.getByLabelText("Save changes"));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith("token", { uri: "new.jpg", name: "avatar.jpg", type: "image/jpeg" }));
    expect(mockSetQuery).toHaveBeenCalledWith(["me", "u1"], expect.objectContaining({ avatar_url: "new-remote.jpg" }));
  });

  it("shows username errors, generic Error messages, and unknown failures", async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error("Username already taken"));
    let screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Save changes"));
    await waitFor(() => expect(screen.getByText("Username already taken")).toBeTruthy());
    await screen.unmount();
    mockUpdateProfile.mockRejectedValueOnce(new Error("Offline"));
    screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Save changes"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Profile not saved", "Offline"));
    await screen.unmount();
    mockUpdateProfile.mockRejectedValueOnce("bad");
    screen = await render(<EditProfileScreen />); await fireEvent.press(screen.getByLabelText("Save changes"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Profile not saved", "Please try again."));
  });
});
