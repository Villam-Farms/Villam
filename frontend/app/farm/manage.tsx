import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useTheme } from "@/hooks/useTheme";
import {
  clearFarmImage,
  deleteFarm,
  fetchOwnedFarmByUserId,
  updateFarm,
  uploadFarmImage,
} from "@/lib/farms";

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

function formatLocation(address: AddressParts) {
  return [address.city, address.state, address.postal_code, address.country]
    .filter((value) => value?.trim())
    .join(", ");
}

export default function ManageFarmScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { coords: userCoords, refresh: refreshLocation } = useCurrentLocation();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [address, setAddress] = useState<AddressParts>({
    city: null,
    state: null,
    postal_code: null,
    country: null,
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: farm, isLoading, error } = useQuery({
    queryKey: ["owned-farm", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      if (!session?.user.id) return null;
      return fetchOwnedFarmByUserId(session.user.id);
    },
  });

  useEffect(() => {
    if (!isLoading && !error && !farm) {
      router.replace("/listing/new");
    }
  }, [error, farm, isLoading]);

  useEffect(() => {
    if (!farm) return;
    setName(farm.name);
    setWebsite(farm.website ?? "");
    setDescription(farm.description ?? "");
    setImageUri(farm.imageUrl ?? null);
    setRegion({
      latitude: farm.latitude,
      longitude: farm.longitude,
      latitudeDelta: DEFAULT_REGION.latitudeDelta,
      longitudeDelta: DEFAULT_REGION.longitudeDelta,
    });
    setAddress({
      city: farm.city ?? null,
      state: farm.state ?? null,
      postal_code: farm.postal_code ?? null,
      country: farm.country ?? null,
    });
  }, [farm]);

  const updateLocation = async (latitude: number, longitude: number) => {
    setRegion({ latitude, longitude, latitudeDelta: DEFAULT_REGION.latitudeDelta, longitudeDelta: DEFAULT_REGION.longitudeDelta });
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = places[0];
      setAddress({
        city: place?.city ?? null,
        state: place?.region ?? null,
        postal_code: place?.postalCode ?? null,
        country: place?.country ?? null,
      });
    } catch {
      setAddress({ city: null, state: null, postal_code: null, country: null });
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to upload a farm photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return;
    if (asset.fileSize != null && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert("Too large", "Please choose an image under 10MB.");
      return;
    }
    setPendingImageUri(asset.uri);
    setImageUri(asset.uri);
    setRemoveImage(false);
  };

  const save = async () => {
    if (!farm || !session?.user.id) return;
    if (!name.trim()) {
      Alert.alert("Farm name required", "Enter a farm name before saving.");
      return;
    }
    setSaving(true);
    try {
      await updateFarm({
        id: farm.id,
        name: name.trim(),
        latitude: region.latitude,
        longitude: region.longitude,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
        website,
        description,
      });
      if (pendingImageUri) {
        await uploadFarmImage(session.user.id, farm.id, pendingImageUri);
      } else if (removeImage) {
        await clearFarmImage(farm.id, farm.imagePath);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owned-farm", session.user.id] }),
        queryClient.invalidateQueries({ queryKey: ["farms"] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] }),
      ]);
      Alert.alert("Farm updated", "Your farm details have been saved.", [
        {
          text: "Done",
          onPress: () => router.canGoBack() ? router.back() : router.replace("/(tabs)/listings"),
        },
      ]);
    } catch (saveError) {
      Alert.alert("Update failed", saveError instanceof Error ? saveError.message : "Could not update your farm.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete farm?",
      "This permanently deletes your farm, all of its listings, ratings, and images. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete farm", style: "destructive", onPress: () => void removeFarm() },
      ]
    );
  };

  const removeFarm = async () => {
    if (!farm || !session?.access_token) {
      Alert.alert("Sign in required", "Please sign in again before deleting your farm.");
      return;
    }
    setDeleting(true);
    try {
      await deleteFarm(session.access_token, farm.id);
      queryClient.setQueryData(["owned-farm", session.user.id], null);
      queryClient.setQueryData(["owned-marketplace-listings", farm.id], []);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owned-farm", session.user.id] }),
        queryClient.invalidateQueries({ queryKey: ["owned-marketplace-listings", farm.id] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] }),
        queryClient.invalidateQueries({ queryKey: ["farms"] }),
      ]);
      Alert.alert("Farm deleted", "Your farm and its listings have been removed.", [
        { text: "Done", onPress: () => router.replace("/listing/new") },
      ]);
    } catch (deleteError) {
      Alert.alert("Delete failed", deleteError instanceof Error ? deleteError.message : "Could not delete your farm.");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}><ThemedText>Loading farm…</ThemedText></SafeAreaView>;
  }

  if (error || !farm) {
    return <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}><ThemedText>Opening farm setup…</ThemedText></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: "#F7E5BF" }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/listings")}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#2E2A1F" />
          </TouchableOpacity>
          <ThemedText style={styles.eyebrow}>Farm settings</ThemedText>
          <ThemedText style={styles.title}>Manage your farm</ThemedText>
          <ThemedText style={styles.subtitle}>Update the details shoppers see about your farm.</ThemedText>
        </View>

        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border.light }]}>
          <FieldLabel label="Farm photo" colors={colors} />
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" /> : <View style={[styles.imagePlaceholder, { backgroundColor: colors.card }]}><Ionicons name="image-outline" size={26} color={colors.text.tertiary} /><ThemedText style={{ color: colors.text.secondary }}>No farm photo</ThemedText></View>}
          <View style={styles.imageActions}>
            <ActionButton label={imageUri ? "Change photo" : "Add photo"} icon="images-outline" onPress={pickImage} colors={colors} />
            {imageUri ? <ActionButton label="Remove" icon="trash-outline" onPress={() => { setImageUri(null); setPendingImageUri(null); setRemoveImage(true); }} colors={colors} /> : null}
          </View>

          <FieldLabel label="Farm name" colors={colors} />
          <TextInput value={name} onChangeText={setName} style={[styles.input, { color: colors.input.text, backgroundColor: colors.input.background, borderColor: colors.border.light }]} placeholder="Farm name" placeholderTextColor={colors.input.placeholder} />

          <FieldLabel label="Farm location" colors={colors} />
          <ThemedText style={[styles.helper, { color: colors.text.secondary }]}>Tap the map to move your farm location.</ThemedText>
          <MapView style={styles.map} region={region} onPress={(event) => void updateLocation(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}>
            <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />
          </MapView>
          <ActionButton label="Use my location" icon="locate-outline" onPress={async () => { await refreshLocation(); const coords = userCoords ?? (await Location.getCurrentPositionAsync({})).coords; await updateLocation(coords.latitude, coords.longitude); }} colors={colors} />
          <ThemedText style={[styles.location, { color: colors.text.secondary }]}>{formatLocation(address) || "Choose a farm location"}</ThemedText>

          <FieldLabel label="Website" colors={colors} />
          <TextInput value={website} onChangeText={setWebsite} style={[styles.input, { color: colors.input.text, backgroundColor: colors.input.background, borderColor: colors.border.light }]} placeholder="https://yourfarm.com" placeholderTextColor={colors.input.placeholder} autoCapitalize="none" keyboardType="url" />
          <FieldLabel label="Description" colors={colors} />
          <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.description, { color: colors.input.text, backgroundColor: colors.input.background, borderColor: colors.border.light }]} placeholder="Tell shoppers about your farm" placeholderTextColor={colors.input.placeholder} multiline textAlignVertical="top" />
          <TouchableOpacity style={[styles.saveButton, (saving || deleting) && styles.disabled]} onPress={save} disabled={saving || deleting}><ThemedText style={styles.saveText}>{saving ? "Saving…" : "Save farm changes"}</ThemedText></TouchableOpacity>
          <TouchableOpacity style={[styles.deleteButton, (saving || deleting) && styles.disabled]} onPress={confirmDelete} disabled={saving || deleting}>
            <Ionicons name="trash-outline" size={16} color="#A32929" />
            <ThemedText style={styles.deleteText}>{deleting ? "Deleting farm…" : "Delete farm"}</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: ReturnType<typeof useTheme>["colors"] }) {
  return <ThemedText style={[styles.label, { color: colors.text.primary }]}>{label}</ThemedText>;
}

function ActionButton({ label, icon, onPress, colors }: { label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void; colors: ReturnType<typeof useTheme>["colors"] }) {
  return <TouchableOpacity style={[styles.actionButton, { borderColor: colors.border.light, backgroundColor: colors.card }]} onPress={onPress}><Ionicons name={icon} size={16} color={colors.text.primary} /><ThemedText style={[styles.actionText, { color: colors.text.primary }]}>{label}</ThemedText></TouchableOpacity>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { paddingBottom: theme.spacing.xl },
  hero: { padding: theme.spacing.lg, gap: 6 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.8)", marginBottom: theme.spacing.sm },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: "#6E7B37", fontWeight: "700" },
  title: { fontSize: 30, lineHeight: 36, color: "#2E2A1F", fontWeight: "700" },
  subtitle: { color: "#5A564B", fontSize: 14, lineHeight: 20 },
  form: { margin: theme.spacing.lg, marginTop: 0, borderWidth: 1, borderRadius: 22, padding: theme.spacing.lg, gap: 10 },
  label: { fontSize: 14, fontWeight: "700", marginTop: theme.spacing.sm },
  helper: { fontSize: 12, lineHeight: 17 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  description: { minHeight: 108 },
  image: { width: "100%", height: 190, borderRadius: 16 },
  imagePlaceholder: { height: 140, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  imageActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionButton: { alignSelf: "flex-start", borderWidth: 1, borderRadius: theme.borderRadius.full, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontSize: 12, fontWeight: "700" },
  map: { height: 220, borderRadius: 16, overflow: "hidden" },
  location: { fontSize: 12, lineHeight: 17 },
  saveButton: { marginTop: theme.spacing.md, backgroundColor: "#3D6B2F", borderRadius: theme.borderRadius.full, alignItems: "center", paddingVertical: 14 },
  saveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  deleteButton: { borderWidth: 1, borderColor: "#E8B6B6", borderRadius: theme.borderRadius.full, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingVertical: 12, backgroundColor: "#FFF6F6" },
  deleteText: { color: "#A32929", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
