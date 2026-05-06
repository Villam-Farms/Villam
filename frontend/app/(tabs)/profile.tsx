import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  Pressable,
  Modal,
  TextInput,
} from "react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/useTheme";
import { theme } from "@/constants/theme";
import { Button } from "@/components/ui/button";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { getMe, uploadMyAvatar, updateMyDescription, type ProfileRow } from "@/lib/follows";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { RecipeCard } from "@/components/ui/recipes/recipecard";

const RECIPE_BUCKET = "recipes";
const FALLBACK_RECIPE_IMAGE = "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop";

type RecipeRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty?: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  cover_media: Array<{ path?: string; url?: string; type?: string; position?: number }> | null;
  prep_time_minutes: number;
  cook_time_minutes: number;
  additional_time_minutes: number;
  total_time_minutes: number;
  servings: number | null;
  ingredients: unknown[];
  steps: unknown[];
  created_at: string;
};

type ProfileRecipeCardData = {
  id: string;
  title: string;
  rating: number;
  ratingsCount: number;
  duration: string;
  difficulty?: string;
  imageUrl?: string;
};

function formatRecipeDuration(totalMinutes: number) {
  if (!totalMinutes || totalMinutes <= 0) return "No time set";
  return `${totalMinutes} min`;
}

function getFirstCoverUrl(recipe: RecipeRow) {
  if (recipe.cover_image_url) return recipe.cover_image_url;

  const media = Array.isArray(recipe.cover_media) ? recipe.cover_media : [];
  const firstMediaWithUrl = media.find((item) => typeof item?.url === "string" && item.url.length > 0);
  return firstMediaWithUrl?.url ?? null;
}

async function resolveRecipeImageUrl(recipe: RecipeRow) {
  const media = Array.isArray(recipe.cover_media) ? recipe.cover_media : [];
  const fallbackPath =
    recipe.cover_image_path ||
    media.find((item) => typeof item?.path === "string" && item.path.length > 0)?.path;

  // Prefer a signed URL when we have a storage path.
  // This works for private buckets and also works fine for public buckets.
  if (fallbackPath) {
    const { data, error } = await supabase.storage.from(RECIPE_BUCKET).createSignedUrl(fallbackPath, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  const directUrl = getFirstCoverUrl(recipe);
  if (directUrl) return directUrl;

  return FALLBACK_RECIPE_IMAGE;
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user.id ?? null;
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [myRecipes, setMyRecipes] = useState<ProfileRecipeCardData[]>([]);
  const [editDescOpen, setEditDescOpen] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const currentDescription = useMemo(() => profile?.description ?? "", [profile?.description]);

  const handleAddFriends = () => {
    router.navigate("/(profile)/addfriends");
  };

  const openEditDescription = () => {
    setDescDraft(currentDescription);
    setEditDescOpen(true);
  };

  const saveDescription = async () => {
    if (!accessToken) return;
    try {
      setSavingDesc(true);
      const next = await updateMyDescription(accessToken, descDraft.trim().length ? descDraft.trim() : null);
      setProfile(next.profile);
      setCounts(next.counts);
      setEditDescOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to update description";
      Alert.alert("Error", message);
    } finally {
      setSavingDesc(false);
    }
  };

  const pickAndUploadAvatar = async () => {
    if (!accessToken || !userId) return;
    try {
      setUploadingAvatar(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow photo library access to upload a profile picture.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      if (asset.fileSize != null && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert("Too large", "Please choose an image under 10MB.");
        return;
      }

      const next = await uploadMyAvatar(accessToken, {
        uri: asset.uri,
        name: "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      setProfile(next.profile);
      setCounts(next.counts);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to upload profile picture";
      Alert.alert("Error", message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !userId) return;
      let isActive = true;
      setLoading(true);
      setRecipesLoading(true);

      (async () => {
        try {
          const [meResult, recipesResult] = await Promise.all([
            getMe(accessToken),
            supabase
              .from("recipes")
              .select(
                "id, user_id, title, description, difficulty, cover_image_url, cover_image_path, cover_media, prep_time_minutes, cook_time_minutes, additional_time_minutes, total_time_minutes, servings, ingredients, steps, created_at"
              )
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(12),
          ]);

          if (!isActive) return;

          setProfile(meResult.profile);
          setCounts(meResult.counts);

          if (recipesResult.error) {
            throw recipesResult.error;
          }

          const rows = (recipesResult.data ?? []) as RecipeRow[];
          const hydratedRecipes = await Promise.all(
            rows.map(async (recipe) => ({
              id: recipe.id,
              title: recipe.title,
              rating: 0,
              ratingsCount: 0,
              duration: formatRecipeDuration(recipe.total_time_minutes ?? 0),
              difficulty: recipe.difficulty?.trim() || undefined,
              imageUrl: await resolveRecipeImageUrl(recipe),
            }))
          );

          if (!isActive) return;
          setMyRecipes(hydratedRecipes);
        } catch (e) {
          if (!isActive) return;
          const message = e instanceof Error ? e.message : "Unable to load profile";
          Alert.alert("Error", message);
        } finally {
          if (!isActive) return;
          setLoading(false);
          setRecipesLoading(false);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [accessToken, userId])
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["bottom"]}
    >
      <ScrollView style={styles.container}>
        <View
          style={[
            styles.headerBackground,
            { backgroundColor: theme.brand.light },
          ]}
        />

        <View style={styles.profileSection}>
          <Pressable
            style={[
              styles.profileImageContainer,
              { backgroundColor: colors.background },
            ]}
            onPress={pickAndUploadAvatar}
            disabled={uploadingAvatar}
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.profileImage, { backgroundColor: theme.neutral[400] }]} />
            )}

            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ThemedText style={{ color: theme.neutral.white, fontSize: 12 }}>
                  …
                </ThemedText>
              ) : (
                <Ionicons name="camera" size={16} color={theme.neutral.white} />
              )}
            </View>
          </Pressable>

          <View style={styles.userFollowSection}>
            <View style={styles.leftSection}>
              <View style={styles.userInfo}>
                <ThemedText type="title" style={styles.userName}>
                  {profile?.full_name ?? profile?.username ?? "Your profile"}
                </ThemedText>
                <ThemedText
                  style={[styles.username, { color: colors.text.secondary }]}
                >
                  {profile?.username ? `@${profile.username}` : ""}
                </ThemedText>
              </View>

              <View style={styles.descriptionContainer}>
                <View style={styles.descriptionHeader}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={styles.descriptionTitle}
                  >
                    Description
                  </ThemedText>
                  <Pressable onPress={openEditDescription} hitSlop={8}>
                    <Ionicons name="pencil" size={16} color={colors.text.secondary} />
                  </Pressable>
                </View>
                <Pressable onPress={openEditDescription}>
                  <ThemedText
                    style={[
                      styles.descriptionText,
                      { color: colors.text.secondary },
                    ]}
                  >
                    {loading
                      ? "Loading..."
                      : profile?.description?.trim().length
                        ? profile.description
                        : "Tap to add a description."}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.statsButtonSection}>
              <View style={styles.statsContainer}>
                <Pressable
                  style={styles.statItem}
                  onPress={() => router.navigate("/(profile)/followers")}
                >
                  <ThemedText style={styles.statNumber}>
                    {counts.followers}
                  </ThemedText>
                  <ThemedText
                    style={[styles.statLabel, { color: colors.text.secondary }]}
                  >
                    Followers
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.statItem}
                  onPress={() => router.navigate("/(profile)/following")}
                >
                  <ThemedText style={styles.statNumber}>
                    {counts.following}
                  </ThemedText>
                  <ThemedText
                    style={[styles.statLabel, { color: colors.text.secondary }]}
                  >
                    Following
                  </ThemedText>
                </Pressable>
              </View>

              <Button
                variant="primary"
                onPress={handleAddFriends}
                style={styles.addFriendsButton}
                disabled={loading}
              >
                {loading ? "Loading..." : "Find People"}
              </Button>
            </View>
          </View>
        </View>

        <View style={styles.recipesHeader}>
          <ThemedText type="title" style={styles.recipesTitle}>
            My Recipes
          </ThemedText>
          <Button
            variant="primary"
            onPress={() => router.push("/recipe/my-recipes")}
            style={styles.seeAllButton}
          >
            See All
          </Button>
        </View>

        {recipesLoading ? (
          <View style={styles.emptyRecipesState}>
            <ThemedText style={{ color: colors.text.secondary }}>Loading your recipes...</ThemedText>
          </View>
        ) : myRecipes.length === 0 ? (
          <View style={styles.emptyRecipesState}>
            <Ionicons name="restaurant-outline" size={28} color={colors.text.secondary} />
            <ThemedText style={[styles.emptyRecipesTitle, { color: colors.text.primary }]}>No recipes yet</ThemedText>
            <ThemedText style={[styles.emptyRecipesText, { color: colors.text.secondary }]}>Recipes you publish will appear here.</ThemedText>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.recipesScroll}
            contentContainerStyle={styles.recipesScrollContent}
            pagingEnabled={false}
          >
            {myRecipes.slice(0, 4).map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                rating={recipe.rating}
                ratingsCount={recipe.ratingsCount}
                duration={recipe.duration}
                difficulty={recipe.difficulty}
                imageUrl={recipe.imageUrl}
                onPress={() => {
                  router.push(`/recipe/${recipe.id}`);
                }}
                onEditPress={() => {
                  console.log("Edit recipe:", recipe.id);
                }}
              />
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <Modal
        visible={editDescOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditDescOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border.default }]}>
            <ThemedText type="title" style={{ color: colors.text.primary }}>
              Edit description
            </ThemedText>

            <TextInput
              value={descDraft}
              onChangeText={setDescDraft}
              placeholder="Write something about you…"
              placeholderTextColor={colors.input.placeholder}
              multiline
              maxLength={280}
              style={[
                styles.modalInput,
                {
                  color: colors.input.text,
                  backgroundColor: colors.input.background,
                  borderColor: colors.border.light,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={() => setEditDescOpen(false)}
                disabled={savingDesc}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={saveDescription}
                disabled={savingDesc}
              >
                {savingDesc ? "Saving..." : "Save"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  userFollowSection: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  container: {
    flex: 1,
  },
  leftSection: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  headerBackground: {
    height: 133,
    width: "100%",
  },
  profileSection: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: -60,
  },
  profileImageContainer: {
    alignSelf: "flex-start",
    borderRadius: 60,
    padding: 4,
  },
  profileImage: {
    width: 75,
    height: 75,
    borderRadius: 50,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.neutral.white,
  },
  statsButtonSection: {
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  statsContainer: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: theme.typography.fontSizes.h3,
  },
  statLabel: {
    fontSize: theme.typography.fontSizes.h5,
    marginTop: 2,
  },
  addFriendsButton: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  userInfo: {
    marginTop: theme.spacing.xs,
  },
  userName: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
  },
  username: {
    fontSize: theme.typography.fontSizes.h4,
    marginTop: 2,
  },
  descriptionContainer: {
    marginTop: theme.spacing.md,
  },
  descriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  descriptionTitle: {
    fontSize: theme.typography.fontSizes.h3,
    marginBottom: theme.spacing.xs,
  },
  descriptionText: {
    fontSize: theme.typography.fontSizes.h4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  modalInput: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  recipesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  recipesTitle: {
    fontSize: theme.typography.fontSizes.h2,
  },
  seeAllButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  recipesScroll: {
    marginTop: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  recipesScrollContent: {
    paddingRight: theme.spacing.lg,
    gap: theme.spacing.md,
  },

  emptyRecipesState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: 8,
  },
  emptyRecipesTitle: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.bold,
  },
  emptyRecipesText: {
    fontSize: theme.typography.fontSizes.body,
    textAlign: "center",
  },
  recipeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  recipeModalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  recipeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  recipeModalTitle: {
    fontSize: theme.typography.fontSizes.h2,
  },
  recipeModalCount: {
    fontSize: theme.typography.fontSizes.h5,
    marginTop: 2,
  },
  recipeModalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  recipeSearchBox: {
    minHeight: 46,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  recipeSearchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
    paddingVertical: theme.spacing.sm,
  },
  recipeModalList: {
    marginTop: theme.spacing.md,
  },
  recipeModalListContent: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  recipeListItem: {
    minHeight: 124,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  recipeListImage: {
    width: 104,
    minHeight: 124,
  },
  recipeListBody: {
    flex: 1,
    padding: theme.spacing.md,
    gap: 4,
  },
  recipeListTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  recipeCategory: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h5,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  recipeRatingText: {
    fontSize: theme.typography.fontSizes.h5,
    fontFamily: theme.typography.fontFamily,
  },
  recipeListTitle: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeListDescription: {
    fontSize: theme.typography.fontSizes.h5,
    lineHeight: 18,
  },
  recipeListFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  recipeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  recipeMetaText: {
    fontSize: theme.typography.fontSizes.h5,
    fontFamily: theme.typography.fontFamily,
  },
  noRecipesState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.xs,
  },
  noRecipesTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: theme.typography.fontWeights.bold,
  },
  noRecipesText: {
    fontSize: theme.typography.fontSizes.h4,
    textAlign: "center",
  },
});
