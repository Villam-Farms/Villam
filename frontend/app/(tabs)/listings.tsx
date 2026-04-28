import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";

import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useFarms } from "@/hooks/useFarms";
import { openDirections } from "@/lib/directions";
import { formatAddress } from "@/lib/address";
import { fetchMarketplaceListings } from "@/lib/marketplace";
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
  const { coords: userCoords, locationText } = useCurrentLocation();
  const { data: farms = [], isLoading, error } = useFarms();
  const [activeFilter, setActiveFilter] = useState<ListingCategory>("All");
  const {
    data: marketplaceListings = [],
    isLoading: listingsLoading,
    error: listingsError,
  } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: fetchMarketplaceListings,
  });

  const listings = useMemo<ListingRow[]>(
    () => buildListingRows(marketplaceListings, userCoords),
    [marketplaceListings, userCoords]
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

  const handleFarmPress = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  const handleDirectionPress = async (farmId: number) => {
    const farm = farms.find((f) => f.id === farmId);
    const listing = listings.find((item) => item.farmId === farmId);
    const fallbackAddress = listing
      ? formatAddress({
          city: listing.city,
          state: listing.state,
          postal_code: listing.postal_code,
          country: listing.country,
        })
      : "";

    if (!farm) return;

    const formattedFarmAddress = formatAddress(farm);
    const finalDest =
      formattedFarmAddress.trim() || fallbackAddress.trim()
        ? formattedFarmAddress.trim() || fallbackAddress.trim()
        : `${farm.latitude},${farm.longitude}`;

    try {
      await openDirections(finalDest);
    } catch (e) {
      console.log("Could not open directions", e);
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
      >
        {/* ── Hero Header ── */}
        <View style={[styles.hero, { paddingTop: theme.spacing.lg + insets.top }]}>
          {/* Decorative blobs */}
          <View style={styles.blobLarge} />
          <View style={styles.blobSmall} />

          <View style={styles.heroInner}>
            <ThemedText style={styles.heroEyebrow}>Nearby produce</ThemedText>
            <ThemedText style={styles.heroTitle}>Listings</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Browse farm produce by item, price, and source.
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
                style={styles.manageListingButton}
                onPress={() => router.push("/listing/manage")}
                activeOpacity={0.88}
              >
                <Ionicons name="settings-outline" size={18} color="#2E2A1F" />
                <ThemedText style={styles.manageListingButtonText}>
                  Manage listings
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.locationPill}>
              <View style={styles.locationDot} />
              <ThemedText style={styles.locationText}>{locationText}</ThemedText>
            </View>

            <TouchableOpacity
              style={[
                styles.searchBar,
                {
                  backgroundColor: "rgba(255,255,255,0.78)",
                  borderColor: "rgba(46,42,31,0.08)",
                },
              ]}
              onPress={() => router.push("/listing/search")}
              activeOpacity={0.85}
            >
              <Ionicons name="search" size={18} color={colors.text.tertiary} />
              <ThemedText style={[styles.searchInput, { color: colors.input.placeholder }]}>
                Search produce, farm, or category
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Filter Pills ── */}
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

        {/* ── Listings ── */}
        {isLoading || listingsLoading ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Loading listings…
          </ThemedText>
        ) : error || listingsError ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Could not load listings.
          </ThemedText>
        ) : filteredListings.length === 0 ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            No listings in this category yet.
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
                onPress={() => handleFarmPress(item.farmId)}
              >
                {/* Thumb */}
                <View style={[styles.cardThumb, { backgroundColor: item.color }]}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.cardThumbImage} contentFit="cover" />
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

                  {/* Footer: farm + directions */}
                  <View style={styles.cardFooter}>
                    <View style={styles.farmTag}>
                      <View
                        style={[styles.farmDot, { backgroundColor: item.farmDotColor }]}
                      />
                      <ThemedText
                        style={[styles.farmName, { color: colors.text.secondary }]}
                        numberOfLines={1}
                      >
                        {item.farmName}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.dirButton,
                        { borderColor: colors.border.light, backgroundColor: colors.card },
                      ]}
                      onPress={() => handleDirectionPress(item.farmId)}
                      hitSlop={8}
                    >
                      <Ionicons name="navigate-outline" size={12} color={colors.text.primary} />
                      <ThemedText
                        style={[styles.dirButtonText, { color: colors.text.primary }]}
                      >
                        Directions
                      </ThemedText>
                    </TouchableOpacity>
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
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: theme.spacing.sm,
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
  manageListingButton: {
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
  manageListingButtonText: {
    color: "#2E2A1F",
    fontSize: 13,
    fontWeight: "700",
  },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#6E7B37",
  },
  locationText: {
    fontSize: 12,
    color: "#5A564B",
    fontWeight: "500",
  },
  searchBar: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#2E2A1F",
  },

  // ── Filters ──
  filterScroll: {
    marginTop: theme.spacing.md,
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

  // ── Listings ──
  listingsStack: {
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
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
  farmTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  farmDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  farmName: {
    fontSize: 11,
    flex: 1,
  },
  dirButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dirButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
