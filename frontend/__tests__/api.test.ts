import { apiBaseUrl, apiRequest } from "@/lib/api";

describe("apiRequest", () => {
  const mockFetch = jest.fn();
  beforeEach(() => { global.fetch = mockFetch as any; mockFetch.mockReset(); });

  test("sends auth, JSON headers, method, and body", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 1 }) });
    await expect(apiRequest("things", { accessToken: "token", method: "POST", body: { name: "Carrot" } })).resolves.toEqual({ id: 1 });
    expect(mockFetch).toHaveBeenCalledWith(`${apiBaseUrl}/things`, expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Carrot" }), headers: expect.objectContaining({ Authorization: "Bearer token", "Content-Type": "application/json" }) }));
  });
  test("does not create a body for GET requests", async () => { mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] }); await apiRequest("/things", { accessToken: "t" }); expect(mockFetch.mock.calls[0][1].body).toBeUndefined(); });
  test("supports custom headers", async () => { mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); await apiRequest("/things", { accessToken: "t", headers: { "X-Test": "yes" } }); expect(mockFetch.mock.calls[0][1].headers["X-Test"]).toBe("yes"); });
  test("returns undefined for 204", async () => { mockFetch.mockResolvedValue({ ok: true, status: 204 }); await expect(apiRequest("/follow", { accessToken: "t", method: "POST" })).resolves.toBeUndefined(); });
  test("uses API error details", async () => { mockFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: "Already exists" }) }); await expect(apiRequest("/things", { accessToken: "t" })).rejects.toThrow("Already exists"); });
  test("falls back when an error response is not JSON", async () => { mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("bad json"); } }); await expect(apiRequest("/things", { accessToken: "t" })).rejects.toThrow("Request failed (500)"); });
  test("converts abort errors into timeout messages", async () => { const error: any = new Error("aborted"); error.name = "AbortError"; mockFetch.mockRejectedValue(error); await expect(apiRequest("/things", { accessToken: "t", timeoutMs: 25 })).rejects.toThrow("Request timed out after 25ms"); });
  test("forwards cancellation from an external signal", async () => {
    const external = new AbortController();
    external.abort();
    mockFetch.mockImplementation(async (_url, options) => { expect(options.signal.aborted).toBe(true); const error: any = new Error("aborted"); error.name = "AbortError"; throw error; });
    await expect(apiRequest("/things", { accessToken: "t", signal: external.signal })).rejects.toThrow("Request timed out");
  });
  test("forwards cancellation that occurs during a request", async () => {
    const external = new AbortController();
    mockFetch.mockImplementation(async (_url, options) => { external.abort(); expect(options.signal.aborted).toBe(true); throw new Error("cancelled"); });
    await expect(apiRequest("/things", { accessToken: "t", signal: external.signal })).rejects.toThrow("cancelled");
  });
  test("uses the default method and preserves ordinary network errors", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    await expect(apiRequest("things", { accessToken: "t" })).rejects.toThrow("offline");
    expect(mockFetch.mock.calls[0][1].method).toBe("GET");
  });
});
