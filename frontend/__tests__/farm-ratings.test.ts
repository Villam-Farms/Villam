const mockFrom = jest.fn();
const mockApiRequest = jest.fn();

jest.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock("@/lib/api", () => ({ apiRequest: (...args: unknown[]) => mockApiRequest(...args) }));

import { fetchFarmRatings, saveFarmRating, summarizeFarmRatings } from "@/lib/farm-ratings";

function ratingsQuery(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue(result),
  };
}

function profilesQuery(result: unknown) {
  return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue(result) };
}

describe("farm ratings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads valid ratings, profile names, fallbacks, and generated ids", async () => {
    const rows = [
      { id: 1, farm_id: "f1", user_id: "u1", rating: 5, review: "Great", created_at: "c", updated_at: "u" },
      { farm_id: "f1", user_id: "u2", rating: 3, review: 9 },
      { farm_id: "f1", user_id: "u3", rating: 4 },
      { farm_id: null, user_id: "u4", rating: 2 },
      { farm_id: "f1", user_id: "u5", rating: Number.NaN },
    ];
    mockFrom.mockImplementation((table: string) => table === "farm_ratings"
      ? ratingsQuery({ data: rows, error: null })
      : profilesQuery({
          data: [
            { id: "u1", full_name: " Ada ", username: "ada" },
            { id: "u2", full_name: " ", username: " bob " },
            { id: "u3", full_name: "", username: "" },
            { id: 4, full_name: "ignored" },
          ],
          error: null,
        }));

    await expect(fetchFarmRatings("f1")).resolves.toEqual([
      expect.objectContaining({ id: 1, authorName: "Ada", review: "Great" }),
      expect.objectContaining({ id: "f1-u2", authorName: "bob", review: "" }),
      expect.objectContaining({ id: "f1-u3", authorName: "Local shopper" }),
    ]);
  });

  it("returns shopper fallbacks if profiles fail or no users exist", async () => {
    mockFrom.mockImplementation((table: string) => table === "farm_ratings"
      ? ratingsQuery({ data: [{ farm_id: "f", user_id: "u", rating: 4 }], error: null })
      : profilesQuery({ data: null, error: new Error("profiles unavailable") }));
    await expect(fetchFarmRatings("f")).resolves.toEqual([
      expect.objectContaining({ authorName: "Local shopper" }),
    ]);

    mockFrom.mockReturnValueOnce(ratingsQuery({ data: [], error: null }));
    await expect(fetchFarmRatings("empty")).resolves.toEqual([]);
  });

  it("throws rating query errors", async () => {
    const error = new Error("ratings unavailable");
    mockFrom.mockReturnValue(ratingsQuery({ data: null, error }));
    await expect(fetchFarmRatings("f")).rejects.toBe(error);
  });

  it("clamps rating, trims review, and normalizes the saved response", async () => {
    mockApiRequest.mockResolvedValue({
      id: "r1", farm_id: "farm/1", user_id: "u1", rating: 5,
      review: "Excellent", created_at: "now", updated_at: "now",
    });
    mockFrom.mockReturnValue(profilesQuery({
      data: [{ id: "u1", full_name: "Farmer Ada", username: null }], error: null,
    }));
    await expect(saveFarmRating({ farmId: "farm/1", accessToken: "token", rating: 99, review: " Excellent " }))
      .resolves.toEqual(expect.objectContaining({ id: "r1", rating: 5, authorName: "Farmer Ada" }));
    expect(mockApiRequest).toHaveBeenCalledWith("/farms/farm/1/rating", {
      method: "PUT", accessToken: "token", body: { rating: 5, review: "Excellent" },
    });
  });

  it("clamps low ratings and accepts a response without a user profile lookup", async () => {
    mockApiRequest.mockResolvedValue({ farm_id: "f", user_id: "u", rating: 1, review: "" });
    mockFrom.mockReturnValue(profilesQuery({ data: [], error: null }));
    await saveFarmRating({ farmId: "f", accessToken: "t", rating: -4, review: " " });
    expect(mockApiRequest).toHaveBeenCalledWith("/farms/f/rating", expect.objectContaining({
      body: { rating: 1, review: "" },
    }));
  });

  it("preserves API Error messages and handles unknown failures", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(saveFarmRating({ farmId: "f", accessToken: "t", rating: 3, review: "ok" }))
      .rejects.toThrow("Forbidden");
    mockApiRequest.mockRejectedValueOnce("offline");
    await expect(saveFarmRating({ farmId: "f", accessToken: "t", rating: 3, review: "ok" }))
      .rejects.toThrow("Failed to save review");
  });

  it("rejects malformed saved ratings", async () => {
    mockApiRequest.mockResolvedValue({ farm_id: "f", rating: 3 });
    await expect(saveFarmRating({ farmId: "f", accessToken: "t", rating: 3, review: "ok" }))
      .rejects.toThrow("Unable to save review");
  });

  it("summarizes empty and populated ratings", () => {
    expect(summarizeFarmRatings([])).toEqual({ average: 0, count: 0 });
    expect(summarizeFarmRatings([
      { rating: 2 }, { rating: 5 }, { rating: 5 },
    ] as any)).toEqual({ average: 4, count: 3 });
  });
});
