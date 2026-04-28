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
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useAuth } from "@/context/auth-context";
import { createFarm, fetchOwnedFarmByUserId } from "@/lib/farms";
import {
  createFarmListing,
  CURRENCY_OPTIONS,
  fetchProduceCatalog,
  SOLD_BY_OPTIONS,
  uploadFarmListingImage,
} from "@/lib/marketplace";

type PickerField = "produceItem" | "variety" | "soldBy" | "currency" | null;

type AddressParts = {
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

type PickedListingImage = {
  uri: string;
  name: string;
  type: string;
};

const DEFAULT_REGION = {
  latitude: 34.0522,
  longitude: -118.2437,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function formatLocationSummary(address: AddressParts) {
  return [address.city, address.state, address.postal_code, address.country]
    .filter((value) => value?.trim())
    .join(", ");
}

export default function NewListingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const { coords: userCoords, refresh: refreshLocation } = useCurrentLocation();

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

  const [selectedProduceItemId, setSelectedProduceItemId] = useState<string | null>(null);
  const [selectedVarietyId, setSelectedVarietyId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState("");
  const [selectedSoldBy, setSelectedSoldBy] =
    useState<(typeof SOLD_BY_OPTIONS)[number]>("lb");
  const [selectedCurrency, setSelectedCurrency] =
    useState<(typeof CURRENCY_OPTIONS)[number]>("USD");
  const [available, setAvailable] = useState(true);
  const [activePicker, setActivePicker] = useState<PickerField>(null);
  const [submittingFarm, setSubmittingFarm] = useState(false);
  const [submittingListing, setSubmittingListing] = useState(false);
  const [listingImage, setListingImage] = useState<PickedListingImage | null>(null);

  const { data: produceCatalog, isLoading: catalogLoading, error: catalogError } = useQuery({
    queryKey: ["produce-catalog"],
    queryFn: fetchProduceCatalog,
  });

  const { data: ownedFarm, isLoading: ownedFarmLoading } = useQuery({
    queryKey: ["owned-farm", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      if (!session?.user.id) return null;
      return fetchOwnedFarmByUserId(session.user.id);
    },
  });

  useEffect(() => {
    if (!userCoords) return;

    setPickedCoords((current) => {
      if (current.latitude !== DEFAULT_REGION.latitude || current.longitude !== DEFAULT_REGION.longitude) {
        return current;
      }

      return {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      };
    });
  }, [userCoords]);

  useEffect(() => {
    if (selectedProduceItemId) return;

    const firstItem = produceCatalog?.items[0];
    if (!firstItem) return;

    setSelectedProduceItemId(firstItem.id);
  }, [produceCatalog?.items, selectedProduceItemId]);

  const availableVarieties = useMemo(
    () =>
      (produceCatalog?.varieties ?? []).filter(
        (variety) => variety.produce_item_id === selectedProduceItemId
      ),
    [produceCatalog?.varieties, selectedProduceItemId]
  );

  useEffect(() => {
    if (!availableVarieties.length) {
      setSelectedVarietyId(null);
      return;
    }

    const stillValid = availableVarieties.some((variety) => variety.id === selectedVarietyId);
    if (!stillValid) {
      setSelectedVarietyId(availableVarieties[0].id);
    }
  }, [availableVarieties, selectedVarietyId]);

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
    if (!selectedProduceItem?.default_sold_by) return;
    if (!SOLD_BY_OPTIONS.includes(selectedProduceItem.default_sold_by as (typeof SOLD_BY_OPTIONS)[number])) {
      return;
    }

    setSelectedSoldBy(selectedProduceItem.default_sold_by as (typeof SOLD_BY_OPTIONS)[number]);
  }, [selectedProduceItem?.default_sold_by]);

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

    const position = await Location.getCurrentPositionAsync({});
    await handleMapPress(position.coords.latitude, position.coords.longitude);
  };

  const handleCreateFarm = async () => {
    if (!session?.user.id) {
      Alert.alert("Sign in required", "Please sign in again before creating a farm.");
      return;
    }

    if (!farmName.trim()) {
      Alert.alert("Farm name required", "Enter a farm name before continuing.");
      return;
    }

    setSubmittingFarm(true);

    try {
      await createFarm({
        user_id: session.user.id,
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

      await queryClient.invalidateQueries({ queryKey: ["owned-farm", session.user.id] });
      await queryClient.invalidateQueries({ queryKey: ["farms"] });
      Alert.alert("Farm created", "Your farm is ready. You can list produce now.");
    } catch (error) {
      console.log("Could not create farm", error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not create your farm right now.";
      Alert.alert("Create failed", message);
    } finally {
      setSubmittingFarm(false);
    }
  };

  const handleCreateListing = async () => {
    if (!ownedFarm) {
      Alert.alert("Create your farm first", "Finish your farm setup before listing produce.");
      return;
    }

    if (!selectedVarietyId) {
      Alert.alert("Variety required", "Choose a produce variety for this listing.");
      return;
    }

    const parsedPrice = Number(priceText);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Valid price required", "Enter a price greater than zero.");
      return;
    }

    setSubmittingListing(true);

    try {
      const createdListing = await createFarmListing({
        farm_id: ownedFarm.id,
        produce_variety_id: selectedVarietyId,
        price: parsedPrice,
        currency: selectedCurrency,
        sold_by: selectedSoldBy,
        available,
      });

      if (accessToken && listingImage) {
        await uploadFarmListingImage(accessToken, createdListing.id, listingImage);
      }

      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["owned-marketplace-listings", ownedFarm.id] });
      Alert.alert("Listing created", "Your produce listing is now live.", [
        {
          text: "Done",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.log("Could not create listing", error);
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Could not save the produce listing right now.";
      Alert.alert("Create failed", message);
    } finally {
      setSubmittingListing(false);
    }
  };

  const handlePickListingImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to upload listing photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    if (asset.fileSize != null && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert("Too large", "Please choose an image under 10MB.");
      return;
    }

    setListingImage({
      uri: asset.uri,
      name: "listing.jpg",
      type: asset.mimeType ?? "image/jpeg",
    });
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

  const mapRegion = {
    latitude: pickedCoords.latitude,
    longitude: pickedCoords.longitude,
    latitudeDelta: pickedCoords.latitudeDelta,
    longitudeDelta: pickedCoords.longitudeDelta,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.hero,
            {
              backgroundColor: "#F7E5BF",
              paddingTop: theme.spacing.lg + insets.top - 12,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: "rgba(255,255,255,0.92)" }]}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>

          <ThemedText style={styles.heroEyebrow}>Farm listings</ThemedText>
          <ThemedText style={styles.heroTitle}>List your produce</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Create your farm once, then publish produce listings with variety, price, and unit.
          </ThemedText>
        </View>

        {!ownedFarm && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border.light }]}>
            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Step 1: Create your farm
              </ThemedText>
              <ThemedText style={[styles.sectionCopy, { color: colors.text.secondary }]}>
                Your first listing needs a farm profile with a pinned location.
              </ThemedText>
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                Farm name
              </ThemedText>
              <TextInput
                value={farmName}
                onChangeText={setFarmName}
                placeholder="Oak Hollow Farm"
                placeholderTextColor={colors.input.placeholder}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input.background,
                    borderColor: colors.border.light,
                    color: colors.input.text,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                Farm location
              </ThemedText>
              <ThemedText style={[styles.helperText, { color: colors.text.secondary }]}>
                Tap the map to place your farm. City, state, postal code, and country fill automatically.
              </ThemedText>

              <MapView style={styles.map} region={mapRegion} onPress={(event) => {
                const coordinate = event.nativeEvent.coordinate;
                void handleMapPress(coordinate.latitude, coordinate.longitude);
              }}>
                <Marker coordinate={{ latitude: pickedCoords.latitude, longitude: pickedCoords.longitude }} />
              </MapView>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border.light, backgroundColor: colors.card }]}
                onPress={handleUseCurrentLocation}
                activeOpacity={0.85}
              >
                <Ionicons name="locate-outline" size={16} color={colors.text.primary} />
                <ThemedText style={[styles.secondaryButtonText, { color: colors.text.primary }]}>
                  Use my location
                </ThemedText>
              </TouchableOpacity>

              <View style={[styles.locationSummaryCard, { backgroundColor: colors.card }]}>
                <ThemedText style={[styles.locationSummaryText, { color: colors.text.primary }]}>
                  {formatLocationSummary(addressParts) || "Tap the map to confirm your farm location."}
                </ThemedText>
                <ThemedText style={[styles.coordinateText, { color: colors.text.secondary }]}>
                  {pickedCoords.latitude.toFixed(5)}, {pickedCoords.longitude.toFixed(5)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                Website
              </ThemedText>
              <TextInput
                value={farmWebsite}
                onChangeText={setFarmWebsite}
                placeholder="https://yourfarm.com"
                placeholderTextColor={colors.input.placeholder}
                autoCapitalize="none"
                keyboardType="url"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input.background,
                    borderColor: colors.border.light,
                    color: colors.input.text,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                Description
              </ThemedText>
              <TextInput
                value={farmDescription}
                onChangeText={setFarmDescription}
                placeholder="Optional farm description"
                placeholderTextColor={colors.input.placeholder}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.multilineInput,
                  {
                    backgroundColor: colors.input.background,
                    borderColor: colors.border.light,
                    color: colors.input.text,
                  },
                ]}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, submittingFarm && styles.buttonDisabled]}
              onPress={handleCreateFarm}
              disabled={submittingFarm}
              activeOpacity={0.88}
            >
              <ThemedText style={styles.primaryButtonText}>
                {submittingFarm ? "Creating farm…" : "Create farm"}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border.light }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {ownedFarm ? "Create a produce listing" : "Step 2: Create your produce listing"}
            </ThemedText>
            <ThemedText style={[styles.sectionCopy, { color: colors.text.secondary }]}>
              {ownedFarm
                ? `Listing from ${ownedFarm.name}`
                : "This unlocks after your farm is created."}
            </ThemedText>
          </View>

          {ownedFarmLoading || catalogLoading ? (
            <ThemedText style={{ color: colors.text.secondary }}>Loading listing form…</ThemedText>
          ) : catalogError ? (
            <ThemedText style={{ color: colors.text.secondary }}>
              Could not load produce options.
            </ThemedText>
          ) : (
            <>
              <SelectorField
                label="Produce item"
                value={selectedProduceItem?.name ?? "Choose a produce item"}
                onPress={() => setActivePicker("produceItem")}
                disabled={!produceCatalog?.items.length || !ownedFarm}
                colors={colors}
              />

              <SelectorField
                label="Variety"
                value={selectedVariety?.name ?? "Choose a variety"}
                onPress={() => setActivePicker("variety")}
                disabled={!availableVarieties.length || !ownedFarm}
                colors={colors}
              />

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                  Price
                </ThemedText>
                <TextInput
                  value={priceText}
                  onChangeText={setPriceText}
                  placeholder="6.50"
                  placeholderTextColor={colors.input.placeholder}
                  keyboardType="decimal-pad"
                  editable={!!ownedFarm}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.input.background,
                      borderColor: colors.border.light,
                      color: colors.input.text,
                      opacity: ownedFarm ? 1 : 0.6,
                    },
                  ]}
                />
              </View>

              <SelectorField
                label="Currency"
                value={selectedCurrency}
                onPress={() => setActivePicker("currency")}
                disabled={!ownedFarm}
                colors={colors}
              />

              <SelectorField
                label="Sold by"
                value={selectedSoldBy}
                onPress={() => setActivePicker("soldBy")}
                disabled={!ownedFarm}
                colors={colors}
              />

              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                  Listing photo
                </ThemedText>
                <ThemedText style={[styles.helperText, { color: colors.text.secondary }]}>
                  Optional. If you skip this, the current placeholder artwork stays in place.
                </ThemedText>

                {listingImage ? (
                  <View style={[styles.imagePreviewCard, { borderColor: colors.border.light }]}>
                    <Image source={{ uri: listingImage.uri }} style={styles.imagePreview} contentFit="cover" />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.imagePlaceholderCard,
                      {
                        backgroundColor: colors.input.background,
                        borderColor: colors.border.light,
                      },
                    ]}
                  >
                    <Ionicons name="image-outline" size={24} color={colors.text.tertiary} />
                    <ThemedText style={{ color: colors.text.secondary }}>
                      No listing image selected
                    </ThemedText>
                  </View>
                )}

                <View style={styles.imageActionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.border.light, backgroundColor: colors.card }]}
                    onPress={handlePickListingImage}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="images-outline" size={16} color={colors.text.primary} />
                    <ThemedText style={[styles.secondaryButtonText, { color: colors.text.primary }]}>
                      {listingImage ? "Change photo" : "Add photo"}
                    </ThemedText>
                  </TouchableOpacity>

                  {listingImage ? (
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.border.light, backgroundColor: colors.card }]}
                      onPress={() => setListingImage(null)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.text.primary} />
                      <ThemedText style={[styles.secondaryButtonText, { color: colors.text.primary }]}>
                        Remove
                      </ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={[styles.availabilityRow, { borderColor: colors.border.light }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>
                    Available now
                  </ThemedText>
                  <ThemedText style={[styles.helperText, { color: colors.text.secondary }]}>
                    Turn this off to save the listing as unavailable.
                  </ThemedText>
                </View>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  disabled={!ownedFarm}
                  trackColor={{ false: colors.border.default, true: theme.brand.primary }}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (!ownedFarm || submittingListing) && styles.buttonDisabled]}
                onPress={handleCreateListing}
                disabled={!ownedFarm || submittingListing}
                activeOpacity={0.88}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {submittingListing ? "Creating listing…" : "Create listing"}
                </ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={activePicker !== null}
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
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
      <ThemedText style={[styles.fieldLabel, { color: colors.text.primary }]}>{label}</ThemedText>
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
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: "#2E2A1F",
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5A564B",
  },
  sectionCard: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    borderRadius: 22,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  sectionCopy: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 110,
  },
  imagePreviewCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 180,
  },
  imagePlaceholderCard: {
    minHeight: 140,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: theme.spacing.md,
  },
  imageActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: theme.spacing.sm,
    flexWrap: "wrap",
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
  map: {
    height: 240,
    borderRadius: 18,
    overflow: "hidden",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  locationSummaryCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
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
  },
  primaryButton: {
    marginTop: theme.spacing.sm,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
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
