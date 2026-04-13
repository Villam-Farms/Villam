import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { addDistanceAndSort } from "@/lib/location";
import { useFarms } from "@/hooks/useFarms";
import { openDirections } from "@/lib/directions";
import { formatAddress } from "@/lib/address";
import { getMockFarmProfile } from "@/lib/mock-farms";

type ListingCategory = "All" | "Vegetables" | "Fruit" | "Herbs" | "Eggs & Dairy";

type ListingRow = {
  id: string;
  name: string;
  unit: string;
  price: string;
  note: string;
  color: string;
  badgeColor: string;
  badgeTextColor: string;
  farmDotColor: string;
  category: ListingCategory;
  icon: "leaf-outline" | "nutrition-outline" | "flower-outline" | "sunny-outline";
  farmId: number;
  farmName: string;
};

const FILTERS: ListingCategory[] = ["All", "Vegetables", "Fruit", "Herbs", "Eggs & Dairy"];

export default function ListingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { coords: userCoords, locationText } = useCurrentLocation();
  const { data: farms = [], isLoading, error } = useFarms();
  const [activeFilter, setActiveFilter] = useState<ListingCategory>("All");

  const farmsWithDistance = useMemo(
    () => addDistanceAndSort(farms, userCoords),
    [farms, userCoords]
  );

  const listings = useMemo<ListingRow[]>(
    () =>
      farmsWithDistance.flatMap((farm) => {
        const profile = getMockFarmProfile(farm.id, farm);
        return profile.produceListings.map((listing) => ({
          id: listing.id,
          name: listing.name,
          price: listing.price,
          unit: listing.unit,
          note: listing.note,
          color: listing.color,
          icon: listing.icon,
          badgeColor: "#C0DD97",
          badgeTextColor: "#27500A",
          farmDotColor: "#639922",
          category: "Vegetables" as ListingCategory,
          farmId: farm.id,
          farmName: farm.name,
        }));
      }),
    [farmsWithDistance]
  );

  const filteredListings = useMemo(
    () =>
      activeFilter === "All"
        ? listings
        : listings.filter((l) => l.category === activeFilter),
    [listings, activeFilter]
  );

  const handleFarmPress = (farmId: number) => {
    router.push(`/farm/${farmId}`);
  };

  const handleDirectionPress = async (farmId: number) => {
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;
    const hasRealAddress =
      !!farm.street?.trim() && (!!farm.city?.trim() || !!farm.postal_code?.trim());
    const finalDest = hasRealAddress
      ? formatAddress(farm)
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
    >
    <View style={{ height: insets.top, backgroundColor: "#F7E5BF", position: "absolute", top: 0, left: 0, right: 0 }} />
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

            <View style={styles.locationPill}>
              <View style={styles.locationDot} />
              <ThemedText style={styles.locationText}>{locationText}</ThemedText>
            </View>
          </View>
        </View>

        {/* ── Filter Pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterPill,
                { borderColor: colors.border.light },
                activeFilter === filter && styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.8}
            >
              <ThemedText
                style={[
                  styles.filterPillText,
                  { color: colors.text.secondary },
                  activeFilter === filter && styles.filterPillTextActive,
                ]}
              >
                {filter}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Listings ── */}
        {isLoading ? (
          <ThemedText style={[styles.statusText, { color: colors.text.tertiary }]}>
            Loading listings…
          </ThemedText>
        ) : error ? (
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
                  <Ionicons name={item.icon} size={30} color={theme.brand.primary} />
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
  filterPillActive: {
    backgroundColor: "#3D6B2F",
    borderColor: "#3D6B2F",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
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
  },
  categoryBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
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