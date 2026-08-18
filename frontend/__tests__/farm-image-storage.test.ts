const mockCreateSignedUrl = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args) }) } },
}));

import { farmImagePathFromUrl, resolveFarmImageUrl } from "@/lib/farm-image-storage";

describe("farm image storage", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    [null, null],
    [undefined, null],
    ["not a URL", null],
    ["https://cdn.test/other/file.jpg", null],
    ["https://x.test/storage/v1/object/public/farm-images/user%201/farm.jpg", "user 1/farm.jpg"],
    ["https://x.test/storage/v1/object/public/farm-images/", null],
  ])("extracts storage paths from %s", (url, expected) => {
    expect(farmImagePathFromUrl(url)).toBe(expected);
  });

  it("returns fallback when no storage path exists", async () => {
    await expect(resolveFarmImageUrl(null, "https://other.test/a.jpg")).resolves.toBe("https://other.test/a.jpg");
    await expect(resolveFarmImageUrl(undefined, undefined)).resolves.toBeNull();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("returns a signed URL for explicit and inferred paths", async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "signed" }, error: null });
    await expect(resolveFarmImageUrl("u/f.jpg", "old")).resolves.toBe("signed");
    await expect(resolveFarmImageUrl(null, "https://x.test/storage/v1/object/public/farm-images/u/f.jpg")).resolves.toBe("signed");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("u/f.jpg", 3600);
  });

  it.each([
    [{ data: null, error: new Error("failed") }],
    [{ data: {}, error: null }],
  ])("falls back when signing fails", async (result) => {
    mockCreateSignedUrl.mockResolvedValue(result);
    await expect(resolveFarmImageUrl("u/f.jpg", "fallback")).resolves.toBe("fallback");
    await expect(resolveFarmImageUrl("u/f.jpg", null)).resolves.toBeNull();
  });
});
