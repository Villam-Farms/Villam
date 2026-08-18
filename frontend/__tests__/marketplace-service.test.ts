const mockFrom = jest.fn();
const mockResolveFarmImageUrl = jest.fn();

jest.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock("@/lib/api", () => ({ apiBaseUrl: "https://api.test" }));
jest.mock("@/lib/farm-image-storage", () => ({
  resolveFarmImageUrl: (...args: unknown[]) => mockResolveFarmImageUrl(...args),
}));

import {
  clearFarmListingImage,
  createFarmListing,
  deleteFarmListing,
  fetchFarmListingsByFarmId,
  fetchMarketplaceListings,
  fetchProduceCatalog,
  updateFarmListing,
  uploadFarmListingImage,
} from "@/lib/marketplace";

type Result = { data?: unknown; error?: unknown };

function query(result: Result) {
  const builder: any = {};
  for (const name of ["select", "eq", "in", "order", "insert", "update"]) {
    builder[name] = jest.fn().mockReturnValue(builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

describe("marketplace service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveFarmImageUrl.mockResolvedValue("https://cdn.test/farm.jpg");
    global.fetch = jest.fn() as jest.Mock;
  });

  it("loads the produce catalog", async () => {
    const items = [{ id: "i1", name: "Apple" }];
    const varieties = [{ id: "v1", produce_item_id: "i1", name: "Fuji" }];
    mockFrom.mockImplementation((table: string) => query({
      data: table === "produce_items" ? items : varieties, error: null,
    }));
    await expect(fetchProduceCatalog()).resolves.toEqual({ items, varieties });
  });

  it("defaults missing catalog tables to empty arrays", async () => {
    mockFrom.mockReturnValue(query({ data: null, error: null }));
    await expect(fetchProduceCatalog()).resolves.toEqual({ items: [], varieties: [] });
  });

  it.each(["produce_items", "produce_varieties"])("throws %s catalog errors", async (failedTable) => {
    const error = new Error(`${failedTable} failed`);
    mockFrom.mockImplementation((table: string) => query({ data: [], error: table === failedTable ? error : null }));
    await expect(fetchProduceCatalog()).rejects.toBe(error);
  });

  it("hydrates, filters, defaults, and sorts available listings", async () => {
    const listings = [
      { id: "l2", farm_id: "f1", produce_variety_id: "v2", price: "2.5", currency: "USD", sold_by: "lb", available: true, image_url: null },
      { id: "l1", farm_id: "f1", produce_variety_id: "v1", price: 1, currency: "USD", sold_by: "each", available: true, image_url: "item.jpg" },
      { id: "stale", farm_id: "missing", produce_variety_id: "v1", price: 1, currency: "USD", sold_by: "each", available: true, image_url: null },
    ];
    const farms = [{ id: "f1", name: "Ada Farm", latitude: 1, longitude: 2, city: null, state: "CA", postal_code: null, country: "US", image_url: "old.jpg", image_path: "farm/path" }];
    const varieties = [
      { id: "v1", produce_item_id: "i1", name: "Fuji", description: null },
      { id: "v2", produce_item_id: "i2", name: "Curly", description: "Fresh" },
    ];
    const items = [
      { id: "i1", name: "Apple", category: " Fruit ", description: null, default_sold_by: "each" },
      { id: "i2", name: "Kale", category: "  ", description: null, default_sold_by: "bunch" },
    ];
    mockFrom.mockImplementation((table: string) => query({
      data: table === "farm_listings" ? listings : table === "farms" ? farms : table === "produce_varieties" ? varieties : items,
      error: null,
    }));

    const result = await fetchMarketplaceListings();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      id: "l1", produceItemName: "Apple", category: "Fruit", price: 1,
      imageUrl: "item.jpg", farmImageUrl: "https://cdn.test/farm.jpg",
    }));
    expect(result[1]).toEqual(expect.objectContaining({ id: "l2", produceItemName: "Kale", category: "Other", price: 2.5 }));
    expect(mockResolveFarmImageUrl).toHaveBeenCalledWith("farm/path", "old.jpg");
  });

  it("returns early for no listings", async () => {
    mockFrom.mockReturnValue(query({ data: null, error: null }));
    await expect(fetchMarketplaceListings()).resolves.toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["farms"],
    ["produce_varieties"],
    ["produce_items"],
  ])("treats missing %s hydration data as unavailable content", async (missingTable) => {
    const listing = { id: "l", farm_id: "f", produce_variety_id: "v", price: 1, currency: "USD", sold_by: "each", available: true, image_url: null };
    mockFrom.mockImplementation((table: string) => query({
      data: table === "farm_listings" ? [listing]
        : table === missingTable ? null
        : table === "farms" ? [{ id: "f", name: "Farm" }]
        : table === "produce_varieties" ? [{ id: "v", produce_item_id: "i", name: "Variety" }]
        : [{ id: "i", name: "Item" }],
      error: null,
    }));
    await expect(fetchMarketplaceListings()).resolves.toEqual([]);
  });

  it("drops listings whose variety or produce item references are stale", async () => {
    const listings = [
      { id: "no-variety", farm_id: "f", produce_variety_id: "missing", price: 1, currency: "USD", sold_by: "each", available: true, image_url: null },
      { id: "no-item", farm_id: "f", produce_variety_id: "v", price: 1, currency: "USD", sold_by: "each", available: true, image_url: null },
    ];
    mockFrom.mockImplementation((table: string) => query({
      data: table === "farm_listings" ? listings
        : table === "farms" ? [{ id: "f", name: "Farm" }]
        : table === "produce_varieties" ? [{ id: "v", produce_item_id: "missing", name: "Variety" }]
        : [],
      error: null,
    }));
    await expect(fetchMarketplaceListings()).resolves.toEqual([]);
  });

  it("loads all listings for one farm", async () => {
    mockFrom.mockImplementation((table: string) => query({
      data: table === "farm_listings" ? [] : [], error: null,
    }));
    await expect(fetchFarmListingsByFarmId("f1")).resolves.toEqual([]);
  });

  it.each(["farm_listings", "farms", "produce_varieties", "produce_items"])("throws %s hydration errors", async (failedTable) => {
    const error = new Error(`${failedTable} failed`);
    const listing = { id: "l", farm_id: "f", produce_variety_id: "v", price: 1, currency: "USD", sold_by: "each", available: true, image_url: null };
    mockFrom.mockImplementation((table: string) => query({
      data: table === "farm_listings" ? [listing]
        : table === "farms" ? [{ id: "f" }]
        : table === "produce_varieties" ? [{ id: "v", produce_item_id: "i" }]
        : [{ id: "i" }],
      error: table === failedTable ? error : null,
    }));
    await expect(fetchMarketplaceListings()).rejects.toBe(error);
  });

  it("creates a listing with the exact payload", async () => {
    const builder = query({ data: { id: "l1" }, error: null });
    mockFrom.mockReturnValue(builder);
    const input = { farm_id: "f", produce_variety_id: "v", price: 3, currency: "USD", sold_by: "lb", available: true };
    await expect(createFarmListing(input)).resolves.toEqual({ id: "l1" });
    expect(builder.insert).toHaveBeenCalledWith(input);
  });

  it.each([
    ["bad", "Unknown listing creation error."],
    [{ message: " Bad ", details: " Details ", hint: " Hint ", code: " 23505 " }, "Bad\nDetails\nHint\nCode: 23505"],
  ])("formats create errors", async (error, message) => {
    mockFrom.mockReturnValue(query({ data: null, error }));
    await expect(createFarmListing({ farm_id: "f", produce_variety_id: "v", price: 1, currency: "USD", sold_by: "lb", available: true }))
      .rejects.toThrow(message);
  });

  it("formats sparse structured errors", async () => {
    mockFrom.mockReturnValue(query({ data: null, error: { code: " 409 " } }));
    await expect(createFarmListing({ farm_id: "f", produce_variety_id: "v", price: 1, currency: "USD", sold_by: "lb", available: true }))
      .rejects.toThrow("Code: 409");
  });

  it("updates a listing", async () => {
    const builder = query({ error: null });
    mockFrom.mockReturnValue(builder);
    await updateFarmListing({ id: "l", produce_variety_id: "v", price: 4, currency: "CAD", sold_by: "pint", available: false });
    expect(builder.update).toHaveBeenCalledWith({ produce_variety_id: "v", price: 4, currency: "CAD", sold_by: "pint", available: false });
    expect(builder.eq).toHaveBeenCalledWith("id", "l");
  });

  it("throws formatted update errors", async () => {
    mockFrom.mockReturnValue(query({ error: { message: "Cannot update" } }));
    await expect(updateFarmListing({ id: "l", produce_variety_id: "v", price: 4, currency: "CAD", sold_by: "pint", available: false }))
      .rejects.toThrow("Cannot update");
  });

  it.each([
    [uploadFarmListingImage, "POST", "/listings/a%2Fb/image"],
    [clearFarmListingImage, "DELETE", "/listings/a%2Fb/image"],
  ])("handles successful image requests", async (fn, method, path) => {
    const output = { id: "a/b", image_url: "new.jpg" };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(output) });
    const result = fn === uploadFarmListingImage
      ? await fn("token", "a/b", { uri: "file://x", name: "x.jpg", type: "image/jpeg" })
      : await (fn as typeof clearFarmListingImage)("token", "a/b");
    expect(result).toEqual(output);
    expect(global.fetch).toHaveBeenCalledWith(`https://api.test${path}`, expect.objectContaining({ method, headers: { Authorization: "Bearer token" } }));
  });

  it.each([uploadFarmListingImage, clearFarmListingImage])("uses server and fallback image errors", async (fn) => {
    const call = () => fn === uploadFarmListingImage
      ? fn("t", "l", { uri: "x", name: "x", type: "x" })
      : (fn as typeof clearFarmListingImage)("t", "l");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 400, json: jest.fn().mockResolvedValue({ detail: "Bad image" }) });
    await expect(call()).rejects.toThrow("Bad image");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503, json: jest.fn().mockRejectedValue(new Error("invalid")) });
    await expect(call()).rejects.toThrow("Request failed (503)");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 422, json: jest.fn().mockResolvedValue({}) });
    await expect(call()).rejects.toThrow("Request failed (422)");
  });

  it("deletes a listing and handles JSON and fallback errors", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await expect(deleteFarmListing("t", "a/b")).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith("https://api.test/listings/a%2Fb", expect.objectContaining({ method: "DELETE" }));

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403, json: jest.fn().mockResolvedValue({ detail: "Forbidden" }) });
    await expect(deleteFarmListing("t", "l")).rejects.toThrow("Forbidden");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500, json: jest.fn().mockRejectedValue(new Error("invalid")) });
    await expect(deleteFarmListing("t", "l")).rejects.toThrow("Request failed (500)");
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404, json: jest.fn().mockResolvedValue({}) });
    await expect(deleteFarmListing("t", "l")).rejects.toThrow("Request failed (404)");
  });
});
