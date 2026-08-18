process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

afterEach(() => {
  jest.clearAllMocks();
});
