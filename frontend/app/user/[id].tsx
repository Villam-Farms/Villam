import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/ui/recipes/recipecard";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/hooks/useTheme";
import {
  followUser,
  getUserProfile,
  unfollowUser,
  type FollowCounts,
  type ProfileRow,
} from "@/lib/follows";
import { supabase } from "@/lib/supabase";

const RECIPE_BUCKET = "recipes";

type UserRecipeRow = {
  id: string;
  title: string;
  difficulty: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  cover_media: { path?: string; url?: string }[] | null;
  total_time_minutes: number | null;
};

type UserRecipe = {
  id: string;
  title: string;
  difficulty?: string;
  imageUrl?: string;
  duration: string;
};

async function resolveRecipeImage(recipe: UserRecipeRow) {
  const media = Array.isArray(recipe.cover_media) ? recipe.cover_media : [];
  const path = recipe.cover_image_path || media.find((item) => item.path)?.path;
  if (path) {
    const { data, error } = await supabase.storage.from(RECIPE_BUCKET).createSignedUrl(path, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return recipe.cover_image_url || media.find((item) => item.url)?.url;
}

async function loadUserRecipes(userId: string): Promise<UserRecipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id,title,difficulty,cover_image_url,cover_image_path,cover_media,total_time_minutes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw error;
  return Promise.all(
    ((data ?? []) as UserRecipeRow[]).map(async (recipe) => ({
      id: recipe.id,
      title: recipe.title,
      difficulty: recipe.difficulty?.trim() || undefined,
      imageUrl: await resolveRecipeImage(recipe),
      duration: recipe.total_time_minutes && recipe.total_time_minutes > 0
        ? `${recipe.total_time_minutes} min`
        : "No time set",
    })),
  );
}

export default function UserProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{
    id: string;
    from?: "addfriends" | "followers" | "following";
  }>();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([]);
  const [updatingFollow, setUpdatingFollow] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !id) return;
      if (id === session?.user.id) {
        router.replace("/(tabs)/profile");
        return;
      }

      let active = true;
      setLoading(true);
      setRecipesLoading(true);
      Promise.all([getUserProfile(accessToken, id), loadUserRecipes(id)])
        .then(([result, recipes]) => {
          if (!active) return;
          setProfile(result.profile);
          setCounts(result.counts);
          setIsFollowing(result.is_following);
          setUserRecipes(recipes);
        })
        .catch((error) => {
          if (!active) return;
          Alert.alert("Unable to open profile", error instanceof Error ? error.message : "Please try again.");
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setRecipesLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [accessToken, id, router, session?.user.id]),
  );

  const toggleFollow = async () => {
    if (!accessToken || !profile) return;
    setUpdatingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(accessToken, profile.id);
        setIsFollowing(false);
        setCounts((current) => ({ ...current, followers: Math.max(0, current.followers - 1) }));
      } else {
        await followUser(accessToken, profile.id);
        setIsFollowing(true);
        setCounts((current) => ({ ...current, followers: current.followers + 1 }));
      }
    } catch (error) {
      Alert.alert("Unable to update follow", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingFollow(false);
    }
  };

  const goBack = () => {
    if (from === "addfriends") {
      router.replace("/(profile)/addfriends");
      return;
    }
    if (from === "followers") {
      router.replace("/(profile)/followers");
      return;
    }
    if (from === "following") {
      router.replace("/(profile)/following");
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/profile");
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.headerBackground,
            {
              height: 133 + insets.top,
              paddingTop: insets.top + theme.spacing.sm,
              backgroundColor: theme.brand.light,
            },
          ]}
        >
          <Pressable
            onPress={goBack}
            style={[styles.backButton, { backgroundColor: colors.background }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={26} color={colors.text.primary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.brand.primary} size="large" />
          </View>
        ) : profile ? (
          <View style={styles.profileSection}>
            <View style={[styles.avatarFrame, { backgroundColor: colors.background }]}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={42} color={theme.neutral.white} />
                </View>
              )}
            </View>

            <View style={styles.userFollowSection}>
              <View style={styles.leftSection}>
                <View style={styles.identity}>
                  <ThemedText type="title" style={[styles.name, { color: colors.text.primary }]}>
                    {profile.full_name ?? profile.username ?? "Villam user"}
                  </ThemedText>
                  {profile.username ? (
                    <ThemedText style={[styles.username, { color: colors.text.secondary }]}>@{profile.username}</ThemedText>
                  ) : null}
                </View>
              </View>
              <Button
                variant={isFollowing ? "outline" : "primary"}
                onPress={toggleFollow}
                disabled={updatingFollow}
                style={styles.followButton}
              >
                {updatingFollow ? "Updating..." : isFollowing ? "Following" : "Follow"}
              </Button>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText style={[styles.statNumber, { color: colors.text.primary }]}>{counts.following}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>Following</ThemedText>
              </View>
              <View style={styles.stat}>
                <ThemedText style={[styles.statNumber, { color: colors.text.primary }]}>{counts.followers}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>Followers</ThemedText>
              </View>
            </View>

            <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border.light }]}>
              <View style={styles.aboutHeader}>
                <View style={styles.aboutIcon}>
                  <Ionicons name="person-outline" size={17} color={theme.brand.primary} />
                </View>
                <ThemedText type="defaultSemiBold" style={[styles.aboutTitle, { color: colors.text.primary }]}>Description</ThemedText>
              </View>
              <ThemedText style={[styles.description, { color: colors.text.secondary }]}>
                {profile.description?.trim() || "This user has not added a description yet."}
              </ThemedText>
            </View>

            <View style={styles.recipesSection}>
              <ThemedText type="title" style={[styles.recipesTitle, { color: colors.text.primary }]}>Recipes</ThemedText>
              {recipesLoading ? (
                <ActivityIndicator color={theme.brand.primary} style={styles.recipesLoader} />
              ) : userRecipes.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recipesRow}
                >
                  {userRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      id={recipe.id}
                      title={recipe.title}
                      duration={recipe.duration}
                      difficulty={recipe.difficulty}
                      imageUrl={recipe.imageUrl}
                      onPress={() => router.push(`/recipe/${recipe.id}`)}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={[styles.emptyRecipes, { backgroundColor: colors.card, borderColor: colors.border.light }]}>
                  <Ionicons name="restaurant-outline" size={28} color={colors.text.tertiary} />
                  <ThemedText style={{ color: colors.text.secondary }}>This user has not published any recipes yet.</ThemedText>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.loadingState}>
            <Ionicons name="person-circle-outline" size={48} color={colors.text.tertiary} />
            <ThemedText style={{ color: colors.text.secondary }}>Profile not found.</ThemedText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
  headerBackground: { height: 133, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", zIndex: 2 },
  loadingState: { flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center", gap: theme.spacing.md },
  profileSection: { paddingHorizontal: theme.spacing.lg, marginTop: -60 },
  avatarFrame: { alignSelf: "flex-start", padding: 4, borderRadius: 60 },
  avatar: { width: 75, height: 75, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: theme.neutral[400], alignItems: "center", justifyContent: "center" },
  userFollowSection: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md },
  leftSection: { flex: 1, marginRight: theme.spacing.sm },
  identity: { marginTop: theme.spacing.xs },
  name: { fontSize: theme.typography.fontSizes.h2, fontWeight: theme.typography.fontWeights.bold },
  username: { fontSize: theme.typography.fontSizes.h4, marginTop: 2 },
  followButton: { minWidth: 112, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xs },
  statsRow: { flexDirection: "row", gap: theme.spacing.xl, marginTop: theme.spacing.md },
  stat: { alignItems: "center" },
  statNumber: { fontSize: theme.typography.fontSizes.h3, fontWeight: theme.typography.fontWeights.bold },
  statLabel: { fontSize: theme.typography.fontSizes.h5, marginTop: 2 },
  aboutCard: { marginTop: theme.spacing.md, padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, borderWidth: 1 },
  aboutHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  aboutIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.brand.light, alignItems: "center", justifyContent: "center" },
  aboutTitle: { fontSize: theme.typography.fontSizes.h3 },
  description: { fontSize: theme.typography.fontSizes.h4, lineHeight: 23 },
  recipesSection: { marginTop: theme.spacing.md, marginBottom: theme.spacing.xl },
  recipesTitle: { fontSize: theme.typography.fontSizes.h2, marginBottom: theme.spacing.md },
  recipesLoader: { alignSelf: "flex-start", marginVertical: theme.spacing.lg },
  recipesRow: { paddingRight: theme.spacing.lg },
  emptyRecipes: { borderWidth: 1, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, alignItems: "center", gap: theme.spacing.sm },
});
