import React from "react";
import { Text, Pressable } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockOAuth = jest.fn();
const mockReset = jest.fn();
const mockUpdate = jest.fn();
const mockBrowser = jest.fn();
const mockConstants = { executionEnvironment: "storeClient" };
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { get executionEnvironment() { return mockConstants.executionEnvironment; } },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
jest.mock("expo-auth-session", () => ({ makeRedirectUri: (options: any) => `villam://${options?.path ?? ""}` }));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockBrowser(...args),
}));
jest.mock("@/lib/supabase", () => ({
  clearLocalAuthSession: jest.fn(),
  supabase: { auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    resetPasswordForEmail: (...args: unknown[]) => mockReset(...args),
    updateUser: (...args: unknown[]) => mockUpdate(...args),
    signInWithOAuth: (...args: unknown[]) => mockOAuth(...args),
  } },
}));
import { AuthProvider, useAuth } from "@/context/auth-context";
function GoogleLogin() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  return <><Pressable onPress={async () => setError(await signInWithGoogle())}><Text>Google</Text></Pressable><Text>{error}</Text></>;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockConstants.executionEnvironment = "storeClient";
});
it("explains Expo Go limitations without starting OAuth", async () => {
  const screen = await render(<AuthProvider><GoogleLogin /></AuthProvider>);
  await fireEvent.press(screen.getByText("Google"));
  await waitFor(() => expect(screen.getByText("Google sign-in is unavailable in Expo Go. Use a Villam development build, or log in with email and password.")).toBeTruthy());
  expect(mockOAuth).not.toHaveBeenCalled();
  expect(mockBrowser).not.toHaveBeenCalled();
});
it("starts OAuth in a development build and reports cancellation", async () => {
  mockConstants.executionEnvironment = "standalone";
  mockOAuth.mockResolvedValue({ data: { url: "https://example.com/auth" }, error: null });
  mockBrowser.mockResolvedValue({ type: "cancel" });
  const screen = await render(<AuthProvider><GoogleLogin /></AuthProvider>);
  await fireEvent.press(screen.getByText("Google"));
  await waitFor(() => expect(screen.getByText("Google sign-in cancelled")).toBeTruthy());
  expect(mockBrowser).toHaveBeenCalledWith("https://example.com/auth", "villam://");
});

function Recovery() {
  const { sendPasswordResetEmail, updatePassword } = useAuth();
  const [result, setResult] = React.useState<string | null>(null);
  return <>
    <Pressable onPress={async () => setResult(await sendPasswordResetEmail("user@example.com"))}><Text>Reset</Text></Pressable>
    <Pressable onPress={async () => setResult(await updatePassword("new-password"))}><Text>Update</Text></Pressable>
    <Text>{result}</Text>
  </>;
}
it("sends recovery emails and updates passwords through Supabase", async () => {
  mockReset.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: { message: "Password rejected" } });
  const screen = await render(<AuthProvider><Recovery /></AuthProvider>);
  await fireEvent.press(screen.getByText("Reset"));
  expect(mockReset).toHaveBeenCalledWith("user@example.com", { redirectTo: "villam://reset-password" });
  await fireEvent.press(screen.getByText("Update"));
  expect(mockUpdate).toHaveBeenCalledWith({ password: "new-password" });
  await waitFor(() => expect(screen.getByText("Password rejected")).toBeTruthy());
});
