// app/(tabs)/map.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, View, Text, StyleSheet, Pressable, ScrollView, TextInput, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
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
import { hasGoogleMapsApiKey } from "@/lib/maps";
import { shareFarm } from "@/lib/share-farm";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export default function MapTab() {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [recentFarmIds, setRecentFarmIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFarmPanelOpen, setIsFarmPanelOpen] = useState(true);

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

  const focusFarm = (farmId: string) => {
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
          setRecentFarmIds(parsed.filter((id) => typeof id === "string"));
        }
      } catch (error) {
        console.log("Could not load recent farms", error);
      }
    };

    loadRecentFarms();
  }, []);

  const persistRecentFarms = async (farmIds: string[]) => {
    try {
      await AsyncStorage.setItem("recentFarmIds", JSON.stringify(farmIds));
    } catch (error) {
      console.log("Could not save recent farms", error);
    }
  };

  const addRecentFarm = async (farmId: string) => {
    setRecentFarmIds((prev) => {
      const next = [farmId, ...prev.filter((id) => id !== farmId)].slice(0, 5);
      persistRecentFarms(next);
      return next;
    });
  };

  const handleFarmPress = async (farmId: string) => {
    await addRecentFarm(farmId);
    router.push(`/farm/${farmId}`);
  };

  const handleDirectionPress = async (farmId: string) => {
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

  const handleSharePress = async (farmId: string) => {
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;

    try {
      await shareFarm(farm);
    } catch (e) {
      console.log("Could not share farm", e);
    }
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

  // iOS uses Apple Maps by default, so a Google Maps key is only required for Android.
  if (Platform.OS === "android" && !hasGoogleMapsApiKey) {
    return (
      <View style={[styles.mapUnavailable, { backgroundColor: colors.background }]}>
        <Text style={[styles.mapUnavailableTitle, { color: colors.text.primary }]}>
          Map unavailable
        </Text>
        <Text style={[styles.mapUnavailableBody, { color: colors.text.secondary }]}>
          Add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `frontend/.env`, then rebuild the Android app.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView ref={mapRef} style={{ flex: 1 }} region={region} showsUserLocation onPress={() => Keyboard.dismiss()}>
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
        accessibilityLabel="Recenter map"
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
          onSubmitEditing={() => {
            Keyboard.dismiss();
            handleSearchSubmit();
          }}
          blurOnSubmit
          placeholder="Search farms or location…"
          placeholderTextColor={colors.input.placeholder}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text.primary }]}
        />
        {searchQuery.trim().length > 0 && (
          <Pressable
            onPress={() => {
              setSearchQuery("");
              Keyboard.dismiss();
            }}
            accessibilityLabel="Clear map search"
            hitSlop={8}
            style={styles.clearSearchButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {/* Native fixed panel: unlike the old bottom sheet, this remains visible
          in Expo Go and in the iOS Maps view. */}
      <View style={[styles.farmsPanel, !isFarmPanelOpen && styles.farmsPanelCollapsed, { backgroundColor: colors.background, borderColor: colors.border.light }]}> 
        {isFarmPanelOpen ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Farms Near You"
              onPress={() => setIsFarmPanelOpen(false)}
              style={styles.panelHandleTouchTarget}
            >
              <View style={styles.panelHandle} />
            </Pressable>
            {recentFarms.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentsScrollContent}>
                <Text style={[styles.recentsLabel, { color: colors.text.secondary }]}>Recents</Text>
                {recentFarms.map((farm) => (
                  <Pressable
                    key={farm.id}
                    style={[styles.recentItem, { backgroundColor: colors.surface, borderColor: colors.border.light }]}
                    onPress={() => focusFarm(farm.id)}
                  >
                    <Text style={[styles.recentTitle, { color: colors.text.primary }]} numberOfLines={1}>{farm.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleCopy}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}> 
                  {normalizedSearchQuery ? "Search Results" : "Farms Near You"}
                </Text>
                <Text style={[styles.panelLocation, { color: colors.text.tertiary }]} numberOfLines={1}>📍 {locationText}</Text>
              </View>
              <Button variant="primary" onPress={() => router.push("/farm")} style={styles.seeAllButton}>See All</Button>
            </View>

            {farmsLoading ? (
              <Text style={[styles.panelMessage, { color: colors.text.tertiary }]}>Loading farms…</Text>
            ) : farmsError ? (
              <Text style={[styles.panelMessage, { color: colors.text.tertiary }]}>Could not load farms.</Text>
            ) : filteredFarmsWithDistance.length === 0 ? (
              <Text style={[styles.panelMessage, { color: colors.text.tertiary }]}>No farms matched your search.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmsScrollContent}>
                {filteredFarmsWithDistance.map((farm) => (
                  <View key={farm.id} style={styles.farmCardWrapper}>
                    <FarmCard
                      id={farm.id}
                      name={farm.name}
                      rating={farm.rating}
                      reviews={farm.reviews}
                      distance={farm.distanceMi != null ? `${farm.distanceMi.toFixed(1)} mi` : "…"}
                      products={farm.products}
                      imageUrl={farm.imageUrl ?? undefined}
                      variant="home"
                      onPress={() => handleFarmPress(farm.id)}
                      onDirectionPress={() => handleDirectionPress(farm.id)}
                      onSharePress={() => handleSharePress(farm.id)}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Farms Near You"
            onPress={() => setIsFarmPanelOpen(true)}
            style={styles.collapsedPanelButton}
          >
            <View>
              <Text style={[styles.collapsedPanelTitle, { color: colors.text.primary }]}>Farms Near You</Text>
              <Text style={[styles.collapsedPanelSubtitle, { color: colors.text.tertiary }]}>{filteredFarmsWithDistance.length} nearby farms</Text>
            </View>
            <Ionicons name="chevron-up" size={22} color={colors.text.primary} />
          </Pressable>
        )}
      </View>
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

  farmsPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 30,
  },
  farmsPanelCollapsed: { paddingTop: 0, paddingBottom: 0 },
  panelHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: "#B8B8B8",
  },
  panelHandleTouchTarget: { alignSelf: "stretch", alignItems: "center", paddingVertical: 8, marginBottom: -4 },
  panelTitleCopy: { flex: 1, minWidth: 0 },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  panelLocation: { fontSize: 12, marginTop: -theme.spacing.xs },
  panelMessage: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  collapsedPanelButton: {
    minHeight: 62,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collapsedPanelTitle: { fontSize: 16, fontWeight: "700" },
  collapsedPanelSubtitle: { fontSize: 12, marginTop: 2 },

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
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: 0,
    gap: theme.spacing.sm,
  },

  recentsLabel: { fontSize: 12, fontWeight: "700" },

  recentItem: {
    maxWidth: 132,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },

  recentTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 0,
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

  farmsScrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 6,
    gap: theme.spacing.md,
  },

  // Matches the Home tab carousel width and card treatment.
  farmCardWrapper: {
    width: 190,
  },

  seeAllButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  mapUnavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  mapUnavailableTitle: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  mapUnavailableBody: {
    fontSize: theme.typography.fontSizes.h5,
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
    lineHeight: 22,
  },
});
