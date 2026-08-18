const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();
const mockResolveImage = jest.fn();
const mockPathFromUrl = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: { from: (...args: unknown[]) => mockStorageFrom(...args) },
  },
}));
jest.mock("@/lib/api", () => ({ apiBaseUrl: "https://api.test" }));
jest.mock("@/lib/farm-image-storage", () => ({
  FARM_IMAGE_BUCKET: "farm-images",
  farmImagePathFromUrl: (...args: unknown[]) => mockPathFromUrl(...args),
  resolveFarmImageUrl: (...args: unknown[]) => mockResolveImage(...args),
}));

import {
  clearFarmImage,
  createFarm,
  deleteFarm,
  fetchFarmById,
  fetchFarms,
  fetchOwnedFarmByUserId,
  updateFarm,
  uploadFarmImage,
} from "@/lib/farms";

type Result = { data?: any; error?: any };
function query(result: Result) {
  const q: any = {};
  for (const method of ["select", "eq", "in", "order", "limit", "insert", "update", "delete"]) q[method] = jest.fn().mockReturnValue(q);
  q.single = jest.fn().mockResolvedValue(result);
  q.maybeSingle = jest.fn().mockResolvedValue(result);
  q.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}

describe("farms service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveImage.mockImplementation(async (_path, fallback) => fallback);
    mockPathFromUrl.mockReturnValue(null);
    global.fetch = jest.fn() as jest.Mock;
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("loads farms, hydrates images, aggregates valid ratings, and normalizes records", async () => {
    const farms = [
      { id: "f1", name: "B Farm", image_path: "path/f1", image_url: "old1" },
      { id: "f2", name: "A Farm", image_path: null, image_url: "public2" },
      { id: 3, name: "Invalid id" },
    ];
    mockPathFromUrl.mockImplementation((url) => url === "public2" ? "derived/f2" : null);
    mockResolveImage.mockImplementation(async (path) => `signed:${path}`);
    mockFrom.mockImplementation((table: string) => table === "farms"
      ? query({ data: farms, error: null })
      : query({ data: [
          { farm_id: "f1", rating: 5 }, { farm_id: "f1", rating: 3 },
          { farm_id: "f2", rating: 4 }, { farm_id: null, rating: 2 }, { farm_id: "f1", rating: "bad" },
        ], error: null }));
    const result = await fetchFarms();
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ id: "f1", imageUrl: "signed:path/f1", imagePath: "path/f1", rating: 4, reviews: 2, products: "", street: null }));
    expect(result[1]).toEqual(expect.objectContaining({ imageUrl: "signed:derived/f2", imagePath: "derived/f2", rating: 4, reviews: 1 }));
    expect(result[2]).toEqual(expect.objectContaining({ imageUrl: null, imagePath: null, rating: 0, reviews: 0 }));
  });

  it("handles empty farms and rating query failures", async () => {
    mockFrom.mockReturnValueOnce(query({ data: null, error: null }));
    await expect(fetchFarms()).resolves.toEqual([]);
    mockFrom.mockImplementation((table: string) => table === "farms"
      ? query({ data: [{ id: "f", name: "Farm" }], error: null })
      : query({ data: null, error: new Error("ratings") }));
    await expect(fetchFarms()).resolves.toEqual([expect.objectContaining({ rating: 0, reviews: 0 })]);
  });

  it("throws farm list errors", async () => {
    const error = new Error("farms failed");
    mockFrom.mockReturnValue(query({ error }));
    await expect(fetchFarms()).rejects.toBe(error);
  });

  it("loads one farm, returns null, and throws errors", async () => {
    mockFrom.mockReturnValueOnce(query({ data: { id: "f", image_url: "url", image_path: null }, error: null }));
    await expect(fetchFarmById("f")).resolves.toEqual(expect.objectContaining({ id: "f", imageUrl: "url" }));
    mockFrom.mockReturnValueOnce(query({ data: null, error: null }));
    await expect(fetchFarmById("missing")).resolves.toBeNull();
    const error = new Error("failed");
    mockFrom.mockReturnValueOnce(query({ error }));
    await expect(fetchFarmById("f")).rejects.toBe(error);
  });

  it("loads the newest owned farm or null", async () => {
    mockFrom.mockReturnValueOnce(query({ data: [{ id: "f" }], error: null }));
    await expect(fetchOwnedFarmByUserId("u")).resolves.toEqual(expect.objectContaining({ id: "f" }));
    mockFrom.mockReturnValueOnce(query({ data: null, error: null }));
    await expect(fetchOwnedFarmByUserId("u")).resolves.toBeNull();
    const error = new Error("owned failed");
    mockFrom.mockReturnValueOnce(query({ error }));
    await expect(fetchOwnedFarmByUserId("u")).rejects.toBe(error);
  });

  it("creates and updates normalized farms with trimmed nullable fields", async () => {
    const createQuery = query({ data: { id: "new", name: "Farm" }, error: null });
    const updateQuery = query({ data: { id: "f", name: "Updated" }, error: null });
    mockFrom.mockReturnValueOnce(createQuery).mockReturnValueOnce(updateQuery);
    await createFarm({ user_id: "u", name: "Farm", latitude: 1, longitude: 2, website: " https://farm ", description: " ", city: undefined });
    expect(createQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "u", website: "https://farm", description: null, city: null, state: null, postal_code: null, country: null,
    }));
    await updateFarm({ id: "f", name: "Updated", latitude: 3, longitude: 4, website: " ", description: " Fresh " });
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ website: null, description: "Fresh" }));
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "f");
  });

  it.each([
    [createFarm, "Unknown farm creation error.", "bad"],
    [updateFarm, "Message\nDetails\nHint\nCode: 409", { message: " Message ", details: " Details ", hint: " Hint ", code: " 409 " }],
  ])("formats mutation errors", async (fn, expected, error) => {
    mockFrom.mockReturnValue(query({ error }));
    const input: any = { id: "f", user_id: "u", name: "Farm", latitude: 1, longitude: 2 };
    await expect(fn(input)).rejects.toThrow(expected);
  });

  it.each([
    ["photo.PNG?x=1", "image/png"],
    ["photo.webp", "image/webp"],
    ["photo.jpeg", "image/jpeg"],
    ["photo.bad-ext!", "image/jpeg"],
    ["photo", "image/jpeg"],
  ])("uploads %s using %s and removes the prior image", async (uri, mime) => {
    const current = query({ data: { image_path: "old/path.jpg" }, error: null });
    const update = query({ error: null });
    mockFrom.mockReturnValueOnce(current).mockReturnValueOnce(update);
    const upload = jest.fn().mockResolvedValue({ data: { path: "new/path" }, error: null });
    const remove = jest.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl: () => ({ data: { publicUrl: "public-url" } }), remove });
    (global.fetch as jest.Mock).mockResolvedValue({ arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(2)) });
    await expect(uploadFarmImage("u", "f", uri)).resolves.toEqual({ path: "new/path", url: "public-url" });
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^u\/f\//), expect.any(ArrayBuffer), { contentType: mime, upsert: false });
    expect(remove).toHaveBeenCalledWith(["old/path.jpg"]);
  });

  it("handles upload lookup, upload, update cleanup, and old-image removal errors", async () => {
    const lookupError = new Error("lookup");
    mockFrom.mockReturnValueOnce(query({ error: lookupError }));
    await expect(uploadFarmImage("u", "f", "a.jpg")).rejects.toBe(lookupError);

    mockFrom.mockReturnValueOnce(query({ data: null, error: null }));
    mockStorageFrom.mockReturnValueOnce({ upload: jest.fn().mockResolvedValue({ data: null, error: new Error("upload") }) });
    (global.fetch as jest.Mock).mockResolvedValue({ arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1)) });
    await expect(uploadFarmImage("u", "f", "a.jpg")).rejects.toThrow("upload");

    const remove = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce(query({ data: { image_path: null }, error: null })).mockReturnValueOnce(query({ error: new Error("update") }));
    mockStorageFrom.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: { path: "new" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "url" } }), remove,
    });
    await expect(uploadFarmImage("u", "f", "a.jpg")).rejects.toThrow("update");
    expect(remove).toHaveBeenCalledWith(["new"]);

    const warnRemove = jest.fn().mockResolvedValue({ error: { message: "cannot remove" } });
    mockFrom.mockReturnValueOnce(query({ data: { image_path: "old" }, error: null })).mockReturnValueOnce(query({ error: null }));
    mockStorageFrom.mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: { path: "new" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "url" } }), remove: warnRemove,
    });
    await uploadFarmImage("u", "f", "a.jpg");
    expect(console.warn).toHaveBeenCalledWith("Could not remove previous farm image", "cannot remove");
  });

  it("clears storage and database image fields, including no-path mode and errors", async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ remove });
    const update = query({ error: null }); mockFrom.mockReturnValue(update);
    await clearFarmImage("f", "old");
    expect(remove).toHaveBeenCalledWith(["old"]);
    expect(update.update).toHaveBeenCalledWith({ image_path: null, image_url: null });
    await clearFarmImage("f", null);

    mockStorageFrom.mockReturnValue({ remove: jest.fn().mockResolvedValue({ error: new Error("remove") }) });
    await expect(clearFarmImage("f", "old")).rejects.toThrow("remove");
    mockFrom.mockReturnValue(query({ error: new Error("database") }));
    await expect(clearFarmImage("f")).rejects.toThrow("database");
  });

  it("deletes through the API and reports server/fallback errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204 });
    await expect(deleteFarm("token", "a/b")).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith("https://api.test/farms/a%2Fb", { method: "DELETE", headers: { Authorization: "Bearer token" } });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403, json: jest.fn().mockResolvedValue({ detail: "Forbidden" }) });
    await expect(deleteFarm("t", "f")).rejects.toThrow("Forbidden");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, json: jest.fn().mockRejectedValue(new Error("bad json")) });
    await expect(deleteFarm("t", "f")).rejects.toThrow("Request failed (500)");
  });

  it("falls back to direct deletion on a missing API route", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
    const queues: Record<string, any[]> = {
      farms: [query({ data: { id: "f", image_path: "old" }, error: null }), query({ data: { id: "f" }, error: null })],
      farm_listings: [query({ error: null })], farm_ratings: [query({ error: null })],
    };
    mockFrom.mockImplementation((table: string) => queues[table].shift());
    const remove = jest.fn().mockResolvedValue({ error: null }); mockStorageFrom.mockReturnValue({ remove });
    await expect(deleteFarm("t", "f")).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(["old"]);
  });
});
