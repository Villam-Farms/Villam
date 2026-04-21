// app/(tabs)/map.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from "react-native";
import MapView, { Marker } from "react-native-maps";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import FarmCard from "@/components/ui/farmcard";
import { Button } from "@/components/ui/button";

import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { addDistanceAndSort } from "@/lib/location";
import { useFarms } from "@/hooks/useFarms";

import { openDirections } from "@/lib/directions";
import { formatAddress } from "@/lib/address";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export default function MapTab() {
  const { colors } = useTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [recentFarmIds, setRecentFarmIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { coords: userCoords, locationText } = useCurrentLocation();
  const { data: farms = [], isLoading: farmsLoading, error: farmsError } = useFarms();

  const farmsWithDistance = useMemo(
    () => addDistanceAndSort(farms, userCoords),
    [farms, userCoords]
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredFarms = useMemo(() => {
    if (!normalizedSearchQuery) return farms;

    return farms.filter((farm) =>
      [
        farm.name,
        farm.products,
        farm.description,
        farm.city,
        farm.state,
        farm.postal_code,
        farm.country,
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .some((value) => value.toLowerCase().includes(normalizedSearchQuery))
    );
  }, [farms, normalizedSearchQuery]);

  const filteredFarmIds = useMemo(
    () => new Set(filteredFarms.map((farm) => farm.id)),
    [filteredFarms]
  );

  const filteredFarmsWithDistance = useMemo(
    () => farmsWithDistance.filter((farm) => filteredFarmIds.has(farm.id)),
    [farmsWithDistance, filteredFarmIds]
  );

  const fallbackCenter = useMemo(() => {
    if (userCoords) return userCoords;
    if (farms.length > 0) return { latitude: farms[0].latitude, longitude: farms[0].longitude };
    return { latitude: 34.0522, longitude: -118.2437 };
  }, [userCoords, farms]);

  useEffect(() => {
    if (selectedFarmId != null) return;

    setRegion({
      latitude: fallbackCenter.latitude,
      longitude: fallbackCenter.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
  }, [fallbackCenter, selectedFarmId]);

  const focusFarm = (farmId: number) => {
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;

    addRecentFarm(farmId);
    setSelectedFarmId(farmId);

    const next: Region = {
      latitude: farm.latitude,
      longitude: farm.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    setRegion(next);
    mapRef.current?.animateToRegion(next, 600);
    sheetRef.current?.snapToIndex(1);
  };

  const recenterOnUser = () => {
    if (!userCoords) return;

    const next: Region = {
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };

    setSelectedFarmId(null);
    setRegion(next);
    mapRef.current?.animateToRegion(next, 600);
  };

  useEffect(() => {
    const loadRecentFarms = async () => {
      try {
        const raw = await AsyncStorage.getItem("recentFarmIds");
        if (!raw) return;

        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setRecentFarmIds(parsed.filter((id) => typeof id === "number"));
        }
      } catch (error) {
        console.log("Could not load recent farms", error);
      }
    };

    loadRecentFarms();
  }, []);

  const persistRecentFarms = async (farmIds: number[]) => {
    try {
      await AsyncStorage.setItem("recentFarmIds", JSON.stringify(farmIds));
    } catch (error) {
      console.log("Could not save recent farms", error);
    }
  };

  const addRecentFarm = async (farmId: number) => {
    setRecentFarmIds((prev) => {
      const next = [farmId, ...prev.filter((id) => id !== farmId)].slice(0, 5);
      persistRecentFarms(next);
      return next;
    });
  };

  const handleFarmPress = async (farmId: number) => {
    await addRecentFarm(farmId);
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

  const handleSharePress = (farmId: number) => {
    console.log("Share pressed:", farmId);
  };

  const handleSearchSubmit = () => {
    if (filteredFarms.length === 0) return;

    focusFarm(filteredFarms[0].id);
  };

  const recentFarms = useMemo(
    () =>
      recentFarmIds
        .map((id) => filteredFarms.find((farm) => farm.id === id))
        .filter((farm): farm is typeof farms[number] => !!farm),
    [recentFarmIds, filteredFarms]
  );

  if (!region) return <Text>Loading map…</Text>;

  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView ref={mapRef} style={{ flex: 1 }} region={region} showsUserLocation>
        {filteredFarms.map((farm) => (
          <Marker
            key={farm.id}
            coordinate={{ latitude: farm.latitude, longitude: farm.longitude }}
            title={farm.name}
            description={
              formatAddress(farm).trim().length > 0 ? formatAddress(farm) : (farm.products ?? "")
            }
            pinColor={farm.id === selectedFarmId ? theme.brand.primary : undefined}
            onPress={() => focusFarm(farm.id)}
          />
        ))}
      </MapView>

      {/* RECENTER BUTTON */}
      <Pressable
        style={[
          styles.recenterBtn,
          { backgroundColor: colors.card, borderColor: colors.border.light },
        ]}
        onPress={recenterOnUser}
      >
        <Ionicons name="locate" size={22} color={colors.text.primary} />
      </Pressable>

      {/* FLOATING SEARCH BAR */}
      <View
        style={[
          styles.floatingSearch,
          {
            backgroundColor: colors.input.background,
            borderColor: colors.border.light,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={22}
          color={colors.text.tertiary}
          style={styles.searchIcon}
        />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={() => sheetRef.current?.snapToIndex(1)}
          onSubmitEditing={handleSearchSubmit}
          placeholder="Search farms or location…"
          placeholderTextColor={colors.input.placeholder}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text.primary }]}
        />
        {searchQuery.trim().length > 0 && (
          <Pressable
            onPress={() => setSearchQuery("")}
            hitSlop={8}
            style={styles.clearSearchButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {/* BOTTOM SHEET */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={["5%", "60%", "85%"]}
        index={0}
        backgroundStyle={{ backgroundColor: colors.background }}
        handleIndicatorStyle={{ backgroundColor: colors.border.light }}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {recentFarms.length > 0 && (
            <>
              {/* RECENTS */}
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recents</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.recentsScroll}
                contentContainerStyle={styles.recentsScrollContent}
              >
                {recentFarms.map((farm) => (
                  <Pressable
                    key={farm.id}
                    style={[
                      styles.recentItem,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border.light,
                      },
                    ]}
                    onPress={() => focusFarm(farm.id)}
                  >
                    <Text style={[styles.recentTitle, { color: colors.text.primary }]} numberOfLines={1}>
                      {farm.name}
                    </Text>
                    <Text style={[styles.recentSubtitle, { color: colors.text.tertiary }]} numberOfLines={1}>
                      {farm.products}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {/* FARMS NEAR YOU */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {normalizedSearchQuery ? "Search Results" : "Farms Near You"}
            </Text>
            <Button
              variant="primary"
              onPress={() => console.log("See All")}
              style={styles.seeAllButton}
            >
              See All
            </Button>
          </View>

          <Text style={{ color: colors.text.tertiary, marginTop: 2, marginBottom: 8 }}>
            📍 {locationText}
          </Text>

          {farmsLoading ? (
            <Text style={{ color: colors.text.tertiary }}>Loading farms…</Text>
          ) : farmsError ? (
            <Text style={{ color: colors.text.tertiary }}>Could not load farms.</Text>
          ) : filteredFarmsWithDistance.length === 0 ? (
            <Text style={{ color: colors.text.tertiary }}>
              No farms matched your search.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.farmsScroll}
              contentContainerStyle={styles.farmsScrollContent}
            >
              {filteredFarmsWithDistance.map((farm) => (
                <View key={farm.id} style={styles.farmCardWrapper}>
                  <FarmCard
                    name={farm.name}
                    rating={farm.rating}
                    reviews={farm.reviews}
                    distance={farm.distanceMi != null ? `${farm.distanceMi.toFixed(1)} mi` : "…"}
                    products={farm.products}
                    onPress={() => handleFarmPress(farm.id)}
                    onDirectionPress={() => handleDirectionPress(farm.id)}
                    onSharePress={() => handleSharePress(farm.id)}
                  />
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingSearch: {
    position: "absolute",
    top: 60,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    zIndex: 20,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
  clearSearchButton: {
    marginLeft: theme.spacing.xs,
  },
  recenterBtn: {
    position: "absolute",
    right: theme.spacing.md,
    top: 130,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 21,
  },

  // BottomSheetScrollView padding belongs on contentContainerStyle
  sheetContentContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },

  sectionTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  recentsScroll: {
    marginTop: theme.spacing.sm,
  },

  recentsScrollContent: {
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.sm,
  },

  recentItem: {
    minWidth: 160,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
    marginRight: theme.spacing.sm,
  },

  recentTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: theme.spacing.xs,
  },

  recentSubtitle: {
    fontSize: 12,
  },

  recentsBox: {
    height: 80,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.md,
  },

  recentsEmpty: {
    fontSize: 13,
    textAlign: "center",
  },

  // Edge-to-edge scroller: pull to edges; padding on content container
  farmsScroll: {
    marginTop: theme.spacing.sm,
    marginHorizontal: -theme.spacing.md,
  },
  farmsScrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingRight: theme.spacing.md,
    paddingVertical: 6, // ✅ prevents shadow clipping / “first card looks different”
    gap: theme.spacing.md,
  },

  // Parent controls width; FarmCard no longer needs width: 300
  farmCardWrapper: {
    width: 300,
  },

  seeAllButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
});
