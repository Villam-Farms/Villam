import { supabase } from "@/lib/supabase";
import type { FarmWithCoords } from "@/lib/location";

const FARM_SELECT_COLUMNS =
  "id,name,latitude,longitude,city,state,postal_code,country,website,description";

export async function fetchFarms(): Promise<FarmWithCoords[]> {
  const { data, error } = await supabase
    .from("farms")
    .select(FARM_SELECT_COLUMNS)
    .order("id", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((farm) => ({
    ...farm,
    rating: 0,
    reviews: 0,
    products: "",
    street: null,
  })) as FarmWithCoords[];
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
  id: number;
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

function normalizeFarmRecord(data: Record<string, unknown>) {
  return {
    ...data,
    rating: 0,
    reviews: 0,
    products: "",
    street: null,
  } as FarmWithCoords;
}

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

export async function fetchFarmById(farmId: number): Promise<FarmWithCoords | null> {
  const { data, error } = await supabase
    .from("farms")
    .select(FARM_SELECT_COLUMNS)
    .eq("id", farmId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeFarmRecord(data);
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
  return farm ? normalizeFarmRecord(farm) : null;
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
