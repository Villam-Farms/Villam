import { supabase } from "@/lib/supabase";

export type SavedItemType = "farm" | "produce" | "listing" | "recipe";
export type SavedSearchContext = "home" | "produce" | "marketplace";
export type SavedSearchFilters = { category?: string };

export type SavedItem = {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_id: string;
  created_at: string;
  updated_at: string;
};

export type SavedSearch = {
  id: string;
  user_id: string;
  context: SavedSearchContext;
  query: string;
  filters: SavedSearchFilters;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export async function fetchSavedItems(): Promise<SavedItem[]> {
  const { data, error } = await supabase.from("saved_items").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedItem[];
}

export async function setItemSaved(userId: string, itemType: SavedItemType, itemId: string, saved: boolean) {
  if (saved) {
    const { error } = await supabase.from("saved_items").upsert(
      { user_id: userId, item_type: itemType, item_id: itemId, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_type,item_id" }
    );
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("saved_items").delete().eq("user_id", userId).eq("item_type", itemType).eq("item_id", itemId);
  if (error) throw error;
}

export async function fetchSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase.from("saved_searches").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedSearch[];
}

export function savedSearchName(context: SavedSearchContext, query: string, filters: SavedSearchFilters = {}) {
  const prefix = context === "marketplace" ? "Marketplace" : context === "produce" ? "Produce" : "Home";
  const detail = [query.trim(), filters.category && filters.category !== "All" ? filters.category : ""].filter(Boolean).join(" · ");
  return detail ? `${prefix}: ${detail}` : prefix;
}

export async function saveSearch(userId: string, context: SavedSearchContext, query: string, filters: SavedSearchFilters = {}) {
  const normalizedQuery = query.trim();
  const normalizedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== "All"));
  const { data: existing, error: findError } = await supabase.from("saved_searches").select("id").eq("user_id", userId).eq("context", context).eq("query", normalizedQuery).eq("filters", normalizedFilters).maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;
  const { data, error } = await supabase.from("saved_searches").insert({
    user_id: userId,
    context,
    query: normalizedQuery,
    filters: normalizedFilters,
    display_name: savedSearchName(context, normalizedQuery, normalizedFilters),
  }).select("*").single();
  if (error) throw error;
  return data as SavedSearch;
}

export async function renameSavedSearch(id: string, displayName: string) {
  const { error } = await supabase.from("saved_searches").update({ display_name: displayName.trim(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteSavedSearch(id: string) {
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) throw error;
}
