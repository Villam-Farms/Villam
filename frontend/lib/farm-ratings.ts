import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api";

export type FarmRating = {
  id: string | number;
  farmId: string;
  userId: string;
  rating: number;
  review: string;
  createdAt: string | null;
  updatedAt: string | null;
  authorName: string;
};

type FarmRatingRow = Record<string, unknown>;

function getString(row: FarmRatingRow, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function getNumber(row: FarmRatingRow, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getId(row: FarmRatingRow) {
  const value = row.id;
  if (typeof value === "string" || typeof value === "number") return value;
  return null;
}

function getReviewText(row: FarmRatingRow) {
  return getString(row, "review") ?? "";
}

function normalizeRating(row: FarmRatingRow, profileNames: Record<string, string>): FarmRating | null {
  const userId = getString(row, "user_id");
  const farmId = getString(row, "farm_id");
  const rating = getNumber(row, "rating");

  if (!userId || !farmId || rating == null) return null;

  const id = getId(row) ?? `${farmId}-${userId}`;

  return {
    id,
    farmId,
    userId,
    rating,
    review: getReviewText(row),
    createdAt: getString(row, "created_at"),
    updatedAt: getString(row, "updated_at"),
    authorName: profileNames[userId] ?? "Local shopper",
  };
}

async function fetchProfileNames(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds));
  if (!uniqueIds.length) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,full_name")
    .in("id", uniqueIds);

  if (error) return {};

  return (data ?? []).reduce<Record<string, string>>((acc, row) => {
    const id = getString(row, "id");
    if (!id) return acc;

    acc[id] =
      getString(row, "full_name")?.trim() ||
      getString(row, "username")?.trim() ||
      "Local shopper";

    return acc;
  }, {});
}

export async function fetchFarmRatings(farmId: string): Promise<FarmRating[]> {
  const { data, error } = await supabase
    .from("farm_ratings")
    .select("*")
    .eq("farm_id", farmId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as FarmRatingRow[];
  const userIds = rows
    .map((row) => getString(row, "user_id"))
    .filter((userId): userId is string => !!userId);
  const profileNames = await fetchProfileNames(userIds);

  return rows
    .map((row) => normalizeRating(row, profileNames))
    .filter((rating): rating is FarmRating => !!rating);
}

export async function saveFarmRating(input: {
  farmId: string;
  accessToken: string;
  rating: number;
  review: string;
}): Promise<FarmRating> {
  const rating = Math.max(1, Math.min(5, input.rating));
  const review = input.review.trim();

  let row: FarmRatingRow;
  try {
    row = await apiRequest<FarmRatingRow>(`/farms/${input.farmId}/rating`, {
      method: "PUT",
      accessToken: input.accessToken,
      body: { rating, review },
    });
  } catch (error) {
    console.error("Error saving farm rating:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to save review. Please try again.");
  }

  const userId = getString(row, "user_id");
  const profileNames = userId ? await fetchProfileNames([userId]) : {};
  const normalized = normalizeRating(row, profileNames);
  if (!normalized) throw new Error("Unable to save review.");

  return normalized;
}

export function summarizeFarmRatings(ratings: FarmRating[]) {
  if (!ratings.length) {
    return { average: 0, count: 0 };
  }

  const total = ratings.reduce((sum, item) => sum + item.rating, 0);
  return {
    average: total / ratings.length,
    count: ratings.length,
  };
}
