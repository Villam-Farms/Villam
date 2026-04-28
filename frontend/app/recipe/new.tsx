import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  TextInput,
  View,
  Text,
  ScrollView,
  Image,
  FlatList,
  Alert,
  Animated,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Stack, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";

import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

// Assumes you already created a Supabase Storage bucket named "recipes".
// If the bucket is private, keep using the stored `path` values and generate signed URLs when rendering.
const STORAGE_BUCKET = "recipes";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ingredient {
  id: string;
  quantity: string;
  unit: string;
  name: string;
}

interface Step {
  id: string;
  instruction: string;
  photoUris: string[]; // local URIs while editing
}

interface StoredMediaItem {
  path: string;
  url: string;
  type: "image";
  position: number;
}

interface StoredStep {
  id: string;
  position: number;
  instruction: string;
  photo_paths: string[];
  photo_urls: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const onlyDigits = (value: string) => value.replace(/[^0-9]/g, "");

const getFileExtension = (uri: string) => {
  const cleanUri = uri.split("?")[0];
  const ext = cleanUri.split(".").pop()?.toLowerCase();
  return ext || "jpg";
};

const getMimeType = (ext: string) => {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "jpeg":
    case "jpg":
    default:
      return "image/jpeg";
  }
};

const buildStoragePath = ({
  userId,
  recipeId,
  ext,
  kind,
  index,
  stepId,
}: {
  userId: string;
  recipeId: string;
  ext: string;
  kind: "gallery" | "step";
  index: number;
  stepId?: string;
}) => {
  const fileName = `${Date.now()}-${index}-${uid()}.${ext}`;

  if (kind === "gallery") {
    return `${userId}/${recipeId}/gallery/${fileName}`;
  }

  return `${userId}/${recipeId}/steps/${stepId}/${fileName}`;
};

async function requestLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status !== "granted") {
    Alert.alert("Permission needed", "Please allow photo library access to add recipe images.");
    return false;
  }

  return true;
}

async function pickPhotosFromLibrary() {
  const hasPermission = await requestLibraryPermission();
  if (!hasPermission) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
  });

  if (result.canceled) return [];
  return result.assets.map((asset) => asset.uri);
}

async function uploadImageToStorage(uri: string, path: string) {
  const ext = getFileExtension(uri);
  const contentType = getMimeType(ext);

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, arrayBuffer, {
    contentType,
    upsert: false,
  });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicUrlData.publicUrl,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimeField({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colors: any;
}) {
  return (
    <View style={timeStyles.pill}>
      <Text style={[timeStyles.label, { color: colors.text.tertiary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(onlyDigits(v))}
        placeholder="—"
        placeholderTextColor={colors.text.tertiary}
        keyboardType="number-pad"
        returnKeyType="done"
        style={[timeStyles.input, { color: colors.text.primary, borderBottomColor: theme.brand.primary }]}
      />
      <Text style={[timeStyles.unit, { color: colors.text.tertiary }]}>min</Text>
    </View>
  );
}

const timeStyles = StyleSheet.create({
  pill: { alignItems: "center", flex: 1 },
  label: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    borderBottomWidth: 2,
    minWidth: 40,
    paddingBottom: 2,
  },
  unit: { fontSize: 10, marginTop: 3 },
});

function IngredientRow({
  item,
  onUpdate,
  onDelete,
  colors,
}: {
  item: Ingredient;
  onUpdate: (id: string, field: "quantity" | "unit" | "name", val: string) => void;
  onDelete: (id: string) => void;
  colors: any;
}) {
  return (
    <View style={ingStyles.row}>
      <TextInput
        value={item.quantity}
        onChangeText={(v) => onUpdate(item.id, "quantity", v)}
        placeholder="1"
        placeholderTextColor={colors.text.tertiary}
        style={[
          ingStyles.qtyInput,
          {
            backgroundColor: colors.input.background,
            borderColor: colors.border.default,
            color: colors.text.primary,
          },
        ]}
      />
      <TextInput
        value={item.unit}
        onChangeText={(v) => onUpdate(item.id, "unit", v)}
        placeholder="cup"
        placeholderTextColor={colors.text.tertiary}
        style={[
          ingStyles.unitInput,
          {
            backgroundColor: colors.input.background,
            borderColor: colors.border.default,
            color: colors.text.primary,
          },
        ]}
      />
      <TextInput
        value={item.name}
        onChangeText={(v) => onUpdate(item.id, "name", v)}
        placeholder="Ingredient"
        placeholderTextColor={colors.text.tertiary}
        style={[
          ingStyles.nameInput,
          {
            backgroundColor: colors.input.background,
            borderColor: colors.border.default,
            color: colors.text.primary,
          },
        ]}
      />
      <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={22} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );
}

const ingStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%" },
  qtyInput: {
    width: 54,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  unitInput: {
    width: 74,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  nameInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 14,
  },
});

function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
  onDragStart,
  isActive,
  onAddPhoto,
  onDeletePhoto,
  colors,
}: {
  step: Step;
  index: number;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onDragStart: () => void;
  isActive: boolean;
  onAddPhoto: (id: string) => void;
  onDeletePhoto: (stepId: string, photoIndex: number) => void;
  colors: any;
}) {
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scaleValue, {
      toValue: isActive ? 1.03 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isActive, scaleValue]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }} pointerEvents="box-none">
      <View
        style={[
          stepStyles.card,
          { backgroundColor: colors.input.background, borderColor: colors.border.default },
        ]}
      >
        <View style={stepStyles.header}>
          <View style={[stepStyles.stepBadge, { backgroundColor: theme.brand.primary }]}>
            <Text style={stepStyles.stepNum}>{index + 1}</Text>
          </View>
          <Text style={[stepStyles.stepLabel, { color: colors.text.secondary }]}>Step</Text>

          <TouchableOpacity
            onLongPress={onDragStart}
            delayLongPress={120}
            style={[
              stepStyles.dragHandleButton,
              { backgroundColor: colors.background, borderColor: colors.border.default },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="reorder-three-outline" size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onDelete(step.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="trash-outline" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={step.instruction}
          onChangeText={(v) => onUpdate(step.id, v)}
          placeholder="Describe this step..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          textAlignVertical="top"
          style={[stepStyles.textArea, { color: colors.text.primary }]}
        />

        <View style={stepStyles.photoRow}>
          {step.photoUris.map((uri, pi) => (
            <View key={`${step.id}-photo-${pi}`} style={stepStyles.photoThumbWrapper}>
              <Image source={{ uri }} style={stepStyles.photoThumb} resizeMode="cover" />
              <TouchableOpacity
                style={stepStyles.photoDeleteBtn}
                onPress={() => onDeletePhoto(step.id, pi)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Ionicons name="close" size={11} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[
              stepStyles.addPhotoBtn,
              { backgroundColor: colors.background, borderColor: theme.brand.primary },
            ]}
            onPress={() => onAddPhoto(step.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={22} color={theme.brand.primary} />
            <Text style={[stepStyles.addPhotoLabel, { color: theme.brand.primary }]}>Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const stepStyles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stepLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  dragHandleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textArea: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 72,
    textAlignVertical: "top",
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  photoThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
  },
  photoThumb: { width: "100%", height: "100%" },
  photoDeleteBtn: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    width: 64,
    height: 64,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addPhotoLabel: { fontSize: 10, fontWeight: "600" },
});

function SectionHeader({ title, colors }: { title: string; colors: any }) {
  return <Text style={[sectionStyles.title, { color: colors.text.primary }]}>{title}</Text>;
}

const sectionStyles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
    alignSelf: "flex-start",
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NewRecipeScreen() {
  const { colors } = useTheme();
  const [isDraggingStep, setIsDraggingStep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [additionalTime, setAdditionalTime] = useState("");
  const [servings, setServings] = useState("");

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: uid(), quantity: "", unit: "", name: "" },
  ]);

  const [steps, setSteps] = useState<Step[]>([{ id: uid(), instruction: "", photoUris: [] }]);

  const totalMins =
    (parseInt(prepTime, 10) || 0) +
    (parseInt(cookTime, 10) || 0) +
    (parseInt(additionalTime, 10) || 0);

  const totalDisplay = totalMins > 0 ? `${totalMins} min` : "—";

  const hasValidIngredient = useMemo(
    () => ingredients.some((ing) => ing.name.trim().length > 0),
    [ingredients]
  );

  const hasValidStep = useMemo(
    () => steps.some((step) => step.instruction.trim().length > 0),
    [steps]
  );

  const canPublish = title.trim().length > 0 && hasValidIngredient && hasValidStep && !isSaving;

  const isDirty = useMemo(() => {
    const hasMedia = mediaUris.length > 0;
    const hasBasicInfo = title.trim().length > 0 || description.trim().length > 0;
    const hasTimeInfo =
      prepTime.length > 0 || cookTime.length > 0 || additionalTime.length > 0 || servings.length > 0;
    const hasIngredientData = ingredients.some(
      (ing) => ing.quantity.trim() || ing.unit.trim() || ing.name.trim()
    );
    const hasStepData = steps.some(
      (step) => step.instruction.trim().length > 0 || step.photoUris.length > 0
    );

    return hasMedia || hasBasicInfo || hasTimeInfo || hasIngredientData || hasStepData;
  }, [mediaUris, title, description, prepTime, cookTime, additionalTime, servings, ingredients, steps]);

  const confirmLeave = () => {
    if (isSaving) return;

    if (!isDirty) {
      router.back();
      return;
    }

    Alert.alert(
      "Discard recipe?",
      "You have unsaved changes. If you go back now, your recipe will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]
    );
  };

  const handleMediaUpload = async () => {
    const uris = await pickPhotosFromLibrary();
    if (uris.length === 0) return;
    setMediaUris((prev) => [...prev, ...uris]);
  };

  const handleDeleteMedia = (index: number) => {
    setMediaUris((prev) => prev.filter((_, i) => i !== index));
  };

  const addIngredient = () =>
    setIngredients((prev) => [...prev, { id: uid(), quantity: "", unit: "", name: "" }]);

  const updateIngredient = (id: string, field: "quantity" | "unit" | "name", val: string) =>
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? { ...ing, [field]: val } : ing)));

  const deleteIngredient = (id: string) =>
    setIngredients((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const addStep = () =>
    setSteps((prev) => [...prev, { id: uid(), instruction: "", photoUris: [] }]);

  const updateStep = (id: string, text: string) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, instruction: text } : s)));

  const deleteStep = (id: string) =>
    setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));

  const addStepPhoto = async (stepId: string) => {
    const uris = await pickPhotosFromLibrary();
    if (uris.length === 0) return;

    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, photoUris: [...s.photoUris, ...uris] } : s))
    );
  };

  const deleteStepPhoto = (stepId: string, photoIndex: number) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, photoUris: s.photoUris.filter((_, i) => i !== photoIndex) } : s
      )
    );
  };

  const triggerDragHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handlePublish = async () => {
    try {
      if (!title.trim()) {
        Alert.alert("Missing title", "Please give your recipe a title.");
        return;
      }

      const validIngredients = ingredients
        .map((ing, index) => ({
          id: ing.id,
          position: index,
          quantity: ing.quantity.trim(),
          unit: ing.unit.trim(),
          name: ing.name.trim(),
        }))
        .filter((ing) => ing.name.length > 0);

      const rawSteps = steps
        .map((step, index) => ({
          id: step.id,
          position: index,
          instruction: step.instruction.trim(),
          localPhotoUris: step.photoUris,
        }))
        .filter((step) => step.instruction.length > 0);

      if (validIngredients.length === 0) {
        Alert.alert("Missing ingredients", "Please add at least one ingredient.");
        return;
      }

      if (rawSteps.length === 0) {
        Alert.alert("Missing steps", "Please add at least one step.");
        return;
      }

      setIsSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        Alert.alert("Not signed in", "Please sign in before publishing.");
        return;
      }

      const initialPayload = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        cover_image_url: null,
        cover_image_path: null,
        cover_media: [],
        prep_time_minutes: Number(prepTime || 0),
        cook_time_minutes: Number(cookTime || 0),
        additional_time_minutes: Number(additionalTime || 0),
        total_time_minutes:
          Number(prepTime || 0) + Number(cookTime || 0) + Number(additionalTime || 0),
        servings: servings ? Number(servings) : null,
        ingredients: validIngredients,
        steps: rawSteps.map((step) => ({
          id: step.id,
          position: step.position,
          instruction: step.instruction,
          photo_paths: [],
          photo_urls: [],
        })),
      };

      const { data: recipe, error: insertError } = await supabase
        .from("recipes")
        .insert(initialPayload)
        .select()
        .single();

      if (insertError) {
        console.error("Recipe insert error:", insertError);
        throw insertError;
      }

      const recipeId = recipe.id as string;

      const uploadedCoverMedia: StoredMediaItem[] = [];
      let coverImagePath: string | null = null;
      let coverImageUrl: string | null = null;

      for (let i = 0; i < mediaUris.length; i++) {
        const uri = mediaUris[i];
        const ext = getFileExtension(uri);
        const path = buildStoragePath({
          userId: user.id,
          recipeId,
          ext,
          kind: "gallery",
          index: i,
        });

        const uploaded = await uploadImageToStorage(uri, path);

        uploadedCoverMedia.push({
          path: uploaded.path,
          url: uploaded.url,
          type: "image",
          position: i,
        });

        if (i === 0) {
          coverImagePath = uploaded.path;
          coverImageUrl = uploaded.url;
        }
      }

      const uploadedSteps: StoredStep[] = [];

      for (const step of rawSteps) {
        const photoPaths: string[] = [];
        const photoUrls: string[] = [];

        for (let i = 0; i < step.localPhotoUris.length; i++) {
          const uri = step.localPhotoUris[i];
          const ext = getFileExtension(uri);
          const path = buildStoragePath({
            userId: user.id,
            recipeId,
            ext,
            kind: "step",
            index: i,
            stepId: step.id,
          });

          const uploaded = await uploadImageToStorage(uri, path);
          photoPaths.push(uploaded.path);
          photoUrls.push(uploaded.url);
        }

        uploadedSteps.push({
          id: step.id,
          position: step.position,
          instruction: step.instruction,
          photo_paths: photoPaths,
          photo_urls: photoUrls,
        });
      }

      const { error: updateError } = await supabase
        .from("recipes")
        .update({
          cover_image_path: coverImagePath,
          cover_image_url: coverImageUrl,
          cover_media: uploadedCoverMedia,
          steps: uploadedSteps,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recipeId);

      if (updateError) {
        console.error("Recipe update error:", updateError);
        throw updateError;
      }

      Alert.alert("Recipe saved!", "Your recipe and images were uploaded successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/"),
        },
      ]);
    } catch (error: any) {
      console.error("Recipe publish failed:", error);
      Alert.alert(
        "Save failed",
        error?.message ??
          "Something went wrong while saving. Double-check your Storage bucket name, policies, and recipes table."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "",
          headerLeft: () => (
            <TouchableOpacity onPress={confirmLeave} disabled={isSaving}>
              <Ionicons name="arrow-back" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[
                styles.publishBtn,
                {
                  backgroundColor: canPublish ? theme.brand.primary : colors.border.default,
                  opacity: canPublish ? 1 : 0.75,
                },
              ]}
              onPress={handlePublish}
              activeOpacity={0.85}
              disabled={!canPublish}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.publishBtnText}>Publish</Text>
              )}
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />

      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          indicatorStyle="default"
          persistentScrollbar
          scrollEnabled={!isDraggingStep}
        >
          <ThemedView style={styles.container}>
            <Text style={[styles.pageTitle, { color: colors.text.primary }]}>New Recipe</Text>

            {mediaUris.length === 0 ? (
              <TouchableOpacity
                style={[
                  styles.uploadBox,
                  { backgroundColor: colors.input.background, borderColor: theme.brand.primary },
                ]}
                onPress={handleMediaUpload}
                activeOpacity={0.7}
              >
                <Ionicons name="images-outline" size={44} color={theme.brand.primary} />
                <Text style={[styles.uploadText, { color: colors.text.primary }]}>Add photos</Text>
                <Text style={[styles.uploadSubtext, { color: colors.text.tertiary }]}>Photos upload when you publish</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.mediaPreviewContainer}>
                <View style={styles.mainImageWrapper}>
                  <TouchableOpacity onPress={handleMediaUpload} activeOpacity={0.85} style={{ flex: 1 }}>
                    <Image source={{ uri: mediaUris[0] }} style={styles.mainImage} resizeMode="cover" />
                    <View style={[styles.editBadge, { backgroundColor: theme.brand.primary }]}>
                      <Ionicons name="pencil" size={12} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteMedia(0)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>

                {mediaUris.length > 1 && (
                  <FlatList
                    data={mediaUris.slice(1)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(_, i) => i.toString()}
                    contentContainerStyle={styles.thumbnailStrip}
                    renderItem={({ item, index }) => (
                      <View style={styles.thumbnailWrapper}>
                        <TouchableOpacity onPress={handleMediaUpload} activeOpacity={0.8} style={{ flex: 1 }}>
                          <Image source={{ uri: item }} style={styles.thumbnail} resizeMode="cover" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteMedia(index + 1)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                )}
              </View>
            )}

            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.input.background, borderColor: colors.border.default },
              ]}
            >
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={colors.text.tertiary}
                returnKeyType="next"
                style={[styles.titleInput, { color: colors.text.primary }]}
              />
            </View>

            <View
              style={[
                styles.descriptionWrapper,
                { backgroundColor: colors.input.background, borderColor: colors.border.default },
              ]}
            >
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description (Recommended)"
                placeholderTextColor={colors.text.tertiary}
                multiline
                textAlignVertical="top"
                style={[styles.descriptionInput, { color: colors.text.primary }]}
              />
            </View>

            <View
              style={[
                styles.timingCard,
                { backgroundColor: colors.input.background, borderColor: colors.border.default },
              ]}
            >
              <SectionHeader title="Time & Servings" colors={colors} />

              <View style={styles.timeRow}>
                <TimeField label="Prep" value={prepTime} onChange={setPrepTime} colors={colors} />
                <View style={[styles.timeDivider, { backgroundColor: colors.border.default }]} />
                <TimeField label="Cook" value={cookTime} onChange={setCookTime} colors={colors} />
                <View style={[styles.timeDivider, { backgroundColor: colors.border.default }]} />
                <TimeField label="Additional" value={additionalTime} onChange={setAdditionalTime} colors={colors} />
                <View style={[styles.timeDivider, { backgroundColor: colors.border.default }]} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={[timeStyles.label, { color: colors.text.tertiary }]}>Total</Text>
                  <Text style={[styles.totalTimeText, { color: theme.brand.primary }]}>{totalDisplay}</Text>
                </View>
              </View>

              <View style={styles.servingsRow}>
                <Ionicons name="people-outline" size={18} color={colors.text.tertiary} />
                <Text style={[styles.servingsLabel, { color: colors.text.secondary }]}>Servings</Text>
                <TextInput
                  value={servings}
                  onChangeText={(v) => setServings(onlyDigits(v))}
                  placeholder="e.g. 4"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="number-pad"
                  style={[
                    styles.servingsInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border.default,
                      color: colors.text.primary,
                    },
                  ]}
                />
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.input.background, borderColor: colors.border.default },
              ]}
            >
              <SectionHeader title="Ingredients" colors={colors} />
              <Text style={[styles.helperText, { color: colors.text.tertiary }]}>Add quantity, unit, and ingredient name for each item</Text>

              {ingredients.map((ing) => (
                <IngredientRow
                  key={ing.id}
                  item={ing}
                  onUpdate={updateIngredient}
                  onDelete={deleteIngredient}
                  colors={colors}
                />
              ))}

              <TouchableOpacity
                style={[styles.addRowBtn, { borderColor: theme.brand.primary }]}
                onPress={addIngredient}
              >
                <Ionicons name="add" size={18} color={theme.brand.primary} />
                <Text style={[styles.addRowLabel, { color: theme.brand.primary }]}>Add ingredient</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: colors.input.background, borderColor: colors.border.default },
              ]}
            >
              <SectionHeader title="Steps" colors={colors} />
              <Text style={[styles.stepsHint, { color: colors.text.tertiary }]}>Long press and drag to reorder • Step photos upload when you publish</Text>

              <DraggableFlatList
                data={steps}
                keyExtractor={(item) => item.id}
                renderItem={({ item, drag, isActive }: RenderItemParams<Step>) => {
                  const currentIndex = steps.findIndex((s) => s.id === item.id);
                  return (
                    <StepCard
                      step={item}
                      index={currentIndex >= 0 ? currentIndex : 0}
                      onUpdate={updateStep}
                      onDelete={deleteStep}
                      onDragStart={() => {
                        triggerDragHaptic();
                        drag();
                      }}
                      isActive={isActive}
                      onAddPhoto={addStepPhoto}
                      onDeletePhoto={deleteStepPhoto}
                      colors={colors}
                    />
                  );
                }}
                onDragEnd={({ data }) => {
                  triggerDragHaptic();
                  setSteps(data);
                  setIsDraggingStep(false);
                }}
                onDragBegin={() => {
                  triggerDragHaptic();
                  setIsDraggingStep(true);
                }}
                onRelease={() => {
                  triggerDragHaptic();
                  setIsDraggingStep(false);
                }}
                activationDistance={4}
                autoscrollThreshold={70}
                autoscrollSpeed={180}
                dragItemOverflow={false}
                scrollEnabled={false}
                containerStyle={styles.stepsList}
                contentContainerStyle={styles.stepsListContent}
              />

              <TouchableOpacity style={[styles.addRowBtn, { borderColor: theme.brand.primary }]} onPress={addStep}>
                <Ionicons name="add" size={18} color={theme.brand.primary} />
                <Text style={[styles.addRowLabel, { color: theme.brand.primary }]}>Add step</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// ─── Main Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pageTitle: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
    alignSelf: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  uploadBox: {
    width: "100%",
    minHeight: 116,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  uploadText: {
    fontSize: theme.typography.fontSizes.h5,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  uploadSubtext: {
    fontSize: 12,
    textAlign: "center",
  },
  inputWrapper: {
    width: "100%",
    minHeight: 52,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    paddingHorizontal: theme.spacing.sm,
    justifyContent: "center",
  },
  descriptionWrapper: {
    width: "100%",
    minHeight: 110,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: theme.typography.fontWeights.semibold,
  },
  descriptionInput: {
    fontSize: 15,
    lineHeight: 21,
    minHeight: 86,
  },
  mediaPreviewContainer: { width: "100%", gap: theme.spacing.sm },
  mainImageWrapper: {
    width: "100%",
    height: 200,
    borderRadius: theme.borderRadius.xl,
    overflow: "hidden",
  },
  mainImage: { width: "100%", height: "100%" },
  editBadge: {
    position: "absolute",
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    position: "absolute",
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  thumbnailStrip: { gap: theme.spacing.sm, paddingHorizontal: 2 },
  thumbnailWrapper: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: "100%" },

  timingCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 16,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeDivider: { width: 1, height: 36, marginHorizontal: 4 },
  totalTimeText: {
    fontSize: 18,
    fontWeight: "700",
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  servingsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  servingsInput: {
    width: 70,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  sectionCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  helperText: {
    fontSize: 12,
    marginTop: -2,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignSelf: "flex-start",
  },
  addRowLabel: { fontSize: 14, fontWeight: "600" },
  stepsHint: { fontSize: 12, marginTop: -4 },
  stepsList: { width: "100%" },
  stepsListContent: {
    paddingVertical: theme.spacing.xs,
  },

  publishBtn: {
    minWidth: 92,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
