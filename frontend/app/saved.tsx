import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { SaveButton } from "@/components/save-button";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useFarms } from "@/hooks/useFarms";
import { useSavedItems, useSavedSearches } from "@/hooks/useSaved";
import { useAuth } from "@/context/auth-context";
import { deleteSavedSearch, renameSavedSearch, setItemSaved, type SavedItem, type SavedItemType, type SavedSearch } from "@/lib/saved";
import { fetchMarketplaceListings, type MarketplaceListing } from "@/lib/marketplace";
import { recipes as localRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { Image } from "expo-image";

type SavedDisplay = { type: SavedItemType; id: string; title: string; subtitle: string; route: string; imageUrl?: string | null };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const ITEM_ICONS: Record<SavedItemType, React.ComponentProps<typeof Ionicons>["name"]> = {
  farm: "storefront-outline", produce: "leaf-outline", listing: "pricetag-outline", recipe: "restaurant-outline",
};
async function recipeImage(row: any) {
  const media = Array.isArray(row.cover_media) ? row.cover_media : [];
  const path = row.cover_image_path || media.find((item: any) => item?.path)?.path;
  if (path) {
    const { data } = await supabase.storage.from("recipes").createSignedUrl(path, 60 * 60);
    if (data?.signedUrl) return data.signedUrl;
  }
  return row.cover_image_url || media.find((item: any) => item?.url)?.url || null;
}
const FILTERS: { type: SavedItemType; label: string }[] = [
  { type: "farm", label: "Farms" }, { type: "produce", label: "Produce" },
  { type: "listing", label: "Listings" }, { type: "recipe", label: "Recipes" },
];

export default function SavedScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const headerAnimation = useRef(new Animated.Value(0)).current;
  const contentAnimation = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<"items" | "searches">("items");
  const [filter, setFilter] = useState<SavedItemType>("farm");
  const [displayItems, setDisplayItems] = useState<SavedDisplay[]>([]);
  const [staleItems, setStaleItems] = useState<SavedItem[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const savedItems = useSavedItems();
  const savedSearches = useSavedSearches();
  const { data: farms = [], isLoading: farmsLoading } = useFarms();

  useEffect(() => {
    Animated.spring(headerAnimation, {
      toValue: 1,
      damping: 18,
      stiffness: 150,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [headerAnimation]);

  useEffect(() => {
    contentAnimation.setValue(0);
    Animated.timing(contentAnimation, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentAnimation, filter, tab]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (savedItems.isLoading || farmsLoading) return;
      const items = savedItems.data ?? [];
      setHydrating(true);
      try {
        const produceIds = items.filter((x) => x.item_type === "produce").map((x) => x.item_id);
        const listingIds = items.filter((x) => x.item_type === "listing").map((x) => x.item_id);
        const recipeIds = items.filter((x) => x.item_type === "recipe").map((x) => x.item_id);
        const dbRecipeIds = recipeIds.filter(isUuid);
        const [produceResult, listings, recipeResult] = await Promise.all([
          produceIds.length ? supabase.from("produce_items").select("id,name,category").in("id", produceIds) : Promise.resolve({ data: [], error: null }),
          listingIds.length ? fetchMarketplaceListings() : Promise.resolve([] as MarketplaceListing[]),
          dbRecipeIds.length ? supabase.from("recipes").select("id,title,description,cover_image_url,cover_image_path,cover_media").in("id", dbRecipeIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (produceResult.error) throw produceResult.error;
        if (recipeResult.error) throw recipeResult.error;
        const farmMap = new Map(farms.map((farm) => [farm.id, farm]));
        const produceMap = new Map((produceResult.data ?? []).map((item: any) => [item.id, item]));
        const listingMap = new Map(listings.map((item) => [item.id, item]));
        const hydratedRecipes = await Promise.all((recipeResult.data ?? []).map(async (item: any) => ({ ...item, imageUrl: await recipeImage(item) })));
        const recipeMap = new Map(hydratedRecipes.map((item: any) => [item.id, item]));
        const localMap = new Map(localRecipes.map((item) => [item.id, item]));
        const next = items.flatMap<SavedDisplay>((saved) => {
          if (saved.item_type === "farm") {
            const farm = farmMap.get(saved.item_id); return farm ? [{ type: "farm", id: farm.id, title: farm.name, subtitle: farm.products || "Local farm", route: `/farm/${farm.id}` }] : [];
          }
          if (saved.item_type === "produce") {
            const item: any = produceMap.get(saved.item_id); return item ? [{ type: "produce", id: item.id, title: item.name, subtitle: item.category, route: `/produce/${item.id}` }] : [];
          }
          if (saved.item_type === "listing") {
            const item = listingMap.get(saved.item_id); return item ? [{ type: "listing", id: item.id, title: `${item.varietyName} ${item.produceItemName}`, subtitle: `${item.farmName} · ${item.currency} ${item.price}/${item.soldBy}`, route: `/produce/${item.produceItemId}`, imageUrl: item.imageUrl }] : [];
          }
          const item: any = recipeMap.get(saved.item_id) ?? localMap.get(saved.item_id);
          return item ? [{ type: "recipe", id: item.id, title: item.title, subtitle: item.description || "Recipe", route: `/recipe/${item.id}`, imageUrl: item.imageUrl }] : [];
        });
        if (!cancelled) {
          setDisplayItems(next);
          const available = new Set(next.map((item) => `${item.type}:${item.id}`));
          setStaleItems(items.filter((item) => !available.has(`${item.item_type}:${item.item_id}`)));
        }
      } catch (error) {
        if (!cancelled) Alert.alert("Could not load saved items", error instanceof Error ? error.message : "Please try again.");
      } finally { if (!cancelled) setHydrating(false); }
    }
    hydrate();
    return () => { cancelled = true; };
  }, [farms, farmsLoading, savedItems.data, savedItems.isLoading]);

  const visibleItems = useMemo(() => displayItems.filter((item) => item.type === filter), [displayItems, filter]);
  const openSearch = (item: SavedSearch) => {
    const params: Record<string, string> = { query: item.query };
    if (item.filters.category) params.category = item.filters.category;
    if (item.context === "home") router.push({ pathname: "/(tabs)", params });
    else if (item.context === "produce") router.push({ pathname: "/produce", params });
    else router.push({ pathname: "/listing/search", params });
  };
  const refreshSearches = () => queryClient.invalidateQueries({ queryKey: ["saved-searches", session?.user.id] });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.header, { opacity: headerAnimation, transform: [{ translateY: headerAnimation.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.circle, { backgroundColor: colors.card }]}><Ionicons name="arrow-back" size={20} color={colors.text.primary} /></TouchableOpacity><ThemedText type="title" style={styles.title}>Saved</ThemedText></Animated.View>
      <Animated.View style={[styles.tabs, { backgroundColor: colors.input.background, opacity: headerAnimation, transform: [{ scale: headerAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}> 
        {(["items", "searches"] as const).map((value) => <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: tab === value }} key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && { backgroundColor: theme.brand.primary }]}><Ionicons name={value === "items" ? "heart-outline" : "search-outline"} size={17} color={tab === value ? "#fff" : colors.text.secondary} /><ThemedText style={{ fontWeight: "700", color: tab === value ? "#fff" : colors.text.secondary }}>{value === "items" ? "Favorites" : "Searches"}</ThemedText></TouchableOpacity>)}
      </Animated.View>
      <Animated.View style={[styles.animatedContent, { opacity: contentAnimation, transform: [{ translateY: contentAnimation.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {tab === "items" ? <>
        <ScrollView horizontal style={styles.filterScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTERS.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: filter === item.type }} key={item.type} onPress={() => setFilter(item.type)} style={[styles.filter, { borderColor: filter === item.type ? theme.brand.primary : colors.border.light, backgroundColor: filter === item.type ? theme.brand.light : colors.background }]}><Ionicons name={ITEM_ICONS[item.type]} size={15} color={filter === item.type ? theme.brand.primary : colors.text.secondary} /><ThemedText style={{ color: filter === item.type ? theme.brand.primary : colors.text.secondary, fontWeight: "600" }}>{item.label}</ThemedText></TouchableOpacity>)}</ScrollView>
        <ScrollView contentContainerStyle={styles.list}>{savedItems.isLoading || farmsLoading || hydrating ? <ActivityIndicator accessibilityLabel="Loading saved favorites" color={theme.brand.primary} /> : <>{staleItems.length > 0 ? <TouchableOpacity accessibilityRole="button" style={[styles.cleanup, { borderColor: colors.border.light }]} onPress={async () => { if (!session?.user.id) return; await Promise.all(staleItems.map((item) => setItemSaved(session.user.id, item.item_type, item.item_id, false))); await queryClient.invalidateQueries({ queryKey: ["saved-items", session.user.id] }); }}><Ionicons name="trash-outline" size={18} color="#C84B3A" /><ThemedText style={{ color: colors.text.secondary }}>Remove {staleItems.length} unavailable {staleItems.length === 1 ? "item" : "items"}</ThemedText></TouchableOpacity> : null}{visibleItems.length === 0 ? <Empty text={`No saved ${FILTERS.find((x) => x.type === filter)?.label.toLowerCase()} yet.`} /> : visibleItems.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} key={`${item.type}-${item.id}`} onPress={() => router.push(item.route as any)} style={[styles.row, { borderColor: colors.border.light, backgroundColor: colors.surface }]}><View style={[styles.thumbnail, { backgroundColor: theme.brand.light }]}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} contentFit="cover" /> : <Ionicons name={ITEM_ICONS[item.type]} size={24} color={theme.brand.primary} />}</View><View style={styles.rowCopy}><ThemedText style={styles.rowTitle} numberOfLines={2}>{item.title}</ThemedText><ThemedText style={{ color: colors.text.secondary }} numberOfLines={2}>{item.subtitle}</ThemedText></View><SaveButton type={item.type} itemId={item.id} /></TouchableOpacity>)}</>}</ScrollView>
      </> : <ScrollView contentContainerStyle={styles.list}>{savedSearches.isLoading ? <ActivityIndicator accessibilityLabel="Loading saved searches" color={theme.brand.primary} /> : !savedSearches.data?.length ? <Empty text="No saved searches yet." /> : savedSearches.data.map((item) => <View key={item.id} style={[styles.searchRow, { borderColor: colors.border.light, backgroundColor: colors.surface }]}>{editingId === item.id ? <TextInput accessibilityLabel="Saved search name" autoFocus value={nameDraft} onChangeText={setNameDraft} style={[styles.renameInput, { color: colors.text.primary, borderColor: colors.border.light }]} onSubmitEditing={async () => { if (!nameDraft.trim()) return; await renameSavedSearch(item.id, nameDraft); setEditingId(null); refreshSearches(); }} /> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open saved search ${item.display_name}`} style={styles.rowCopy} onPress={() => openSearch(item)}><ThemedText style={styles.rowTitle}>{item.display_name}</ThemedText><ThemedText style={{ color: colors.text.secondary }}>{item.context} · {item.query || item.filters.category || "All"}</ThemedText></TouchableOpacity>}<TouchableOpacity accessibilityRole="button" accessibilityLabel={`Rename ${item.display_name}`} onPress={() => { setEditingId(item.id); setNameDraft(item.display_name); }}><Ionicons name="pencil-outline" size={20} color={colors.text.secondary} /></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${item.display_name}`} onPress={async () => { await deleteSavedSearch(item.id); refreshSearches(); }}><Ionicons name="trash-outline" size={20} color="#C84B3A" /></TouchableOpacity></View>)}</ScrollView>}
      </Animated.View>
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) { return <View style={styles.empty}><Ionicons name="bookmark-outline" size={36} color={theme.brand.primary} /><ThemedText>{text}</ThemedText></View>; }
const styles = StyleSheet.create({
  screen: { flex: 1 }, animatedContent: { flex: 1 }, header: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }, circle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }, title: { fontSize: 30, lineHeight: 38, fontWeight: "800", includeFontPadding: false },
  tabs: { flexDirection: "row", marginHorizontal: theme.spacing.lg, borderRadius: 18, padding: 4, gap: 4 }, tab: { flex: 1, minHeight: 42, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 14 }, filterScroller: { flexGrow: 0, flexShrink: 0 }, filters: { gap: 8, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }, filter: { height: 38, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 19, paddingHorizontal: 13 },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: 12, flexGrow: 1 }, cleanup: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }, row: { minHeight: 88, borderWidth: 1, borderRadius: 20, padding: 10, flexDirection: "row", alignItems: "center", gap: 12 }, thumbnail: { width: 66, height: 66, borderRadius: 15, alignItems: "center", justifyContent: "center", overflow: "hidden" }, thumbnailImage: { width: "100%", height: "100%" }, rowCopy: { flex: 1, minWidth: 0, gap: 5 }, rowTitle: { fontSize: 17, lineHeight: 22, fontWeight: "700" }, searchRow: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, renameInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 9 }, empty: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12 },
});
