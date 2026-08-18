import { supabase } from "@/lib/supabase";
import {
  FARM_IMAGE_BUCKET,
  farmImagePathFromUrl,
  resolveFarmImageUrl,
} from "@/lib/farm-image-storage";
import type { FarmWithCoords } from "@/lib/location";

const FARM_SELECT_COLUMNS =
  "id,name,latitude,longitude,city,state,postal_code,country,website,description,image_url,image_path";

type FarmRatingAggregate = {
  average: number;
  count: number;
};

type FarmRatingRow = {
  farm_id: string | null;
  rating: number | null;
};

async function fetchRatingAggregates(farmIds: string[]) {
  const uniqueFarmIds = Array.from(new Set(farmIds)).filter(Boolean);
  if (!uniqueFarmIds.length) return {};

  const { data, error } = await supabase
    .from("farm_ratings")
    .select("farm_id,rating")
    .in("farm_id", uniqueFarmIds);

  if (error) {
    console.log("Could not load farm rating aggregates", error);
    return {};
  }

  const totals = ((data ?? []) as FarmRatingRow[]).reduce<
    Record<string, { total: number; count: number }>
  >((acc, row) => {
    if (!row.farm_id || typeof row.rating !== "number") return acc;

    const current = acc[row.farm_id] ?? { total: 0, count: 0 };
    current.total += row.rating;
    current.count += 1;
    acc[row.farm_id] = current;
    return acc;
  }, {});

  return Object.entries(totals).reduce<Record<string, FarmRatingAggregate>>(
    (acc, [farmId, value]) => {
      acc[farmId] = {
        average: value.count > 0 ? value.total / value.count : 0,
        count: value.count,
      };
      return acc;
    },
    {}
  );
}

function normalizeFarmRecord(
  data: Record<string, unknown>,
  ratings: Record<string, FarmRatingAggregate> = {}
) {
  const id = typeof data.id === "string" ? data.id : "";
  const ratingSummary = ratings[id];

  return {
    ...data,
    imageUrl: typeof data.image_url === "string" ? data.image_url : null,
    imagePath: typeof data.image_path === "string" ? data.image_path : null,
    rating: ratingSummary?.average ?? 0,
    reviews: ratingSummary?.count ?? 0,
    products: "",
    street: null,
  } as FarmWithCoords;
}

async function hydrateFarmImage(record: Record<string, unknown>) {
  const storedImagePath = typeof record.image_path === "string" ? record.image_path : null;
  const fallbackUrl = typeof record.image_url === "string" ? record.image_url : null;
  const imagePath = storedImagePath || farmImagePathFromUrl(fallbackUrl);
  if (!imagePath) return record;

  const imageUrl = await resolveFarmImageUrl(imagePath, fallbackUrl);
  return { ...record, image_path: imagePath, image_url: imageUrl };
}

export async function fetchFarms(): Promise<FarmWithCoords[]> {
  const { data, error } = await supabase
    .from("farms")
    .select(FARM_SELECT_COLUMNS)
    .order("id", { ascending: true });

  if (error) throw error;

  const farms = (data ?? []) as Record<string, unknown>[];
  const ratingAggregates = await fetchRatingAggregates(
    farms
      .map((farm) => farm.id)
      .filter((id): id is string => typeof id === "string")
  );

  return Promise.all(
    farms.map(async (farm) => normalizeFarmRecord(await hydrateFarmImage(farm), ratingAggregates))
  );
}

export type CreateFarmInput = {
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  description?: string | null;
};

export type UpdateFarmInput = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  description?: string | null;
};

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown farm creation error.";
  }

  const maybeError = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  const message = maybeError.message?.trim();
  const details = maybeError.details?.trim();
  const hint = maybeError.hint?.trim();
  const code = maybeError.code?.trim();

  return [message, details, hint, code ? `Code: ${code}` : null]
    .filter(Boolean)
    .join("\n");
}

export async function fetchFarmById(farmId: string): Promise<FarmWithCoords | null> {
  const { data, error } = await supabase
    .from("farms")
    .select(FARM_SELECT_COLUMNS)
    .eq("id", farmId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeFarmRecord(await hydrateFarmImage(data));
}

export async function fetchOwnedFarmByUserId(userId: string): Promise<FarmWithCoords | null> {
  const { data, error } = await supabase
    .from("farms")
    .select(FARM_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;

  const farm = data?.[0];
  return farm ? normalizeFarmRecord(await hydrateFarmImage(farm)) : null;
}

export async function createFarm(input: CreateFarmInput): Promise<FarmWithCoords> {
  const payload = {
    user_id: input.user_id,
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postal_code ?? null,
    country: input.country ?? null,
    website: input.website?.trim() || null,
    description: input.description?.trim() || null,
  };

  const { data, error } = await supabase
    .from("farms")
    .insert(payload)
    .select(FARM_SELECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  return normalizeFarmRecord(data);
}

export async function updateFarm(input: UpdateFarmInput): Promise<FarmWithCoords> {
  const payload = {
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postal_code ?? null,
    country: input.country ?? null,
    website: input.website?.trim() || null,
    description: input.description?.trim() || null,
  };

  const { data, error } = await supabase
    .from("farms")
    .update(payload)
    .eq("id", input.id)
    .select(FARM_SELECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error));
  }

  return normalizeFarmRecord(data);
}

function getImageExtension(uri: string) {
  const extension = uri.split("?")[0].split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

function getImageMimeType(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export async function uploadFarmImage(
  userId: string,
  farmId: string,
  uri: string
) {
  const { data: currentFarm, error: currentFarmError } = await supabase
    .from("farms")
    .select("image_path")
    .eq("id", farmId)
    .maybeSingle();
  if (currentFarmError) throw currentFarmError;

  const extension = getImageExtension(uri);
  const path = `${userId}/${farmId}/${Date.now()}.${extension}`;
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const { data: uploaded, error: uploadError } = await supabase.storage
    .from(FARM_IMAGE_BUCKET)
    .upload(path, arrayBuffer, { contentType: getImageMimeType(extension), upsert: false });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(FARM_IMAGE_BUCKET).getPublicUrl(uploaded.path);
  const { error: updateError } = await supabase
    .from("farms")
    .update({ image_path: uploaded.path, image_url: urlData.publicUrl })
    .eq("id", farmId);
  if (updateError) {
    await supabase.storage.from(FARM_IMAGE_BUCKET).remove([uploaded.path]);
    throw updateError;
  }
  const previousPath =
    currentFarm && typeof currentFarm.image_path === "string" ? currentFarm.image_path : null;
  if (previousPath && previousPath !== uploaded.path) {
    const { error: removeError } = await supabase.storage.from(FARM_IMAGE_BUCKET).remove([previousPath]);
    if (removeError) console.warn("Could not remove previous farm image", removeError.message);
  }

  return { path: uploaded.path, url: urlData.publicUrl };
}

export async function clearFarmImage(farmId: string, imagePath?: string | null) {
  if (imagePath) {
    const { error } = await supabase.storage.from(FARM_IMAGE_BUCKET).remove([imagePath]);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("farms")
    .update({ image_path: null, image_url: null })
    .eq("id", farmId);
  if (error) throw error;
}
