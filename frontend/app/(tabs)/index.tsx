import { ScrollView, StyleSheet, TouchableOpacity, TextInput, View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { theme } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import FarmCard from '@/components/ui/farmcard';
import { RecipeCard } from '@/components/ui/recipes/recipecard';
import { GroceryListCard } from '@/components/ui/grocerylist/GroceryListCard';

import { useCurrentLocation } from '@/hooks/useCurrentLocation';
import { addDistanceAndSort } from '@/lib/location';
import { useAuth } from '@/context/auth-context';
import { useFarms } from '@/hooks/useFarms';
import { openDirections } from '@/lib/directions';
import { formatAddress } from '@/lib/address';
import { shareFarm } from '@/lib/share-farm';
import { supabase } from '@/lib/supabase';
import { useMyProfile } from '@/hooks/useMyProfile';
import { getProfileDisplay } from '@/lib/profile-display';
import { getLocalGroceryLists } from '@/lib/local-grocery-lists';

const RECIPE_BUCKET = 'recipes';
const FALLBACK_RECIPE_IMAGE =
  'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop';

const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner'];

type ProduceItem = {
  id: string;
  name: string;
  category: string;
  default_sold_by: string;
};

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
  type?: string;
  position?: number;
};

type StoredRecipe = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty?: string | null;
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
  created_at: string;
  updated_at: string;
};

type RecipeRatingRow = {
  recipe_id: string;
  user_id: string;
  rating: number;
};

type RecipeRatingSummary = {
  averageRating: number | null;
  ratingCount: number;
  currentUserRating: number | null;
};

type HomeRecipeCardData = {
  id: string;
  title: string;
  rating: number | null;
  ratingsCount: number;
  currentUserRating: number | null;
  duration: string;
  difficulty?: string;
  imageUrl?: string;
};

type HomeGroceryList = {
  id: string;
  title: string;
  date: string;
  isPinned: boolean;
  itemCount: number;
  checkedCount: number;
  items: any[];
  updatedAt: number;
};

type DBGroceryList = {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
  is_pinned?: boolean | null;
};

type DBGroceryListItem = {
  id: string;
  list_id: string;
  name: string;
  is_checked: boolean;
};

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const sortByPosition = <T extends { position?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

const getTags = (recipe: StoredRecipe) => asArray(recipe.tags).filter(Boolean);

const getIngredientNames = (recipe: StoredRecipe) => {
  return sortByPosition(asArray(recipe.ingredients))
    .map((ingredient) => ingredient.name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
};

const getStepInstructions = (recipe: StoredRecipe) => {
  return sortByPosition(asArray(recipe.steps))
    .map((step) => step.instruction?.trim())
    .filter((instruction): instruction is string => Boolean(instruction && instruction.length > 0));
};

const formatRecipeDuration = (totalMinutes: number | null | undefined) => {
  const safeMinutes = Number(totalMinutes || 0);
  if (safeMinutes <= 0) return 'No time set';

  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
};

const getRecipeCategory = (recipe: StoredRecipe) => {
  const tags = getTags(recipe);
  const mealTag = tags.find((tag) =>
    MEAL_TAGS.some((meal) => meal.toLowerCase() === tag.toLowerCase())
  );

  return mealTag ?? tags[0] ?? 'Recipe';
};

const getFirstCoverUrl = (recipe: StoredRecipe) => {
  if (recipe.cover_image_url?.trim()) return recipe.cover_image_url.trim();

  const media = sortByPosition(asArray(recipe.cover_media));
  const firstMediaWithUrl = media.find((item) => typeof item?.url === 'string' && item.url.trim().length > 0);

  return firstMediaWithUrl?.url?.trim() ?? null;
};

const formatGroceryListDate = (value?: string | null) => {
  if (!value) return 'Today';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

async function resolveRecipeImageUrl(recipe: StoredRecipe) {
  const media = sortByPosition(asArray(recipe.cover_media));
  const fallbackPath =
    recipe.cover_image_path ||
    media.find((item) => typeof item?.path === 'string' && item.path.trim().length > 0)?.path;

  if (fallbackPath) {
    const { data, error } = await supabase.storage
      .from(RECIPE_BUCKET)
      .createSignedUrl(fallbackPath, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    if (error) {
      console.warn('Could not create signed recipe image URL:', fallbackPath, error.message);
    }
  }

  const directUrl = getFirstCoverUrl(recipe);
  if (directUrl) return directUrl;

  const firstStepPhotoUrl = sortByPosition(asArray(recipe.steps))
    .flatMap((step) => asArray(step.photo_urls))
    .find((url) => typeof url === 'string' && url.trim().length > 0);

  return firstStepPhotoUrl ?? FALLBACK_RECIPE_IMAGE;
}

async function getRecipeRatingSummaries(
  recipeIds: string[],
  currentUserId: string | null
): Promise<Record<string, RecipeRatingSummary>> {
  if (recipeIds.length === 0) return {};

  const { data, error } = await supabase
    .from('recipe_ratings')
    .select('recipe_id, user_id, rating')
    .in('recipe_id', recipeIds);

  if (error) throw error;

  const ratings = (data ?? []) as RecipeRatingRow[];

  return recipeIds.reduce<Record<string, RecipeRatingSummary>>((summaries, recipeId) => {
    const recipeRatings = ratings.filter((item) => item.recipe_id === recipeId);
    const total = recipeRatings.reduce((sum, item) => sum + Number(item.rating || 0), 0);

    summaries[recipeId] = {
      averageRating: recipeRatings.length > 0 ? total / recipeRatings.length : null,
      ratingCount: recipeRatings.length,
      currentUserRating: currentUserId
        ? recipeRatings.find((item) => item.user_id === currentUserId)?.rating ?? null
        : null,
    };

    return summaries;
  }, {});
}

async function loadHomeGroceryLists(userId: string | null): Promise<HomeGroceryList[]> {
  const localLists = await getLocalGroceryLists();

  if (!userId) {
    return localLists.map((list) => ({
      id: list.id,
      title: list.title,
      date: list.date ?? 'Today',
      isPinned: Boolean(list.isPinned),
      itemCount: list.itemCount ?? list.items.length,
      checkedCount: list.checkedCount ?? list.items.filter((item) => item.checked).length,
      items: list.items ?? [],
      updatedAt: list.updatedAt ?? 0,
    }));
  }

  const { data: dbLists, error: listsError } = await supabase
    .from('grocery_lists')
    .select('id, title, created_at, user_id, is_pinned')
    .order('created_at', { ascending: false });

  if (listsError) throw listsError;

  const typedDbLists = (dbLists ?? []) as DBGroceryList[];
  const dbListIds = typedDbLists.map((list) => list.id);

  let itemMap: Record<string, DBGroceryListItem[]> = {};

  if (dbListIds.length > 0) {
    const { data: dbItems, error: itemsError } = await supabase
      .from('grocery_list_items')
      .select('id, list_id, name, is_checked')
      .in('list_id', dbListIds);

    if (itemsError) throw itemsError;

    itemMap = ((dbItems ?? []) as DBGroceryListItem[]).reduce<Record<string, DBGroceryListItem[]>>(
      (acc, item) => {
        if (!acc[item.list_id]) acc[item.list_id] = [];
        acc[item.list_id].push(item);
        return acc;
      },
      {}
    );
  }

  const remoteLists: HomeGroceryList[] = typedDbLists.map((list) => {
    const items = itemMap[list.id] ?? [];
    const createdAtMs = list.created_at ? new Date(list.created_at).getTime() : 0;

    return {
      id: list.id,
      title: list.title,
      date: formatGroceryListDate(list.created_at),
      isPinned: Boolean(list.is_pinned),
      itemCount: items.length,
      checkedCount: items.filter((item) => item.is_checked).length,
      items,
      updatedAt: createdAtMs,
    };
  });

  const normalizedLocalLists: HomeGroceryList[] = localLists.map((list) => ({
    id: list.id,
    title: list.title,
    date: list.date ?? 'Today',
    isPinned: Boolean(list.isPinned),
    itemCount: list.itemCount ?? list.items.length,
    checkedCount: list.checkedCount ?? list.items.filter((item) => item.checked).length,
    items: list.items ?? [],
    updatedAt: list.updatedAt ?? 0,
  }));

  return [...remoteLists, ...normalizedLocalLists].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { data: profile } = useMyProfile();
  const [searchQuery, setSearchQuery] = useState('');

  const { coords: userCoords, locationText } = useCurrentLocation();
  const { data: farms = [], isLoading: farmsLoading, error: farmsError } = useFarms();

  const [currentProduce, setCurrentProduce] = useState<ProduceItem[]>([]);
  const [produceLoading, setProduceLoading] = useState(false);
  const [produceError, setProduceError] = useState<string | null>(null);

  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState<string | null>(null);
  const [homeRecipes, setHomeRecipes] = useState<HomeRecipeCardData[]>([]);
  const [recipeSearchIndex, setRecipeSearchIndex] = useState<Record<string, string>>({});

  const [groceryListsLoading, setGroceryListsLoading] = useState(false);
  const [groceryListsError, setGroceryListsError] = useState<string | null>(null);
  const [homeGroceryLists, setHomeGroceryLists] = useState<HomeGroceryList[]>([]);

  const metadata = session?.user?.user_metadata as
    | { name?: string; full_name?: string; username?: string }
    | undefined;

  const { avatarUrl, displayName, initials } = getProfileDisplay(
    profile,
    metadata,
    session?.user?.email
  );

  const farmsWithDistance = addDistanceAndSort(farms, userCoords);

  const mostRecentGroceryList = useMemo(() => {
    return homeGroceryLists[0] ?? null;
  }, [homeGroceryLists]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrentProduce = async () => {
      setProduceLoading(true);
      setProduceError(null);

      const month = new Date().getMonth() + 1;

      const { data, error } = await supabase
        .from('produce_item_season_months')
        .select(
          `
          produce_items!inner (
            id,
            name,
            category,
            default_sold_by,
            is_available
          )
        `
        )
        .eq('month', month)
        .eq('produce_items.is_available', true);

      if (cancelled) return;

      if (error) {
        console.log('Produce load error:', error);
        setProduceError('Could not load produce.');
        setCurrentProduce([]);
        setProduceLoading(false);
        return;
      }

      const items =
        (data ?? [])
          .map((row: any) => row.produce_items)
          .filter(Boolean)
          .sort((a: ProduceItem, b: ProduceItem) => a.name.localeCompare(b.name)) ?? [];

      setCurrentProduce(items);
      setProduceLoading(false);
    };

    loadCurrentProduce();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadHomeRecipes = useCallback(async () => {
    try {
      setRecipesLoading(true);
      setRecipesError(null);

      const { data, error } = await supabase
        .from('recipes')
        .select(
          'id, user_id, title, description, difficulty, cover_image_url, cover_image_path, cover_media, prep_time_minutes, cook_time_minutes, additional_time_minutes, total_time_minutes, servings, ingredients, steps, tags, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      const rows = (data ?? []) as StoredRecipe[];
      const recipeIds = rows.map((recipe) => recipe.id);
      const currentUserId = session?.user?.id ?? null;

      const ratingSummaries = await getRecipeRatingSummaries(recipeIds, currentUserId);

      const hydratedRecipes = await Promise.all(
        rows.map(async (recipe) => {
          const summary = ratingSummaries[recipe.id];

          return {
            id: recipe.id,
            title: recipe.title,
            rating: summary?.averageRating ?? null,
            ratingsCount: summary?.ratingCount ?? 0,
            currentUserRating: summary?.currentUserRating ?? null,
            duration: formatRecipeDuration(recipe.total_time_minutes),
            difficulty: recipe.difficulty?.trim() || undefined,
            imageUrl: await resolveRecipeImageUrl(recipe),
          };
        })
      );

      const nextSearchIndex = rows.reduce<Record<string, string>>((index, recipe) => {
        index[recipe.id] = [
          recipe.title,
          recipe.description ?? '',
          recipe.difficulty ?? '',
          getRecipeCategory(recipe),
          ...getTags(recipe),
          ...getIngredientNames(recipe),
          ...getStepInstructions(recipe),
        ]
          .join(' ')
          .toLowerCase();

        return index;
      }, {});

      setHomeRecipes(hydratedRecipes);
      setRecipeSearchIndex(nextSearchIndex);
    } catch (error: any) {
      console.error('Home recipes load failed:', error);
      setRecipesError(error?.message ?? 'Could not load recipes.');
      setHomeRecipes([]);
      setRecipeSearchIndex({});
    } finally {
      setRecipesLoading(false);
    }
  }, [session?.user?.id]);

  const loadGroceryLists = useCallback(async () => {
    try {
      setGroceryListsLoading(true);
      setGroceryListsError(null);

      const lists = await loadHomeGroceryLists(session?.user?.id ?? null);
      setHomeGroceryLists(lists);
    } catch (error: any) {
      console.error('Home grocery lists load failed:', error);
      setGroceryListsError(error?.message ?? 'Could not load grocery lists.');
      setHomeGroceryLists([]);
    } finally {
      setGroceryListsLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadHomeRecipes();
      loadGroceryLists();
    }, [loadHomeRecipes, loadGroceryLists])
  );

  const filteredProduce = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentProduce;

    return currentProduce.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [currentProduce, searchQuery]);

  const filteredHomeRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return homeRecipes;

    return homeRecipes.filter((recipe) => recipeSearchIndex[recipe.id]?.includes(q));
  }, [homeRecipes, recipeSearchIndex, searchQuery]);

  const handleFarmPress = (farmId: string) => {
    router.push(`/farm/${farmId}`);
  };

  const handleDirectionPress = async (farmId: string) => {
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;

    const hasRealAddress =
      !!farm.street?.trim() && (!!farm.city?.trim() || !!farm.postal_code?.trim());

    const finalDest = hasRealAddress ? formatAddress(farm) : `${farm.latitude},${farm.longitude}`;

    try {
      await openDirections(finalDest);
    } catch (e) {
      console.log('Could not open directions', e);
    }
  };

  const handleSharePress = async (farmId: string) => {
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) return;

    try {
      await shareFarm(farm);
    } catch (e) {
      console.log('Could not share farm', e);
    }
  };

  const handleRecipePress = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  const handleProducePress = (produceId: string) => {
    router.push(`/produce/${produceId}`);
  };

  const handleGroceryListPress = (groceryListId: string) => {
    router.push(`/grocery-list/${groceryListId}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView style={styles.container}>
        <ThemedView style={styles.header}>
          <TouchableOpacity
            style={[styles.avatar, { backgroundColor: theme.brand.primary }]}
            onPress={() => router.push('/settings')}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <ThemedText style={styles.aiText}>{initials}</ThemedText>
            )}
          </TouchableOpacity>

          <ThemedText type="defaultSemiBold" style={[styles.welcome, { color: colors.text.primary }]}>
            {`Welcome ${displayName}!`}
          </ThemedText>
        </ThemedView>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.input.background,
              borderColor: colors.border.light,
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons name="search" size={30} color={colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.input.text }]}
            placeholder="Search produce, farms, recipes..."
            placeholderTextColor={colors.input.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ThemedView style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Your Grocery List</ThemedText>

          {groceryListsLoading ? (
            <ThemedText style={{ color: colors.text.tertiary }}>Loading grocery list…</ThemedText>
          ) : groceryListsError ? (
            <ThemedText style={{ color: colors.text.tertiary }}>{groceryListsError}</ThemedText>
          ) : mostRecentGroceryList ? (
            <TouchableOpacity activeOpacity={0.85} onPress={() => handleGroceryListPress(mostRecentGroceryList.id)}>
              <GroceryListCard list={mostRecentGroceryList} style={styles.homeGroceryCard} />
            </TouchableOpacity>
          ) : (
            <ThemedText style={{ color: colors.text.tertiary }}>No grocery lists yet.</ThemedText>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>In Season Now</ThemedText>

          {produceLoading ? (
            <ThemedText style={{ color: colors.text.tertiary }}>Loading produce…</ThemedText>
          ) : produceError ? (
            <ThemedText style={{ color: colors.text.tertiary }}>{produceError}</ThemedText>
          ) : filteredProduce.length === 0 ? (
            <ThemedText style={{ color: colors.text.tertiary }}>No seasonal produce found.</ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.produceScroll}>
              {filteredProduce.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.produceChip,
                    {
                      backgroundColor: colors.input.background,
                      borderColor: colors.border.light,
                    },
                  ]}
                  onPress={() => handleProducePress(item.id)}
                >
                  <ThemedText style={[styles.produceName, { color: colors.text.primary }]}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={[styles.produceMeta, { color: colors.text.tertiary }]}>
                    {item.category} • {item.default_sold_by}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Close Farms Near You</ThemedText>

          <ThemedText style={{ color: colors.text.tertiary, marginTop: 2, marginBottom: 2 }}>
            📍 {locationText}
          </ThemedText>

          {farmsLoading ? (
            <ThemedText style={{ color: colors.text.tertiary }}>Loading farms…</ThemedText>
          ) : farmsError ? (
            <ThemedText style={{ color: colors.text.tertiary }}>Could not load farms.</ThemedText>
          ) : farmsWithDistance.length === 0 ? (
            <ThemedText style={{ color: colors.text.tertiary }}>No farms available yet.</ThemedText>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.farmsScroll}
              contentContainerStyle={styles.farmsScrollContent}
            >
              {farmsWithDistance.map((farm) => (
                <View key={farm.id} style={{ width: 300 }}>
                  <FarmCard
                    name={farm.name}
                    rating={farm.rating}
                    reviews={farm.reviews}
                    distance={farm.distanceMi != null ? `${farm.distanceMi.toFixed(1)} mi` : '…'}
                    products={farm.products}
                    onPress={() => handleFarmPress(farm.id)}
                    onDirectionPress={() => handleDirectionPress(farm.id)}
                    onSharePress={() => handleSharePress(farm.id)}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </ThemedView>

        <ThemedView style={[styles.section, { marginBottom: 80 }]}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Top Recipes of the Week</ThemedText>
            <TouchableOpacity onPress={() => router.push('/recipe/recipes')} activeOpacity={0.7}>
              <ThemedText style={[styles.sectionLink, { color: theme.brand.primary }]}>Browse All</ThemedText>
            </TouchableOpacity>
          </View>

          {recipesLoading ? (
            <ThemedText style={{ color: colors.text.tertiary, marginTop: theme.spacing.sm }}>Loading recipes…</ThemedText>
          ) : recipesError ? (
            <ThemedText style={{ color: colors.text.tertiary, marginTop: theme.spacing.sm }}>{recipesError}</ThemedText>
          ) : filteredHomeRecipes.length === 0 ? (
            <ThemedText style={{ color: colors.text.tertiary, marginTop: theme.spacing.sm }}>No recipes found.</ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipesScroll}>
              {filteredHomeRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  rating={recipe.rating}
                  ratingsCount={recipe.ratingsCount}
                  currentUserRating={recipe.currentUserRating}
                  duration={recipe.duration}
                  difficulty={recipe.difficulty}
                  imageUrl={recipe.imageUrl}
                  onPress={() => handleRecipePress(recipe.id)}
                />
              ))}
            </ScrollView>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  welcome: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  aiText: {
    color: theme.neutral.white,
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.h3,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  produceScroll: {
    marginTop: theme.spacing.md,
    marginLeft: -theme.spacing.md,
    paddingLeft: theme.spacing.md,
  },
  produceChip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    minWidth: 150,
  },
  produceName: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  produceMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
  },
  farmsScroll: {
    marginTop: theme.spacing.sm,
    marginLeft: -theme.spacing.md,
    paddingLeft: theme.spacing.md,
  },
  farmsScrollContent: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.md,
    paddingVertical: 6,
  },
  homeGroceryCard: {
    marginBottom: 0,
  },
  recipesScroll: {
    marginTop: theme.spacing.md,
    marginLeft: -theme.spacing.md,
    paddingLeft: theme.spacing.md,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});