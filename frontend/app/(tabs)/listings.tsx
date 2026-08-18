import React, { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";

import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/context/auth-context";
import { fetchOwnedFarmByUserId } from "@/lib/farms";
import { fetchFarmListingsByFarmId } from "@/lib/marketplace";
import { getListingVisuals } from "@/lib/listing-visuals";
import {
  buildListingRows,
  filterListingRows,
  type ListingCategory,
  type ListingRow,
} from "@/lib/listing-browser";

export default function ListingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [activeFilter, setActiveFilter] = useState<ListingCategory>("All");
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: ownedFarm,
    isLoading: farmLoading,
    error: farmError,
    refetch: refetchFarm,
  } = useQuery({
    queryKey: ["owned-farm", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      if (!session?.user.id) return null;
      return fetchOwnedFarmByUserId(session.user.id);
    },
  });
  const {
    data: ownedListings = [],
    isLoading: listingsLoading,
    error: listingsError,
    refetch: refetchListings,
  } = useQuery({
    queryKey: ["owned-marketplace-listings", ownedFarm?.id],
    enabled: !!ownedFarm?.id,
    queryFn: async () => fetchFarmListingsByFarmId(ownedFarm!.id),
  });

  const listings = useMemo<ListingRow[]>(
    () => buildListingRows(ownedListings, null),
    [ownedListings]
  );

  const filters = useMemo<ListingCategory[]>(
    () => ["All", ...Array.from(new Set(listings.map((listing) => listing.category))).sort()],
    [listings]
  );

  const filteredListings = useMemo(
    () => filterListingRows(listings, activeFilter, ""),
    [listings, activeFilter]
  );

  const getFilterColors = (filter: ListingCategory) => {
    if (filter === "All") {
      return {
        backgroundColor: "#3D6B2F",
        borderColor: "#3D6B2F",
        textColor: "#FFFFFF",
      };
    }

    const visuals = getListingVisuals(filter);
    return {
      backgroundColor: visuals.badgeColor,
      borderColor: visuals.badgeColor,
      textColor: visuals.badgeTextColor,
    };
  };

  const refreshListings = async () => {
    setRefreshing(true);
    try {
      const farmResult = await refetchFarm();
      if (farmResult.data?.id) {
        await refetchListings();
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshListings()}
            tintColor={theme.brand.primary}
          />
        }
      >
        {/* ── Hero Header ── */}
        <View style={[styles.hero, { paddingTop: theme.spacing.lg + insets.top }]}>
          {ownedFarm?.imageUrl ? (
            <>
              <Image source={{ uri: ownedFarm.imageUrl }} style={styles.heroImage} contentFit="cover" />
              <View style={styles.heroImageOverlay} />
            </>
          ) : null}
          {/* Decorative blobs */}
          <View style={styles.blobLarge} />
          <View style={styles.blobSmall} />

          <View style={styles.heroInner}>
            <ThemedText style={styles.heroEyebrow}>Your farm</ThemedText>
            <ThemedText style={styles.heroTitle}>{ownedFarm?.name ?? "My listings"}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Add produce and keep your availability up to date.
            </ThemedText>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.createListingButton}
                onPress={() => router.push("/listing/new")}
                activeOpacity={0.88}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <ThemedText style={styles.createListingButtonText}>
                  List your produce
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manageFarmButton}
                onPress={() => router.push("/farm/manage")}
                activeOpacity={0.88}
              >
                <Ionicons name="leaf-outline" size={18} color="#2E2A1F" />
                <ThemedText style={styles.manageFarmButtonText}>Manage farm</ThemedText>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        <View style={styles.listHeader}>
          <View>
            <ThemedText style={[styles.listTitle, { color: colors.text.primary }]}>
              Your listings
            </ThemedText>
            <ThemedText style={[styles.listCount, { color: colors.text.secondary }]}>
              {listings.length} {listings.length === 1 ? "item" : "items"} listed
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.manageTextButton, { borderColor: colors.border.light, backgroundColor: colors.card }]}
            onPress={() => router.push("/listing/manage")}
            activeOpacity={0.85}
          >
            <ThemedText style={[styles.manageTextButtonText, { color: colors.text.primary }]}>
              Manage
            </ThemedText>
            <Ionicons name="chevron-forward" size={15} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {filters.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  activeFilter === filter
                    ? getFilterColors(filter)
                    : { borderColor: colors.border.light, backgroundColor: colors.background },
                ]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[
                    styles.filterPillText,
                    {
                      color:
                        activeFilter === filter
                          ? getFilterColors(filter).textColor
                          : colors.text.secondary,
                    },
                  ]}
                >
                  {filter}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* ── Listings ── */}
        {!session?.user.id ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Sign in to view and manage your farm listings.
          </ThemedText>
        ) : farmLoading || listingsLoading ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Loading listings…
          </ThemedText>
        ) : farmError || listingsError ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Could not load listings.
          </ThemedText>
        ) : !ownedFarm ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Create your farm to start adding produce.
          </ThemedText>
        ) : filteredListings.length === 0 ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            You have no listings in this category yet.
          </ThemedText>
        ) : (
          <View style={styles.listingsStack}>
            {filteredListings.map((item) => (
              <TouchableOpacity
                key={`${item.farmId}-${item.id}`}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border.light },
                ]}
                activeOpacity={0.88}
                onPress={() => router.push("/listing/manage")}
              >
                {/* Thumb */}
                <View style={[styles.cardThumb, { backgroundColor: item.color }]}>
                  {item.imageUrl || item.farmImageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl ?? item.farmImageUrl! }}
                      style={styles.cardThumbImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name={item.icon} size={30} color={theme.brand.primary} />
                  )}
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: item.badgeColor },
                    ]}
                  >
                    <ThemedText
                      style={[styles.categoryBadgeText, { color: item.badgeTextColor }]}
                    >
                      {item.category === "Eggs & Dairy" ? "Eggs" : item.category}
                    </ThemedText>
                  </View>
                </View>

                {/* Body */}
                <View style={styles.cardBody}>
                  {/* Top row: name + price */}
                  <View style={styles.cardTopRow}>
                    <ThemedText
                      style={[styles.itemName, { color: colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </ThemedText>
                    <View style={[styles.pricePill, { backgroundColor: colors.card }]}>
                      <ThemedText style={[styles.priceText, { color: colors.text.primary }]}>
                        {item.price}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Unit */}
                  <ThemedText style={[styles.itemUnit, { color: colors.text.secondary }]}>
                    {item.unit}
                  </ThemedText>

                  {/* Note */}
                  <ThemedText
                    style={[styles.itemNote, { color: colors.text.secondary }]}
                    numberOfLines={2}
                  >
                    {item.note}
                  </ThemedText>

                  <View style={styles.cardFooter}>
                    <ThemedText style={[styles.editHint, { color: colors.text.tertiary }]}>
                      Tap to edit
                    </ThemedText>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.sm,
  },

  // ── Hero ──
  hero: {
    backgroundColor: "#F7E5BF",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(247, 229, 191, 0.38)",
  },
  blobLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#F0C26A",
    opacity: 0.45,
    top: 10,
    right: -50,
  },
  blobSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#DCC16C",
    opacity: 0.35,
    bottom: -24,
    left: -24,
  },
  heroInner: {
    position: "relative",
    gap: theme.spacing.xs,
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6E7B37",
    fontWeight: "600",
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#2E2A1F",
    lineHeight: 40,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "#5A564B",
    lineHeight: 20,
    maxWidth: "85%",
  },
  createListingButton: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: "#3D6B2F",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  createListingButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  actionButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: theme.spacing.md,
  },
  manageFarmButton: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(46,42,31,0.08)",
  },
  manageFarmButtonText: {
    color: "#2E2A1F",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Filters ──
  filterScroll: {
    marginTop: theme.spacing.sm,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  listHeader: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  listCount: {
    fontSize: 13,
    marginTop: 2,
  },
  manageTextButton: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  manageTextButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Listings ──
  listingsStack: {
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  statusText: {
    fontSize: 14,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },

  // ── Card ──
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  cardThumb: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    position: "relative",
    overflow: "hidden",
  },
  cardThumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.md,
    gap: 3,
    justifyContent: "space-between",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  pricePill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priceText: {
    fontSize: 13,
    fontWeight: "700",
  },
  itemUnit: {
    fontSize: 12,
  },
  itemNote: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  editHint: {
    fontSize: 11,
    fontWeight: "600",
  },
});
