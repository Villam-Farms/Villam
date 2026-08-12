import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useMyProfile } from "@/hooks/useMyProfile";
import { updateMyProfile, uploadMyAvatar } from "@/lib/follows";

export default function EditProfileScreen() {
  const { session } = useAuth();
  const { data: profile } = useMyProfile();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    setCity(profile.location_city ?? "");
    setRegion(profile.location_region ?? "");
  }, [profile]);

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset?.uri) setPhotoUri(asset.uri);
  };

  const save = async () => {
    const token = session?.access_token;
    const userId = session?.user.id;
    const normalizedUsername = username.trim().toLowerCase();
    setUsernameError("");

    if (!token || !userId) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }
    if (!fullName.trim() || !city.trim() || !region.trim()) {
      Alert.alert("Missing information", "Display name, city, and region are required.");
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      setUsernameError("Use 3–30 lowercase letters, numbers, or underscores.");
      return;
    }

    setSaving(true);
    try {
      let result = await updateMyProfile(token, {
        full_name: fullName.trim(),
        username: normalizedUsername,
        location_city: city.trim(),
        location_region: region.trim(),
      });
      if (photoUri) {
        result = await uploadMyAvatar(token, {
          uri: photoUri,
          name: "avatar.jpg",
          type: "image/jpeg",
        });
      }
      queryClient.setQueryData(["me", userId], result.profile);
      await queryClient.invalidateQueries({ queryKey: ["me", userId] });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      if (message.toLowerCase().includes("username")) setUsernameError(message);
      else Alert.alert("Profile not saved", message);
    } finally {
      setSaving(false);
    }
  };

  const avatar = photoUri || profile?.avatar_url || "";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit profile</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={choosePhoto} style={styles.photoButton}>
            <View style={styles.photo}>
              {avatar ? <Image source={{ uri: avatar }} style={styles.image} /> : <Ionicons name="person" size={54} color="#9CA3AF" />}
            </View>
            <Text style={styles.changePhoto}>Change profile photo</Text>
          </TouchableOpacity>
          <Input label="Display name" value={fullName} onChangeText={setFullName} />
          <Input
            label="Username"
            value={username}
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError}
            onChangeText={(value) => {
              setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              setUsernameError("");
            }}
          />
          <Input label="City" value={city} onChangeText={setCity} />
          <Input label="State or region" value={region} onChangeText={setRegion} />
          <Button onPress={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF" },
  header: { height: 60, justifyContent: "center", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
  back: { position: "absolute", left: 20, padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  content: { padding: 24, gap: 18, paddingBottom: 48 },
  photoButton: { alignItems: "center", marginBottom: 8 },
  photo: { width: 116, height: 116, borderRadius: 58, overflow: "hidden", backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  image: { width: 116, height: 116 },
  changePhoto: { marginTop: 10, color: theme.brand.primary, fontWeight: "700" },
});
