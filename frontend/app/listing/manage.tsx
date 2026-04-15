import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import MapView, { Marker } from "react-native-maps";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/auth-context";
import { fetchOwnedFarmByUserId, updateFarm } from "@/lib/farms";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import {
  CURRENCY_OPTIONS,
  fetchFarmListingsByFarmId,
  fetchProduceCatalog,
  SOLD_BY_OPTIONS,
  type MarketplaceListing,
  updateFarmListing,
} from "@/lib/marketplace";

type PickerField = "produceItem" | "variety" | "soldBy" | "currency" | null;
type AddressParts = {
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

const DEFAULT_REGION = {
  latitude: 34.0522,
  longitude: -118.2437,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function getStatusColor(isAvailable: boolean) {
  return isAvailable ? "#27500A" : "#7A1C1C";
}

function getStatusBackground(isAvailable: boolean) {
  return isAvailable ? "#DCEFBF" : "#F7D5D5";
}

function formatLocationSummary(address: AddressParts) {
  return [address.city, address.state, address.postal_code, address.country]
    .filter((value) => value?.trim())
    .join(", ");
}

export default function ManageListingsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { coords: userCoords, refresh: refreshLocation } = useCurrentLocation();

  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [isFarmModalVisible, setIsFarmModalVisible] = useState(false);
  const [selectedProduceItemId, setSelectedProduceItemId] = useState<string | null>(null);
  const [selectedVarietyId, setSelectedVarietyId] = useState<string | null>(null);
  const [selectedSoldBy, setSelectedSoldBy] =
    useState<(typeof SOLD_BY_OPTIONS)[number]>("lb");
  const [selectedCurrency, setSelectedCurrency] =
    useState<(typeof CURRENCY_OPTIONS)[number]>("USD");
  const [priceText, setPriceText] = useState("");
  const [available, setAvailable] = useState(true);
  const [activePicker, setActivePicker] = useState<PickerField>(null);
  const [saving, setSaving] = useState(false);
  const [farmSaving, setFarmSaving] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmWebsite, setFarmWebsite] = useState("");
  const [farmDescription, setFarmDescription] = useState("");
  const [pickedCoords, setPickedCoords] = useState(DEFAULT_REGION);
  const [addressParts, setAddressParts] = useState<AddressParts>({
    city: null,
    state: null,
    postal_code: null,
    country: null,
  });

  const { data: ownedFarm, isLoading: farmLoading } = useQuery({
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
  } = useQuery({
    queryKey: ["owned-marketplace-listings", ownedFarm?.id],
    enabled: !!ownedFarm?.id,
    queryFn: async () => fetchFarmListingsByFarmId(ownedFarm!.id),
  });

  const { data: produceCatalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["produce-catalog"],
    queryFn: fetchProduceCatalog,
  });

  const availableVarieties = useMemo(
    () =>
      (produceCatalog?.varieties ?? []).filter(
        (variety) => variety.produce_item_id === selectedProduceItemId
      ),
    [produceCatalog?.varieties, selectedProduceItemId]
  );

  const selectedProduceItem = useMemo(
    () =>
      (produceCatalog?.items ?? []).find((item) => item.id === selectedProduceItemId) ?? null,
    [produceCatalog?.items, selectedProduceItemId]
  );

  const selectedVariety = useMemo(
    () => availableVarieties.find((variety) => variety.id === selectedVarietyId) ?? null,
    [availableVarieties, selectedVarietyId]
  );

  useEffect(() => {
    if (!ownedFarm) return;

    setFarmName(ownedFarm.name);
    setFarmWebsite(ownedFarm.website ?? "");
    setFarmDescription(ownedFarm.description ?? "");
    setPickedCoords({
      latitude: ownedFarm.latitude,
      longitude: ownedFarm.longitude,
      latitudeDelta: DEFAULT_REGION.latitudeDelta,
      longitudeDelta: DEFAULT_REGION.longitudeDelta,
    });
    setAddressParts({
      city: ownedFarm.city ?? null,
      state: ownedFarm.state ?? null,
      postal_code: ownedFarm.postal_code ?? null,
      country: ownedFarm.country ?? null,
    });
  }, [ownedFarm]);

  useEffect(() => {
    if (!selectedListing) return;

    const currentVarietyStillValid = availableVarieties.some(
      (variety) => variety.id === selectedVarietyId
    );

    if (!currentVarietyStillValid && availableVarieties.length > 0) {
      setSelectedVarietyId(availableVarieties[0].id);
    }
  }, [availableVarieties, selectedListing, selectedVarietyId]);

  const openEditModal = (listing: MarketplaceListing) => {
    setSelectedListing(listing);
    setSelectedProduceItemId(listing.produceItemId);
    setSelectedVarietyId(listing.varietyId);
    setSelectedSoldBy(
      SOLD_BY_OPTIONS.includes(listing.soldBy as (typeof SOLD_BY_OPTIONS)[number])
        ? (listing.soldBy as (typeof SOLD_BY_OPTIONS)[number])
        : "lb"
    );
    setSelectedCurrency(
      CURRENCY_OPTIONS.includes(listing.currency as (typeof CURRENCY_OPTIONS)[number])
        ? (listing.currency as (typeof CURRENCY_OPTIONS)[number])
        : "USD"
    );
    setPriceText(String(listing.price));
    setAvailable(listing.available);
    setActivePicker(null);
  };

  const closeEditModal = () => {
    if (saving) return;
    setSelectedListing(null);
    setActivePicker(null);
  };

  const reverseGeocodeSelection = async (latitude: number, longitude: number) => {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const firstPlace = places?.[0];

      setAddressParts({
        city: firstPlace?.city ?? null,
        state: firstPlace?.region ?? null,
        postal_code: firstPlace?.postalCode ?? null,
        country: firstPlace?.country ?? null,
      });
    } catch (error) {
      console.log("Could not reverse geocode farm location", error);
      setAddressParts({
        city: null,
        state: null,
        postal_code: null,
        country: null,
      });
    }
  };

  const handleMapPress = async (latitude: number, longitude: number) => {
    setPickedCoords({
      latitude,
      longitude,
      latitudeDelta: DEFAULT_REGION.latitudeDelta,
      longitudeDelta: DEFAULT_REGION.longitudeDelta,
    });
    await reverseGeocodeSelection(latitude, longitude);
  };

  const handleUseCurrentLocation = async () => {
    await refreshLocation();

    const position = userCoords
      ? { coords: userCoords }
      : await Location.getCurrentPositionAsync({});

    await handleMapPress(position.coords.latitude, position.coords.longitude);
  };

  const handleSaveFarm = async () => {
    if (!ownedFarm) return;
    if (!farmName.trim()) {
      Alert.alert("Farm name required", "Enter a farm name before saving.");
      return;
    }

    setFarmSaving(true);

    try {
      await updateFarm({
        id: ownedFarm.id,
        name: farmName.trim(),
        latitude: pickedCoords.latitude,
        longitude: pickedCoords.longitude,
        city: addressParts.city,
        state: addressParts.state,
        postal_code: addressParts.postal_code,
        country: addressParts.country,
        website: farmWebsite,
        description: farmDescription,
      });

      await queryClient.invalidateQueries({ queryKey: ["owned-farm", session?.user.id] });
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["owned-marketplace-listings", ownedFarm.id] });
      setIsFarmModalVisible(false);
      Alert.alert("Farm updated", "Your farm details have been saved.");
    } catch (error) {
      console.log("Could not update farm", error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not update your farm right now.";
      Alert.alert("Update failed", message);
    } finally {
      setFarmSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedListing) return;
    if (!selectedVarietyId) {
      Alert.alert("Variety required", "Choose a produce variety for this listing.");
      return;
    }

    const parsedPrice = Number(priceText);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Valid price required", "Enter a price greater than zero.");
      return;
    }

    setSaving(true);

    try {
      await updateFarmListing({
        id: selectedListing.id,
        produce_variety_id: selectedVarietyId,
        price: parsedPrice,
        currency: selectedCurrency,
        sold_by: selectedSoldBy,
        available,
      });

      await queryClient.invalidateQueries({ queryKey: ["owned-marketplace-listings", ownedFarm?.id] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });

      closeEditModal();
      Alert.alert("Listing updated", "Your changes have been saved.");
    } catch (error) {
      console.log("Could not update listing", error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not update the listing right now.";
      Alert.alert("Update failed", message);
    } finally {
      setSaving(false);
    }
  };

  const pickerOptions = useMemo(() => {
    if (activePicker === "produceItem") {
      return (produceCatalog?.items ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.category?.trim() || "Produce item",
        onPress: () => {
          setSelectedProduceItemId(item.id);
          setActivePicker(null);
        },
      }));
    }

    if (activePicker === "variety") {
      return availableVarieties.map((variety) => ({
        id: variety.id,
        title: variety.name,
        subtitle: variety.description?.trim() || "Produce variety",
        onPress: () => {
          setSelectedVarietyId(variety.id);
          setActivePicker(null);
        },
      }));
    }

    if (activePicker === "soldBy") {
      return SOLD_BY_OPTIONS.map((option) => ({
        id: option,
        title: option,
        subtitle: "Listing unit",
        onPress: () => {
          setSelectedSoldBy(option);
          setActivePicker(null);
        },
      }));
    }

    if (activePicker === "currency") {
      return CURRENCY_OPTIONS.map((option) => ({
        id: option,
        title: option,
        subtitle: "Currency",
        onPress: () => {
          setSelectedCurrency(option);
          setActivePicker(null);
        },
      }));
    }

    return [];
  }, [activePicker, availableVarieties, produceCatalog?.items]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border.light }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>

          <ThemedText style={styles.heroEyebrow}>Seller tools</ThemedText>
          <ThemedText style={styles.heroTitle}>Manage your listings</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Review your produce, adjust pricing, change varieties, and toggle availability.
          </ThemedText>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border.light }]}>
          {!session?.user.id ? (
            <ThemedText style={{ color: colors.text.secondary }}>Sign in to manage your listings.</ThemedText>
          ) : farmLoading || listingsLoading || catalogLoading ? (
            <ThemedText style={{ color: colors.text.secondary }}>Loading your listings…</ThemedText>
          ) : !ownedFarm ? (
            <>
              <ThemedText style={[styles.emptyTitle, { color: colors.text.primary }]}>
                No farm yet
              </ThemedText>
              <ThemedText style={[styles.emptyBody, { color: colors.text.secondary }]}>
                Create your farm first before you can manage produce listings.
              </ThemedText>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/listing/new")}
                activeOpacity={0.88}
              >
                <ThemedText style={styles.primaryButtonText}>Create your first listing</ThemedText>
              </TouchableOpacity>
            </>
          ) : listingsError ? (
            <ThemedText style={{ color: colors.text.secondary }}>Could not load your listings.</ThemedText>
          ) : ownedListings.length === 0 ? (
            <>
              <ThemedText style={[styles.emptyTitle, { color: colors.text.primary }]}>
                No listings yet
              </ThemedText>
              <ThemedText style={[styles.emptyBody, { color: colors.text.secondary }]}>
                Your farm is set up. Add a produce listing to start selling.
              </ThemedText>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/listing/new")}
                activeOpacity={0.88}
              >
                <ThemedText style={styles.primaryButtonText}>Add a listing</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  {ownedFarm.name}
                </ThemedText>
                <View style={styles.headerActions}>
                  <TouchableOpacity onPress={() => setIsFarmModalVisible(true)} activeOpacity={0.85}>
                    <ThemedText style={[styles.linkText, { color: theme.brand.primary }]}>
                      Edit farm
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push("/listing/new")} activeOpacity={0.85}>
                    <ThemedText style={[styles.linkText, { color: theme.brand.primary }]}>
                      Add another
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.listingStack}>
                {ownedListings.map((listing) => (
                  <View
                    key={listing.id}
                    style={[styles.listingCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}
                  >
                    <View style={styles.listingTopRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.listingTitle, { color: colors.text.primary }]}>
                          {listing.produceItemName}
                        </ThemedText>
                        <ThemedText style={[styles.listingSubtitle, { color: colors.text.secondary }]}>
                          {listing.varietyName}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: getStatusBackground(listing.available) },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.statusPillText,
                            { color: getStatusColor(listing.available) },
                          ]}
                        >
                          {listing.available ? "Available" : "Unavailable"}
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText style={[styles.listingMeta, { color: colors.text.secondary }]}>
                      {listing.currency} {listing.price.toFixed(2)} / {listing.soldBy}
                    </ThemedText>

                    <TouchableOpacity
                      style={[styles.editButton, { borderColor: colors.border.light, backgroundColor: colors.card }]}
                      onPress={() => openEditModal(listing)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.text.primary} />
                      <ThemedText style={[styles.editButtonText, { color: colors.text.primary }]}>
                        Edit listing
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!selectedListing} onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text.primary }]}>
                Edit listing
              </ThemedText>
              <TouchableOpacity onPress={closeEditModal} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <SelectorField
                label="Produce item"
                value={selectedProduceItem?.name ?? "Choose a produce item"}
                onPress={() => setActivePicker("produceItem")}
                colors={colors}
              />

              <SelectorField
                label="Variety"
                value={selectedVariety?.name ?? "Choose a variety"}
                onPress={() => setActivePicker("variety")}
                disabled={!availableVarieties.length}
                colors={colors}
              />

              <FieldLabel label="Price" colors={colors} />
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                placeholder="6.50"
                placeholderTextColor={colors.input.placeholder}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  { backgroundColor: colors.input.background, borderColor: colors.border.light, color: colors.input.text },
                ]}
              />

              <SelectorField
                label="Currency"
                value={selectedCurrency}
                onPress={() => setActivePicker("currency")}
                colors={colors}
              />

              <SelectorField
                label="Sold by"
                value={selectedSoldBy}
                onPress={() => setActivePicker("soldBy")}
                colors={colors}
              />

              <View style={[styles.availabilityRow, { borderColor: colors.border.light }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                    Available now
                  </ThemedText>
                  <ThemedText style={[styles.helperText, { color: colors.text.secondary }]}>
                    Hide the listing from shoppers without deleting it.
                  </ThemedText>
                </View>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{ false: colors.border.default, true: theme.brand.primary }}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.88}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {saving ? "Saving…" : "Save changes"}
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={isFarmModalVisible} onRequestClose={() => setIsFarmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text.primary }]}>
                Edit farm
              </ThemedText>
              <TouchableOpacity onPress={() => !farmSaving && setIsFarmModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.fieldGroup}>
                <FieldLabel label="Farm name" colors={colors} />
                <TextInput
                  value={farmName}
                  onChangeText={setFarmName}
                  placeholder="Farm name"
                  placeholderTextColor={colors.input.placeholder}
                  style={[
                    styles.input,
                    { backgroundColor: colors.input.background, borderColor: colors.border.light, color: colors.input.text },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Farm location" colors={colors} />
                <ThemedText style={[styles.helperText, { color: colors.text.secondary }]}>
                  Tap the map to move your farm. City, state, postal code, and country update automatically.
                </ThemedText>
                <MapView
                  style={styles.map}
                  region={{
                    latitude: pickedCoords.latitude,
                    longitude: pickedCoords.longitude,
                    latitudeDelta: pickedCoords.latitudeDelta,
                    longitudeDelta: pickedCoords.longitudeDelta,
                  }}
                  onPress={(event) => {
                    const coordinate = event.nativeEvent.coordinate;
                    void handleMapPress(coordinate.latitude, coordinate.longitude);
                  }}
                >
                  <Marker coordinate={{ latitude: pickedCoords.latitude, longitude: pickedCoords.longitude }} />
                </MapView>

                <TouchableOpacity
                  style={[styles.utilityButton, { borderColor: colors.border.light, backgroundColor: colors.card }]}
                  onPress={handleUseCurrentLocation}
                  activeOpacity={0.85}
                >
                  <Ionicons name="locate-outline" size={16} color={colors.text.primary} />
                  <ThemedText style={[styles.utilityButtonText, { color: colors.text.primary }]}>
                    Use my location
                  </ThemedText>
                </TouchableOpacity>

                <View style={[styles.locationSummaryCard, { backgroundColor: colors.card }]}>
                  <ThemedText style={[styles.locationSummaryText, { color: colors.text.primary }]}>
                    {formatLocationSummary(addressParts) || "Tap the map to update your farm location."}
                  </ThemedText>
                  <ThemedText style={[styles.coordinateText, { color: colors.text.secondary }]}>
                    {pickedCoords.latitude.toFixed(5)}, {pickedCoords.longitude.toFixed(5)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Website" colors={colors} />
                <TextInput
                  value={farmWebsite}
                  onChangeText={setFarmWebsite}
                  placeholder="https://yourfarm.com"
                  placeholderTextColor={colors.input.placeholder}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={[
                    styles.input,
                    { backgroundColor: colors.input.background, borderColor: colors.border.light, color: colors.input.text },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <FieldLabel label="Description" colors={colors} />
                <TextInput
                  value={farmDescription}
                  onChangeText={setFarmDescription}
                  placeholder="Describe your farm"
                  placeholderTextColor={colors.input.placeholder}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.input,
                    styles.multilineInput,
                    { backgroundColor: colors.input.background, borderColor: colors.border.light, color: colors.input.text },
                  ]}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, farmSaving && styles.buttonDisabled]}
                onPress={handleSaveFarm}
                disabled={farmSaving}
                activeOpacity={0.88}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {farmSaving ? "Saving…" : "Save farm changes"}
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={activePicker !== null} onRequestClose={() => setActivePicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text.primary }]}>
                Choose an option
              </ThemedText>
              <TouchableOpacity onPress={() => setActivePicker(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {pickerOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.optionRow, { borderColor: colors.border.light }]}
                  onPress={option.onPress}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.optionTitle, { color: colors.text.primary }]}>
                      {option.title}
                    </ThemedText>
                    <ThemedText style={[styles.optionSubtitle, { color: colors.text.secondary }]}>
                      {option.subtitle}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FieldLabel({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>{label}</ThemedText>;
}

function SelectorField({
  label,
  value,
  onPress,
  disabled,
  colors,
}: {
  label: string;
  value: string;
  onPress: () => void;
  disabled?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <View style={styles.fieldGroup}>
      <FieldLabel label={label} colors={colors} />
      <TouchableOpacity
        style={[
          styles.selectorField,
          {
            backgroundColor: colors.input.background,
            borderColor: colors.border.light,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
      >
        <ThemedText style={{ color: colors.text.primary }}>{value}</ThemedText>
        <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: theme.spacing.xl },
  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6E7B37",
    fontWeight: "600",
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: "#2E2A1F",
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5A564B",
  },
  sectionCard: {
    marginHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderRadius: 22,
    padding: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  listingStack: {
    gap: 12,
  },
  listingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: theme.spacing.md,
    gap: 10,
  },
  listingTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  listingTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  listingSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  listingMeta: {
    fontSize: 13,
  },
  statusPill: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  editButton: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  pickerCard: {
    maxHeight: "70%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  fieldGroup: {
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
  },
  selectorField: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: theme.spacing.md,
  },
  multilineInput: {
    minHeight: 110,
  },
  map: {
    height: 220,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: theme.spacing.sm,
  },
  utilityButton: {
    alignSelf: "flex-start",
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  utilityButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  locationSummaryCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    marginBottom: theme.spacing.md,
  },
  locationSummaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  coordinateText: {
    fontSize: 12,
  },
  availabilityRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  primaryButton: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "#3D6B2F",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  optionRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
