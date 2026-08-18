const mockApiRequest = jest.fn();
jest.mock("@/lib/api", () => ({ apiRequest: (...a: unknown[]) => mockApiRequest(...a) }));

import { createGroceryList } from "@/lib/grocery-lists";

describe("grocery list API", () => {
  it("creates a grocery list through the authenticated API", async () => {
    mockApiRequest.mockResolvedValue({ id: "g1" });
    const body = { title: "Weekly", isPinned: true, items: [{ name: "Kale", quantity: "2", checked: false }] };
    await expect(createGroceryList("token", body)).resolves.toEqual({ id: "g1" });
    expect(mockApiRequest).toHaveBeenCalledWith("/grocery-lists", { method: "POST", accessToken: "token", body });
  });
});

describe("debug logging", () => {
  beforeEach(() => {
    jest.resetModules(); jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  function load(constants: unknown) {
    jest.doMock("expo-constants", () => ({ __esModule: true, default: constants }));
    return require("@/lib/debug-log").debugLog as (payload: any) => void;
  }

  it.each([
    [{ expoConfig: { hostUri: "192.168.1.5:8081" } }, "192.168.1.5"],
    [{ manifest2: { extra: { expoClient: { hostUri: "10.0.0.2:8081" } } } }, "10.0.0.2"],
    [{ manifest: { hostUri: "172.16.0.3:8081" } }, "172.16.0.3"],
    [{}, "127.0.0.1"],
    [{ expoConfig: { hostUri: 42 } }, "127.0.0.1"],
  ])("posts to the resolved development host %#", (constants, host) => {
    const debugLog = load(constants);
    debugLog({ runId: "run", hypothesisId: "H", location: "file:1", message: "hello", data: { value: 1 } });
    expect(global.fetch).toHaveBeenCalledWith(
      `http://${host}:7513/ingest/bc43a9d6-ae9b-4156-9b29-faa0cd203f7e`,
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "X-Debug-Session-Id": "158ca1" }) }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual(expect.objectContaining({ sessionId: "158ca1", runId: "run", timestamp: expect.any(Number) }));
  });

  it("logs missing data as an empty object and ignores ingestion failures", () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));
    const debugLog = load({});
    expect(() => debugLog({ runId: "run", hypothesisId: "H", location: "file", message: "hello" })).not.toThrow();
    expect(console.log).toHaveBeenCalledWith("[debug]", "file", "hello", {});
  });
});
