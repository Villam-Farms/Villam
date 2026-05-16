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

const MEAL_TAGS = ["Breakfast", "Lunch", "Dinner"];

const asArray = <T,>(value: T[] | null | undefined): T[] => {
  return Array.isArray(value) ? value : [];
};

const sortByPosition = <T extends { position?: number }>(items: T[]) => {
  return [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
};

const getTags = (recipe: StoredRecipe) => {
  return asArray(recipe.tags).filter(Boolean);
};

const getMealTags = (recipe: StoredRecipe) => {
  return getTags(recipe).filter((tag) =>
    MEAL_TAGS.some((meal) => meal.toLowerCase() === tag.toLowerCase())
  );
};

const getOtherTags = (recipe: StoredRecipe) => {
  return getTags(recipe).filter(
    (tag) => !MEAL_TAGS.some((meal) => meal.toLowerCase() === tag.toLowerCase())
  );
};

const getCategory = (recipe: StoredRecipe) => {
  return getMealTags(recipe)[0] ?? getTags(recipe)[0] ?? "Recipe";
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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

  if (!cleanPath) {
    return cleanFallbackUrl;
  }

  const { data, error } = await supabase.storage
    .from(RECIPE_BUCKET)
    .createSignedUrl(cleanPath, 60 * 60);

  if (!error && data?.signedUrl) {
    return data.signedUrl;
  }

  if (error) {
    console.warn("Could not create signed image URL:", cleanPath, error.message);
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

export default function RecipesScreen() {
  const { colors } = useTheme();

  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  const loadRecipes = useCallback(async ({ refreshing = false } = {}) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      const { data, error } = await supabase
        .from("recipes")
        .select(
          "id, user_id, title, description, cover_image_url, cover_image_path, cover_media, prep_time_minutes, cook_time_minutes, additional_time_minutes, total_time_minutes, servings, ingredients, steps, tags, difficulty, created_at, updated_at"
        )
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

  const categories = useMemo(() => {
    const allTags = recipes.flatMap((recipe) => getTags(recipe));
    const uniqueTags = Array.from(new Map(allTags.map((tag) => [tag.toLowerCase(), tag])).values());

    return ["All", ...uniqueTags];
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return recipes.filter((recipe) => {
      const tags = getTags(recipe);
      const ingredients = sortByPosition(asArray(recipe.ingredients));
      const steps = sortByPosition(asArray(recipe.steps));

      const matchesCategory =
        activeCategory === "All" || tags.some((tag) => tag.toLowerCase() === activeCategory.toLowerCase());

      const searchableText = [
        recipe.title,
        recipe.description ?? "",
        recipe.difficulty,
        ...tags,
        ...ingredients.map(getIngredientLabel),
        ...steps.map((step) => step.instruction ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || searchableText.includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, deferredSearchQuery, recipes]);

  const heroRecipe = filteredRecipes[0] ?? recipes[0] ?? null;
  const quickPicks = filteredRecipes.slice(0, 3);

  const averageTimeLabel = useMemo(() => {
    const timedRecipes = filteredRecipes.filter((recipe) => Number(recipe.total_time_minutes || 0) > 0);

    if (timedRecipes.length === 0) return "—";

    const average = Math.round(
      timedRecipes.reduce((sum, recipe) => sum + Number(recipe.total_time_minutes || 0), 0) / timedRecipes.length
    );

    return formatMinutes(average);
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
        <Ionicons name="restaurant-outline" size={28} color={colors.text.tertiary} />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadRecipes({ refreshing: true })} />
        }
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
            <ThemedText style={styles.addButtonText}>Create</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText style={[styles.eyebrow, { color: theme.brand.tertiary }]}>Recipe library</ThemedText>
          <ThemedText style={[styles.heroTitle, { color: colors.text.primary }]}>
            Find something good to cook.
          </ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            Browse community recipes by tag, meal, ingredient, or step.
          </ThemedText>
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

        {categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {categories.map((category) => {
              const isActive = category === activeCategory;

              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? theme.brand.primary : colors.background,
                      borderColor: isActive ? theme.brand.primary : colors.border.default,
                    },
                  ]}
                  onPress={() => setActiveCategory(category)}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    style={[styles.filterChipText, { color: isActive ? theme.neutral.white : colors.text.secondary }]}
                  >
                    {category}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

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
            title="No recipes yet"
            body="Create the first community recipe and it will show up here."
            actionLabel="Create recipe"
            onAction={() => router.push("/recipe/new")}
          />
        ) : filteredRecipes.length === 0 ? (
          <StateCard
            colors={colors}
            icon="search-outline"
            title="No recipes found"
            body="Try another search or switch back to All."
          />
        ) : (
          <>
            {heroRecipe && (
              <View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border.light }]}>
                {renderRecipeImage(heroRecipe, styles.featuredImage)}
                <View style={styles.featuredOverlay} />

                <View style={styles.featuredContent}>
                  <View style={styles.featuredMetaRow}>
                    <View style={styles.metaPill}>
                      <Ionicons name="sparkles-outline" size={14} color={theme.brand.tertiary} />
                      <ThemedText style={styles.metaPillText}>Newest match</ThemedText>
                    </View>

                    <View style={styles.timePill}>
                      <Ionicons name="time-outline" size={13} color={theme.brand.primary} />
                      <ThemedText style={styles.timePillText}>
                        {formatMinutes(heroRecipe.total_time_minutes)}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={styles.featuredTitle}>{heroRecipe.title}</ThemedText>

                  <ThemedText style={styles.featuredDescription} numberOfLines={3}>
                    {heroRecipe.description || "No description added yet."}
                  </ThemedText>

                  {getMealTags(heroRecipe).length > 0 && (
                    <View style={styles.featuredMealRow}>
                      <ThemedText style={styles.featuredMealLabel}>Meal of the day</ThemedText>

                      <View style={styles.featuredTagRow}>
                        {getMealTags(heroRecipe).map((tag) => (
                          <View key={tag} style={styles.featuredMealPill}>
                            <Ionicons name="restaurant-outline" size={12} color={theme.neutral.white} />
                            <ThemedText style={styles.featuredTagText}>{tag}</ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {getOtherTags(heroRecipe).length > 0 && (
                    <View style={styles.featuredTagRow}>
                      {getOtherTags(heroRecipe).slice(0, 4).map((tag) => (
                        <View key={tag} style={styles.featuredTagPill}>
                          <ThemedText style={styles.featuredTagText}>#{tag}</ThemedText>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.featuredFooter}>
                    <View>
                      <ThemedText style={styles.featuredFooterLabel}>Recipe info</ThemedText>
                      <ThemedText style={styles.featuredFooterValue}>
                        {heroRecipe.difficulty} •{" "}
                        {heroRecipe.servings ? `${heroRecipe.servings} servings` : "Servings not set"}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      style={styles.featuredAction}
                      onPress={() => router.push(`/recipe/${heroRecipe.id}`)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={styles.featuredActionText}>Open recipe</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
                <ThemedText style={[styles.statValue, { color: colors.text.primary }]}>
                  {filteredRecipes.length}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>recipes showing</ThemedText>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}>
                <ThemedText style={[styles.statValue, { color: colors.text.primary }]}>
                  {averageTimeLabel}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>average total time</ThemedText>
              </View>
            </View>

            {quickPicks.length > 0 && (
              <>
                <SectionTitle colors={colors} title="Quick picks" subtitle="The most recent matching recipes." />

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPicksRow}>
                  {quickPicks.map((recipe) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[
                        styles.quickPickCard,
                        { backgroundColor: colors.background, borderColor: colors.border.light },
                      ]}
                      activeOpacity={0.86}
                      onPress={() => router.push(`/recipe/${recipe.id}`)}
                    >
                      {renderRecipeImage(recipe, styles.quickPickImage)}

                      <View style={styles.quickPickBody}>
                        <ThemedText style={[styles.quickPickCategory, { color: theme.brand.primary }]} numberOfLines={1}>
                          {getCategory(recipe)}
                        </ThemedText>

                        <ThemedText style={[styles.quickPickTitle, { color: colors.text.primary }]} numberOfLines={2}>
                          {recipe.title}
                        </ThemedText>

                        <ThemedText style={[styles.quickPickMeta, { color: colors.text.secondary }]}>
                          {formatMinutes(recipe.total_time_minutes)} • {recipe.difficulty}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <SectionTitle
              colors={colors}
              title="Browse all recipes"
              subtitle={`Filtered for ${activeCategory.toLowerCase()} and your current search.`}
            />

            <View style={styles.recipeGrid}>
              {filteredRecipes.map((recipe) => {
                const tags = getTags(recipe);

                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.recipeTile, { backgroundColor: colors.background, borderColor: colors.border.light }]}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  >
                    {renderRecipeImage(recipe, styles.recipeTileImage)}

                    <View style={styles.recipeTileBody}>
                      <View style={styles.recipeTileTopRow}>
                        <ThemedText
                          style={[styles.recipeTileCategory, { color: theme.brand.tertiary }]}
                          numberOfLines={1}
                        >
                          {getCategory(recipe)}
                        </ThemedText>

                        <View style={styles.recipeTileDatePill}>
                          <Ionicons name="calendar-outline" size={12} color={colors.text.secondary} />
                          <ThemedText style={[styles.recipeTileDateText, { color: colors.text.secondary }]}>
                            {formatDate(recipe.created_at)}
                          </ThemedText>
                        </View>
                      </View>

                      <ThemedText style={[styles.recipeTileTitle, { color: colors.text.primary }]}>
                        {recipe.title}
                      </ThemedText>

                      <ThemedText style={[styles.recipeTileDescription, { color: colors.text.secondary }]} numberOfLines={2}>
                        {recipe.description || "No description added."}
                      </ThemedText>

                      {tags.length > 0 && (
                        <View style={styles.tagRow}>
                          {tags.slice(0, 6).map((tag) => (
                            <View
                              key={`${recipe.id}-${tag}`}
                              style={[styles.tagPill, { backgroundColor: colors.input.background }]}
                            >
                              <ThemedText style={[styles.tagText, { color: colors.text.secondary }]}>#{tag}</ThemedText>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={styles.recipeTileFooter}>
                        <MetaItem icon="time-outline" label={formatMinutes(recipe.total_time_minutes)} colors={colors} />
                        <MetaItem icon="flame-outline" label={recipe.difficulty} colors={colors} />
                        <MetaItem icon="people-outline" label={recipe.servings ? String(recipe.servings) : "—"} colors={colors} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({
  colors,
  title,
  subtitle,
}: {
  colors: any;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>{title}</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>{subtitle}</ThemedText>
      </View>
    </View>
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
      <ThemedText style={[styles.metaItemText, { color: colors.text.secondary }]}>{label}</ThemedText>
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
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  featuredCard: {
    minHeight: 380,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  featuredImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 28, 0.42)",
  },
  featuredContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  featuredMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "#F4EEC7",
  },
  metaPillText: {
    color: theme.brand.tertiary,
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(17, 24, 28, 0.52)",
  },
  timePillText: {
    color: theme.neutral.white,
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  featuredTitle: {
    color: theme.neutral.white,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  featuredDescription: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
    maxWidth: "88%",
  },
  featuredMealRow: {
    gap: 8,
  },
  featuredMealLabel: {
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  featuredTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featuredMealPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.brand.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featuredTagPill: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featuredTagText: {
    color: theme.neutral.white,
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  featuredFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: theme.spacing.md,
  },
  featuredFooterLabel: {
    color: "rgba(255, 255, 255, 0.74)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  featuredFooterValue: {
    color: theme.neutral.white,
    fontSize: 14,
    marginTop: 4,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  featuredAction: {
    backgroundColor: theme.brand.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  featuredActionText: {
    color: theme.neutral.white,
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.typography.fontFamily,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
  },
  quickPicksRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  quickPickCard: {
    width: 220,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  quickPickImage: {
    width: "100%",
    height: 150,
  },
  quickPickBody: {
    padding: theme.spacing.md,
    gap: 6,
  },
  quickPickCategory: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  quickPickTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  quickPickMeta: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
  },
  recipeGrid: {
    gap: theme.spacing.md,
  },
  recipeTile: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  recipeTileImage: {
    width: "100%",
    height: 180,
  },
  recipeTileBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  recipeTileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  recipeTileCategory: {
    flex: 1,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTileDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recipeTileDateText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTileTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTileDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTileFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaItemText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeights.semibold,
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