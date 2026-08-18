import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";

const mockUseTheme = jest.fn();
const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQueryClient = jest.fn();
const mockUseAuth = jest.fn();
const mockGetMe = jest.fn();
const mockSetItemSaved = jest.fn();
const mockRequestPermission = jest.fn();
const mockGetPosition = jest.fn();
const mockReverseGeocode = jest.fn();

jest.mock("@/hooks/useTheme", () => ({ useTheme: () => mockUseTheme() }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: (config: unknown) => mockUseQuery(config),
  useMutation: (config: unknown) => mockUseMutation(config),
  useQueryClient: () => mockUseQueryClient(),
}));
jest.mock("@/context/auth-context", () => ({ useAuth: () => mockUseAuth() }));
jest.mock("@/lib/follows", () => ({ getMe: (...args: unknown[]) => mockGetMe(...args) }));
jest.mock("@/lib/farms", () => ({ fetchFarms: jest.fn() }));
jest.mock("@/lib/saved", () => ({
  fetchSavedItems: jest.fn(), fetchSavedSearches: jest.fn(),
  setItemSaved: (...args: unknown[]) => mockSetItemSaved(...args),
}));
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: () => mockRequestPermission(),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetPosition(...args),
  reverseGeocodeAsync: (...args: unknown[]) => mockReverseGeocode(...args),
}));

describe("theme hooks", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["dark", true, "#151718"],
    ["light", false, "#FFFFFF"],
    [null, false, "#FFFFFF"],
  ])("selects the %s color scheme", (scheme, isDark, background) => {
    jest.isolateModules(() => {
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme as any);
      const { useTheme } = jest.requireActual("@/hooks/useTheme");
      expect(useTheme()).toEqual(expect.objectContaining({ isDark, colors: expect.objectContaining({ background }) }));
    });
  });

  it("uses explicit and default theme colors", () => {
    jest.isolateModules(() => {
      mockUseTheme.mockReturnValue({ isDark: false, colors: { background: "light-default" } });
      const { useThemeColor } = jest.requireActual("@/hooks/use-theme-color");
      expect(useThemeColor({ light: "custom-light" }, "background")).toBe("custom-light");
      expect(useThemeColor({}, "background")).toBe("light-default");
      mockUseTheme.mockReturnValue({ isDark: true, colors: { background: "dark-default" } });
      expect(useThemeColor({ dark: "custom-dark" }, "background")).toBe("custom-dark");
      expect(useThemeColor({}, "background")).toBe("dark-default");
    });
  });
});

describe("query hooks", () => {
  let queryConfigs: any[];
  beforeEach(() => {
    jest.clearAllMocks();
    queryConfigs = [];
    mockUseQuery.mockImplementation((config) => { queryConfigs.push(config); return { config }; });
    mockUseAuth.mockReturnValue({ session: null });
  });

  it("configures the farms query", () => {
    jest.isolateModules(() => require("@/hooks/useFarms").useFarms());
    expect(queryConfigs[0]).toEqual(expect.objectContaining({ queryKey: ["farms"], staleTime: 300000 }));
    expect(queryConfigs[0].queryFn).toEqual(expect.any(Function));
  });

  it("disables profile loading without a session", async () => {
    jest.isolateModules(() => require("@/hooks/useMyProfile").useMyProfile());
    expect(queryConfigs[0]).toEqual(expect.objectContaining({ queryKey: ["me", null], enabled: false, staleTime: 60000 }));
    await expect(queryConfigs[0].queryFn()).resolves.toBeNull();
  });

  it("loads the signed-in profile", async () => {
    mockUseAuth.mockReturnValue({ session: { access_token: "token", user: { id: "u1" } } });
    mockGetMe.mockResolvedValue({ profile: { id: "u1" } });
    jest.isolateModules(() => require("@/hooks/useMyProfile").useMyProfile());
    expect(queryConfigs[0]).toEqual(expect.objectContaining({ queryKey: ["me", "u1"], enabled: true }));
    await expect(queryConfigs[0].queryFn()).resolves.toEqual({ id: "u1" });
    expect(mockGetMe).toHaveBeenCalledWith("token");
  });

  it("configures saved item and search queries for signed-out and signed-in users", () => {
    jest.isolateModules(() => {
      const hooks = require("@/hooks/useSaved");
      hooks.useSavedItems();
      hooks.useSavedSearches();
    });
    expect(queryConfigs.map((q) => [q.queryKey, q.enabled])).toEqual([
      [["saved-items", undefined], false], [["saved-searches", undefined], false],
    ]);
    queryConfigs = [];
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } } });
    jest.isolateModules(() => {
      const hooks = require("@/hooks/useSaved");
      hooks.useSavedItems(); hooks.useSavedSearches();
    });
    expect(queryConfigs.map((q) => [q.queryKey, q.enabled])).toEqual([
      [["saved-items", "u1"], true], [["saved-searches", "u1"], true],
    ]);
  });
});

describe("useSavedItem", () => {
  const queryClient = {
    cancelQueries: jest.fn(), getQueryData: jest.fn(), setQueryData: jest.fn(), invalidateQueries: jest.fn(),
  };
  let mutationConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mutationConfig = null;
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } } });
    mockUseQueryClient.mockReturnValue(queryClient);
    mockUseQuery.mockReturnValue({ data: [{ item_type: "farm", item_id: "f1" }] });
    mockUseMutation.mockImplementation((config) => {
      mutationConfig = config;
      return { isPending: false, error: null, mutateAsync: jest.fn().mockResolvedValue(undefined) };
    });
  });

  function load(type = "farm", id = "f1") {
    let result: any;
    jest.isolateModules(() => { result = require("@/hooks/useSaved").useSavedItem(type, id); });
    return result;
  }

  it("detects saved state and invokes persistence", async () => {
    const result = load();
    expect(result.isSaved).toBe(true);
    await mutationConfig.mutationFn(false);
    expect(mockSetItemSaved).toHaveBeenCalledWith("u1", "farm", "f1", false);
    await result.toggle();
    expect(mockUseMutation.mock.results[0].value.mutateAsync).toHaveBeenCalledWith(false);
  });

  it("optimistically adds and removes cached items", async () => {
    queryClient.getQueryData.mockReturnValue(["previous"]);
    await expect(load("recipe", "r1") && mutationConfig.onMutate(true)).resolves.toEqual({ previous: ["previous"] });
    const addUpdater = queryClient.setQueryData.mock.calls.at(-1)[1];
    expect(addUpdater([])).toEqual([expect.objectContaining({ user_id: "u1", item_type: "recipe", item_id: "r1" })]);
    expect(addUpdater(undefined)).toHaveLength(1);

    await mutationConfig.onMutate(false);
    const removeUpdater = queryClient.setQueryData.mock.calls.at(-1)[1];
    expect(removeUpdater([{ item_type: "recipe", item_id: "r1" }, { item_type: "recipe", item_id: "other" }]))
      .toEqual([{ item_type: "recipe", item_id: "other" }]);
  });

  it("rolls back, invalidates, and safely no-ops when signed out or missing an id", async () => {
    load();
    mutationConfig.onError(new Error(), false, { previous: ["old"] });
    expect(queryClient.setQueryData).toHaveBeenCalledWith(["saved-items", "u1"], ["old"]);
    mutationConfig.onSettled();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["saved-items", "u1"] });

    mockUseAuth.mockReturnValue({ session: null });
    await expect(load().toggle()).resolves.toBeUndefined();
    mockUseAuth.mockReturnValue({ session: { user: { id: "u1" } } });
    await expect(load("farm", "").toggle()).resolves.toBeUndefined();
  });
});

describe("useCurrentLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermission.mockResolvedValue({ status: "granted" });
    mockGetPosition.mockResolvedValue({ coords: { latitude: 37.8, longitude: -122.3 } });
    mockReverseGeocode.mockResolvedValue([{ city: "Oakland", region: "CA" }]);
  });

  it("loads coordinates and a friendly place name", async () => {
    const hook = await renderHook(() => require("@/hooks/useCurrentLocation").useCurrentLocation());
    await waitFor(() => expect(hook.result.current.permissionStatus).toBe("granted"));
    expect(hook.result.current).toEqual(expect.objectContaining({
      coords: { latitude: 37.8, longitude: -122.3 }, locationText: "Oakland, CA", error: null,
    }));
  });

  it("handles denied permission", async () => {
    mockRequestPermission.mockResolvedValue({ status: "denied" });
    const hook = await renderHook(() => require("@/hooks/useCurrentLocation").useCurrentLocation());
    await waitFor(() => expect(hook.result.current.permissionStatus).toBe("denied"));
    expect(hook.result.current.locationText).toBe("Location permission denied");
    expect(hook.result.current.coords).toBeNull();
  });

  it.each([
    [[], "37.8000, -122.3000"],
    [[{ city: null, region: null }], "37.8000, -122.3000"],
    [[{ city: "Oakland", region: null }], "Oakland"],
  ])("falls back appropriately for reverse geocode result %#", async (places, expected) => {
    mockReverseGeocode.mockResolvedValue(places);
    const hook = await renderHook(() => require("@/hooks/useCurrentLocation").useCurrentLocation());
    await waitFor(() => expect(hook.result.current.locationText).toBe(expected));
  });

  it("reports failures and supports manual refresh", async () => {
    mockRequestPermission.mockRejectedValueOnce(new Error("offline"));
    const hook = await renderHook(() => require("@/hooks/useCurrentLocation").useCurrentLocation());
    await waitFor(() => expect(hook.result.current.error).toBe("Could not get location"));
    await act(async () => { await hook.result.current.refresh(); });
    expect(hook.result.current.locationText).toBe("Oakland, CA");
    expect(hook.result.current.error).toBeNull();
  });
});
