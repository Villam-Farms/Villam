import React, { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useFocusEffect } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";

const RECIPE_BUCKET = "recipes";

type MealTime = "Breakfast" | "Lunch" | "Dinner" | "Uncategorized";
type MealFilter = "All" | MealTime;
type RecipeDifficulty = "Easy" | "Medium" | "Hard";

type StoredIngredient = {
  id?: string;
  position?: number;
  quantity?: string;
  unit?: string;
  name?: string;
};

type StoredStep = {
  id?: string;
  position?: number;
  instruction?: string;
  photo_paths?: string[];
  photo_urls?: string[];
};

type StoredMediaItem = {
  path?: string;
  url?: string;
  type?: "image";
  position?: number;
};

type StoredRecipe = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  cover_media: StoredMediaItem[] | null;
  prep_time_minutes: number;
  cook_time_minutes: number;
  additional_time_minutes: number;
  total_time_minutes: number;
  servings: number | null;
  ingredients: StoredIngredient[] | null;
  steps: StoredStep[] | null;
  tags: string[] | null;
  difficulty: RecipeDifficulty;
  created_at: string;
  updated_at: string;
};

type RecipeWithMeal = StoredRecipe & {
  mealTime: MealTime;
};

const MEAL_FILTERS: MealFilter[] = ["All", "Breakfast", "Lunch", "Dinner", "Uncategorized"];
const MEAL_TAGS: MealTime[] = ["Breakfast", "Lunch", "Dinner"];

const MEAL_COLORS: Record<MealTime, string> = {
  Breakfast: "#F59E0B",
  Lunch: "#10B981",
  Dinner: "#6366F1",
  Uncategorized: "#6B7280",
};

const MEAL_ICONS: Record<MealTime, keyof typeof Ionicons.glyphMap> = {
  Breakfast: "sunny-outline",
  Lunch: "partly-sunny-outline",
  Dinner: "moon-outline",
  Uncategorized: "help-circle-outline",
};

const asArray = <T,>(value: T[] | null | undefined): T[] => {
  return Array.isArray(value) ? value : [];
};

const sortByPosition = <T extends { position?: number }>(items: T[]) => {
  return [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
};

const getTags = (recipe: StoredRecipe) => {
  return asArray(recipe.tags).filter(Boolean);
};

const getMealTime = (recipe: StoredRecipe): MealTime => {
  const tags = getTags(recipe);
  const matchedMeal = MEAL_TAGS.find((meal) =>
    tags.some((tag) => tag.toLowerCase() === meal.toLowerCase())
  );

  return matchedMeal ?? "Uncategorized";
};

const getOtherTags = (recipe: StoredRecipe) => {
  const mealTime = getMealTime(recipe);

  return getTags(recipe).filter((tag) => tag.toLowerCase() !== mealTime.toLowerCase());
};

const getIngredientLabel = (ingredient: StoredIngredient) => {
  return [ingredient.quantity, ingredient.unit, ingredient.name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
};

const formatMinutes = (minutes: number | null | undefined) => {
  const safeMinutes = Number(minutes || 0);

  if (safeMinutes <= 0) return "—";

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours <= 0) return `${mins} min`;
  if (mins <= 0) return `${hours} hr`;

  return `${hours} hr ${mins} min`;
};

const getStepPhotoUrls = (recipe: StoredRecipe) => {
  return sortByPosition(asArray(recipe.steps)).flatMap((step) => asArray(step.photo_urls));
};

const getCoverImageUrl = (recipe: StoredRecipe) => {
  const coverImageUrl = recipe.cover_image_url?.trim();

  if (coverImageUrl) return coverImageUrl;

  const firstCoverMedia = sortByPosition(asArray(recipe.cover_media)).find((item) => item.url?.trim());

  if (firstCoverMedia?.url) return firstCoverMedia.url;

  const firstStepPhoto = getStepPhotoUrls(recipe).find((url) => url?.trim());

  if (firstStepPhoto) return firstStepPhoto;

  return null;
};

const resolveStorageUrl = async (path?: string | null, fallbackUrl?: string | null) => {
  const cleanPath = path?.trim();
  const cleanFallbackUrl = fallbackUrl?.trim() || null;

  if (cleanPath) {
    const { data, error } = await supabase.storage
      .from(RECIPE_BUCKET)
      .createSignedUrl(cleanPath, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    if (error) {
      console.warn("Could not create signed image URL:", cleanPath, error.message);
    }
  }

  return cleanFallbackUrl;
};

const hydrateRecipeImages = async (recipe: StoredRecipe): Promise<StoredRecipe> => {
  const sortedCoverMedia = sortByPosition(asArray(recipe.cover_media));
  const firstMedia = sortedCoverMedia.find((item) => item.path || item.url);

  const coverImageUrl = await resolveStorageUrl(
    recipe.cover_image_path || firstMedia?.path || null,
    recipe.cover_image_url || firstMedia?.url || null
  );

  const coverMedia = await Promise.all(
    sortedCoverMedia.map(async (item) => ({
      ...item,
      url: (await resolveStorageUrl(item.path ?? null, item.url ?? null)) ?? item.url,
    }))
  );

  const steps = await Promise.all(
    sortByPosition(asArray(recipe.steps)).map(async (step) => {
      const photoPaths = asArray(step.photo_paths);
      const photoUrls = asArray(step.photo_urls);
      const maxPhotoCount = Math.max(photoPaths.length, photoUrls.length);

      if (maxPhotoCount === 0) {
        return {
          ...step,
          photo_urls: [],
        };
      }

      const resolvedPhotoUrls = await Promise.all(
        Array.from({ length: maxPhotoCount }).map((_, index) =>
          resolveStorageUrl(photoPaths[index] ?? null, photoUrls[index] ?? null)
        )
      );

      return {
        ...step,
        photo_urls: resolvedPhotoUrls.filter(Boolean) as string[],
      };
    })
  );

  return {
    ...recipe,
    cover_image_url: coverImageUrl ?? recipe.cover_image_url,
    cover_media: coverMedia,
    steps,
  };
};

export default function MyRecipesScreen() {
  const { colors } = useTheme();

  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMeal, setActiveMeal] = useState<MealFilter>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(searchQuery);

  const loadRecipes = useCallback(async ({ refreshing = false } = {}) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setRecipes([]);
        setErrorMessage("You need to be signed in to view your recipes.");
        return;
      }

      const { data, error } = await supabase
        .from("recipes")
        .select(
          "id, user_id, title, description, cover_image_url, cover_image_path, cover_media, prep_time_minutes, cook_time_minutes, additional_time_minutes, total_time_minutes, servings, ingredients, steps, tags, difficulty, created_at, updated_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const hydratedRecipes = await Promise.all(
        ((data ?? []) as StoredRecipe[]).map((recipe) => hydrateRecipeImages(recipe))
      );

      setRecipes(hydratedRecipes);
    } catch (error: any) {
      console.error("Recipe load failed:", error);
      setErrorMessage(error?.message ?? "Could not load recipes.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [loadRecipes])
  );

  const recipesWithMeal = useMemo<RecipeWithMeal[]>(() => {
    return recipes.map((recipe) => ({
      ...recipe,
      mealTime: getMealTime(recipe),
    }));
  }, [recipes]);

  const mealCounts = useMemo(() => {
    return recipesWithMeal.reduce<Record<MealTime, number>>(
      (counts, recipe) => ({
        ...counts,
        [recipe.mealTime]: counts[recipe.mealTime] + 1,
      }),
      { Breakfast: 0, Lunch: 0, Dinner: 0, Uncategorized: 0 }
    );
  }, [recipesWithMeal]);

  const visibleFilters = useMemo(() => {
    return MEAL_FILTERS.filter((meal) => meal === "All" || meal !== "Uncategorized" || mealCounts.Uncategorized > 0);
  }, [mealCounts.Uncategorized]);

  const filteredRecipes = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return recipesWithMeal.filter((recipe) => {
      const tags = getTags(recipe);
      const ingredients = sortByPosition(asArray(recipe.ingredients));
      const steps = sortByPosition(asArray(recipe.steps));
      const matchesMeal = activeMeal === "All" || recipe.mealTime === activeMeal;

      const searchableText = [
        recipe.title,
        recipe.description ?? "",
        recipe.difficulty,
        recipe.mealTime,
        ...tags,
        ...ingredients.map(getIngredientLabel),
        ...steps.map((step) => step.instruction ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      return matchesMeal && matchesSearch;
    });
  }, [activeMeal, deferredSearch, recipesWithMeal]);

  const groupedRecipes = useMemo(() => {
    return filteredRecipes.reduce<Record<MealTime, RecipeWithMeal[]>>(
      (groups, recipe) => {
        groups[recipe.mealTime].push(recipe);
        return groups;
      },
      { Breakfast: [], Lunch: [], Dinner: [], Uncategorized: [] }
    );
  }, [filteredRecipes]);

  const renderRecipeImage = (recipe: StoredRecipe, imageStyle: any) => {
    const imageUrl = getCoverImageUrl(recipe);

    if (imageUrl) {
      return (
        <Image
          source={{ uri: imageUrl }}
          style={[imageStyle, { backgroundColor: colors.input.background }]}
          resizeMode="cover"
          onError={(event) => console.warn("Recipe image failed to load:", imageUrl, event.nativeEvent.error)}
        />
      );
    }

    return (
      <View style={[imageStyle, styles.imagePlaceholder, { backgroundColor: colors.input.background }]}>
        <Ionicons name="restaurant-outline" size={26} color={colors.text.tertiary} />
      </View>
    );
  };

  const renderRecipeCard = (recipe: RecipeWithMeal, variant: "compact" | "full") => {
    const mealColor = MEAL_COLORS[recipe.mealTime];
    const mealIcon = MEAL_ICONS[recipe.mealTime];
    const otherTags = getOtherTags(recipe);
    const ingredientCount = asArray(recipe.ingredients).length;
    const stepCount = asArray(recipe.steps).length;

    return (
      <TouchableOpacity
        key={recipe.id}
        style={[
          variant === "compact" ? styles.compactCard : styles.recipeCard,
          {
            backgroundColor: colors.background,
            borderColor: colors.border.light,
          },
        ]}
        activeOpacity={0.88}
        onPress={() => router.push(`/recipe/${recipe.id}`)}
      >
        {renderRecipeImage(recipe, variant === "compact" ? styles.compactImage : styles.recipeImage)}

        <View style={styles.cardBody}>
          <View style={[styles.mealBadge, { backgroundColor: `${mealColor}22` }]}>
            <Ionicons name={mealIcon} size={12} color={mealColor} />
            <ThemedText style={[styles.mealBadgeText, { color: mealColor }]}>{recipe.mealTime}</ThemedText>
          </View>

          <ThemedText
            style={[variant === "compact" ? styles.compactTitle : styles.recipeTitle, { color: colors.text.primary }]}
            numberOfLines={variant === "compact" ? 2 : 3}
          >
            {recipe.title}
          </ThemedText>

          <ThemedText style={[styles.recipeDescription, { color: colors.text.secondary }]} numberOfLines={2}>
            {recipe.description || "No description added."}
          </ThemedText>

          {otherTags.length > 0 && (
            <View style={styles.tagRow}>
              {otherTags.slice(0, variant === "compact" ? 3 : 6).map((tag) => (
                <View key={`${recipe.id}-${tag}`} style={[styles.tagPill, { backgroundColor: colors.input.background }]}>
                  <ThemedText style={[styles.tagText, { color: colors.text.secondary }]}>#{tag}</ThemedText>
                </View>
              ))}
            </View>
          )}

          <View style={styles.metaRow}>
            <MetaItem icon="time-outline" label={formatMinutes(recipe.total_time_minutes)} colors={colors} />
            <MetaItem icon="flame-outline" label={recipe.difficulty} colors={colors} />
          </View>

          <ThemedText style={[styles.cardSmallText, { color: colors.text.secondary }]}>
            {recipe.servings ? `${recipe.servings} servings` : "Servings not set"} • {ingredientCount} ingredients •{" "}
            {stepCount} steps
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadRecipes({ refreshing: true })} />}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.iconButton, { borderColor: colors.border.light, backgroundColor: colors.background }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, styles.addButton, { backgroundColor: theme.brand.primary }]}
            onPress={() => router.push("/recipe/new")}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={theme.neutral.white} />
            <ThemedText style={styles.addButtonText}>New Recipe</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText style={[styles.eyebrow, { color: theme.brand.tertiary }]}>My kitchen</ThemedText>
          <ThemedText style={[styles.heroTitle, { color: colors.text.primary }]}>All your recipes, sorted by meal.</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            {recipes.length} saved {recipes.length === 1 ? "recipe" : "recipes"} across breakfast, lunch, and dinner.
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          {MEAL_TAGS.map((meal) => {
            const color = MEAL_COLORS[meal];
            const icon = MEAL_ICONS[meal];
            const isActive = activeMeal === meal;

            return (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isActive ? color : colors.border.light,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveMeal(isActive ? "All" : meal)}
              >
                <Ionicons name={icon} size={22} color={color} />
                <ThemedText style={[styles.statValue, { color: colors.text.primary }]}>{mealCounts[meal]}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>{meal}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.input.background, borderColor: colors.border.light }]}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes, tags, ingredients, or steps"
            placeholderTextColor={colors.input.placeholder}
            style={[styles.searchInput, { color: colors.input.text }]}
            autoCorrect={false}
            autoCapitalize="none"
          />

          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {visibleFilters.map((meal) => {
            const isActive = meal === activeMeal;
            const chipColor = meal === "All" ? theme.brand.primary : MEAL_COLORS[meal];
            const icon = meal === "All" ? null : MEAL_ICONS[meal];

            return (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? chipColor : colors.background,
                    borderColor: isActive ? chipColor : colors.border.default,
                  },
                ]}
                onPress={() => setActiveMeal(meal)}
                activeOpacity={0.8}
              >
                {icon && <Ionicons name={icon} size={14} color={isActive ? theme.neutral.white : colors.text.secondary} />}

                <ThemedText style={[styles.filterChipText, { color: isActive ? theme.neutral.white : colors.text.secondary }]}>
                  {meal}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <StateCard colors={colors} icon="refresh-outline" title="Loading recipes..." />
        ) : errorMessage ? (
          <StateCard
            colors={colors}
            icon="warning-outline"
            title="Could not load recipes"
            body={errorMessage}
            actionLabel="Try again"
            onAction={() => loadRecipes()}
          />
        ) : recipes.length === 0 ? (
          <StateCard
            colors={colors}
            icon="book-outline"
            title="No saved recipes yet"
            body="Create a recipe and it will show up here."
            actionLabel="Create recipe"
            onAction={() => router.push("/recipe/new")}
          />
        ) : filteredRecipes.length === 0 ? (
          <StateCard
            colors={colors}
            icon="search-outline"
            title="No recipes found"
            body="Try a different search term or switch back to All."
          />
        ) : activeMeal === "All" ? (
          <View style={styles.groupedContent}>
            {(["Breakfast", "Lunch", "Dinner", "Uncategorized"] as MealTime[]).map((meal) => {
              const group = groupedRecipes[meal];

              if (group.length === 0) return null;

              const color = MEAL_COLORS[meal];
              const icon = MEAL_ICONS[meal];

              return (
                <View key={meal} style={styles.mealSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionIconBadge, { backgroundColor: `${color}22` }]}>
                        <Ionicons name={icon} size={18} color={color} />
                      </View>

                      <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>{meal}</ThemedText>
                    </View>

                    <ThemedText style={[styles.sectionCount, { color: colors.text.secondary }]}>
                      {group.length} {group.length === 1 ? "recipe" : "recipes"}
                    </ThemedText>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactRow}>
                    {group.map((recipe) => renderRecipeCard(recipe, "compact"))}
                  </ScrollView>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.recipeGrid}>{filteredRecipes.map((recipe) => renderRecipeCard(recipe, "full"))}</View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaItem({
  icon,
  label,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: any;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={colors.text.secondary} />
      <ThemedText style={[styles.metaText, { color: colors.text.secondary }]}>{label}</ThemedText>
    </View>
  );
}

function StateCard({
  colors,
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  colors: any;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.stateCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
      {title === "Loading recipes..." ? (
        <ActivityIndicator size="small" color={theme.brand.primary} />
      ) : (
        <Ionicons name={icon} size={28} color={colors.text.tertiary} />
      )}

      <ThemedText style={[styles.stateTitle, { color: colors.text.primary }]}>{title}</ThemedText>

      {!!body && <ThemedText style={[styles.stateBody, { color: colors.text.secondary }]}>{body}</ThemedText>}

      {!!actionLabel && !!onAction && (
        <TouchableOpacity style={styles.stateButton} onPress={onAction} activeOpacity={0.85}>
          <ThemedText style={styles.stateButtonText}>{actionLabel}</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing["4xl"],
    gap: theme.spacing.lg,
  },
  header: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    height: 44,
    minWidth: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  addButton: {
    borderWidth: 0,
  },
  addButtonText: {
    color: theme.neutral.white,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  heroCopy: {
    gap: theme.spacing.sm,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeights.bold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: theme.typography.fontFamily,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  heroSubtitle: {
    fontSize: theme.typography.fontSizes.h4,
    lineHeight: 24,
    fontFamily: theme.typography.fontFamily,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    paddingTop: 6,
    fontSize: 26,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
  },
  searchBar: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
  filterRow: {
    gap: theme.spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  groupedContent: {
    gap: theme.spacing.xl,
  },
  mealSection: {
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
  },
  compactRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  compactCard: {
    width: 230,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  compactImage: {
    width: "100%",
    height: 130,
  },
  recipeGrid: {
    gap: theme.spacing.md,
  },
  recipeCard: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  recipeImage: {
    width: "100%",
    height: 190,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    padding: theme.spacing.md,
    gap: 8,
  },
  mealBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  mealBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  compactTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTitle: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  cardSmallText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: theme.typography.fontFamily,
  },
  stateCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    textAlign: "center",
  },
  stateBody: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily,
  },
  stateButton: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.brand.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
  },
  stateButtonText: {
    color: theme.neutral.white,
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
});