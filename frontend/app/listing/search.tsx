import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
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

export default function ListingSearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { coords: userCoords } = useCurrentLocation();
  const { data: farms = [], isLoading, error } = useFarms();
  const [activeFilter, setActiveFilter] = useState<ListingCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");

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
    () => filterListingRows(listings, activeFilter, searchQuery),
    [listings, activeFilter, searchQuery]
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: "fade_from_bottom",
        }}
      />

      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.input.background,
              borderColor: colors.border.light,
            },
          ]}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search produce, farm, or category"
            placeholderTextColor={colors.input.placeholder}
            autoFocus
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text.primary }]}
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
            No listings matched your search.
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
                <View style={[styles.cardThumb, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={30} color={theme.brand.primary} />
                  <View style={[styles.categoryBadge, { backgroundColor: item.badgeColor }]}>
                    <ThemedText style={[styles.categoryBadgeText, { color: item.badgeTextColor }]}>
                      {item.category === "Eggs & Dairy" ? "Eggs" : item.category}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.cardBody}>
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

                  <ThemedText style={[styles.itemUnit, { color: colors.text.secondary }]}>
                    {item.unit}
                  </ThemedText>

                  <ThemedText
                    style={[styles.itemNote, { color: colors.text.secondary }]}
                    numberOfLines={2}
                  >
                    {item.note}
                  </ThemedText>

                  <View style={styles.cardFooter}>
                    <View style={styles.farmTag}>
                      <View style={[styles.farmDot, { backgroundColor: item.farmDotColor }]} />
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
                      <ThemedText style={[styles.dirButtonText, { color: colors.text.primary }]}>
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
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  content: {
    paddingBottom: theme.spacing.lg,
  },
  searchBar: {
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
  },
  filterScroll: {
    marginTop: theme.spacing.xs,
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
  listingsStack: {
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  statusText: {
    fontSize: 14,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
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
