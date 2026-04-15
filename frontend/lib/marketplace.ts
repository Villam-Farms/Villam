import { supabase } from "@/lib/supabase";

export const SOLD_BY_OPTIONS = ["lb", "pint", "bunch", "each"] as const;
export const CURRENCY_OPTIONS = ["USD", "CAD", "EUR"] as const;

export type SoldByOption = (typeof SOLD_BY_OPTIONS)[number];
export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number];

export type ProduceItemOption = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  default_sold_by: string | null;
};

export type ProduceVarietyOption = {
  id: string;
  produce_item_id: string;
  name: string;
  description: string | null;
};

export type ProduceCatalog = {
  items: ProduceItemOption[];
  varieties: ProduceVarietyOption[];
};

export type MarketplaceListing = {
  id: string;
  farmId: number;
  farmName: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  produceItemId: string;
  produceItemName: string;
  category: string;
  varietyId: string;
  varietyName: string;
  varietyDescription: string | null;
  price: number;
  currency: string;
  soldBy: string;
  available: boolean;
};

type FarmRow = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

type ListingRow = {
  id: string;
  farm_id: number;
  produce_variety_id: string;
  price: number;
  currency: string;
  sold_by: string;
  available: boolean;
};

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

async function hydrateMarketplaceListings(listings: ListingRow[]): Promise<MarketplaceListing[]> {
  if (listings.length === 0) return [];

  const farmIds = uniqueValues(listings.map((listing) => listing.farm_id));
  const varietyIds = uniqueValues(listings.map((listing) => listing.produce_variety_id));

  const [{ data: farmRows, error: farmError }, { data: varieties, error: varietyError }] =
    await Promise.all([
      supabase
        .from("farms")
        .select("id,name,latitude,longitude,city,state,postal_code,country")
        .in("id", farmIds),
      supabase
        .from("produce_varieties")
        .select("id,produce_item_id,name,description")
        .in("id", varietyIds),
    ]);

  if (farmError) throw farmError;
  if (varietyError) throw varietyError;

  const produceItemIds = uniqueValues(
    ((varieties ?? []) as ProduceVarietyOption[]).map((variety) => variety.produce_item_id)
  );

  const { data: items, error: itemError } = await supabase
    .from("produce_items")
    .select("id,name,category,description,default_sold_by")
    .in("id", produceItemIds);

  if (itemError) throw itemError;

  const farmMap = new Map<number, FarmRow>(
    ((farmRows ?? []) as FarmRow[]).map((farm) => [farm.id, farm])
  );
  const varietyMap = new Map<string, ProduceVarietyOption>(
    ((varieties ?? []) as ProduceVarietyOption[]).map((variety) => [variety.id, variety])
  );
  const itemMap = new Map<string, ProduceItemOption>(
    ((items ?? []) as ProduceItemOption[]).map((item) => [item.id, item])
  );

  return listings
    .map((listing) => {
      const farm = farmMap.get(listing.farm_id);
      const variety = varietyMap.get(listing.produce_variety_id);
      const produceItem = variety ? itemMap.get(variety.produce_item_id) : null;

      if (!farm || !variety || !produceItem) return null;

      return {
        id: listing.id,
        farmId: farm.id,
        farmName: farm.name,
        latitude: farm.latitude,
        longitude: farm.longitude,
        city: farm.city,
        state: farm.state,
        postal_code: farm.postal_code,
        country: farm.country,
        produceItemId: produceItem.id,
        produceItemName: produceItem.name,
        category: produceItem.category?.trim() || "Other",
        varietyId: variety.id,
        varietyName: variety.name,
        varietyDescription: variety.description,
        price: Number(listing.price),
        currency: listing.currency,
        soldBy: listing.sold_by,
        available: listing.available,
      } satisfies MarketplaceListing;
    })
    .filter((listing): listing is MarketplaceListing => listing !== null)
    .sort((left, right) => left.produceItemName.localeCompare(right.produceItemName));
}

export async function fetchProduceCatalog(): Promise<ProduceCatalog> {
  const [{ data: items, error: itemsError }, { data: varieties, error: varietiesError }] =
    await Promise.all([
      supabase
        .from("produce_items")
        .select("id,name,category,description,default_sold_by")
        .order("name", { ascending: true }),
      supabase
        .from("produce_varieties")
        .select("id,produce_item_id,name,description")
        .order("name", { ascending: true }),
    ]);

  if (itemsError) throw itemsError;
  if (varietiesError) throw varietiesError;

  return {
    items: (items ?? []) as ProduceItemOption[],
    varieties: (varieties ?? []) as ProduceVarietyOption[],
  };
}

export async function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  const { data: listingRows, error: listingError } = await supabase
    .from("farm_listings")
    .select("id,farm_id,produce_variety_id,price,currency,sold_by,available")
    .eq("available", true)
    .order("id", { ascending: false });

  if (listingError) throw listingError;
  return hydrateMarketplaceListings((listingRows ?? []) as ListingRow[]);
}

export async function fetchFarmListingsByFarmId(farmId: number): Promise<MarketplaceListing[]> {
  const { data, error } = await supabase
    .from("farm_listings")
    .select("id,farm_id,produce_variety_id,price,currency,sold_by,available")
    .eq("farm_id", farmId)
    .order("id", { ascending: false });

  if (error) throw error;

  return hydrateMarketplaceListings((data ?? []) as ListingRow[]);
}

export type CreateFarmListingInput = {
  farm_id: number;
  produce_variety_id: string;
  price: number;
  currency: string;
  sold_by: string;
  available: boolean;
};

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown listing creation error.";
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

export async function createFarmListing(input: CreateFarmListingInput) {
  const { error } = await supabase.from("farm_listings").insert({
    farm_id: input.farm_id,
    produce_variety_id: input.produce_variety_id,
    price: input.price,
    currency: input.currency,
    sold_by: input.sold_by,
    available: input.available,
  });

  if (error) throw new Error(formatSupabaseError(error));
}

export type UpdateFarmListingInput = {
  id: string;
  produce_variety_id: string;
  price: number;
  currency: string;
  sold_by: string;
  available: boolean;
};

export async function updateFarmListing(input: UpdateFarmListingInput) {
  const { error } = await supabase
    .from("farm_listings")
    .update({
      produce_variety_id: input.produce_variety_id,
      price: input.price,
      currency: input.currency,
      sold_by: input.sold_by,
      available: input.available,
    })
    .eq("id", input.id);

  if (error) throw new Error(formatSupabaseError(error));
}
