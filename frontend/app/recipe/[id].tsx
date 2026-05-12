import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { theme } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const RECIPE_BUCKET = 'recipes';
const FALLBACK_RECIPE_IMAGE =
  'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1200&auto=format&fit=crop';

type RecipeMediaItem = {
  path?: string;
  url?: string;
  type?: string;
  position?: number;
};

type IngredientItem = {
  id?: string;
  position?: number;
  quantity?: string;
  unit?: string;
  name?: string;
};

type StepItem = {
  id?: string;
  position?: number;
  instruction?: string;
  photo_paths?: string[];
  photo_urls?: string[];
};

type RecipeRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty?: string | null;
  tags: string[] | null;
  cover_image_url: string | null;
  cover_image_path: string | null;
  cover_media: RecipeMediaItem[] | null;
  prep_time_minutes: number;
  cook_time_minutes: number;
  additional_time_minutes: number;
  total_time_minutes: number;
  servings: number | null;
  ingredients: IngredientItem[] | null;
  steps: StepItem[] | null;
  created_at: string;
  updated_at: string;
};

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const sortByPosition = <T extends { position?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

function formatIngredientLine(item: IngredientItem) {
  return [item.quantity, item.unit, item.name].filter(Boolean).join(' ').trim();
}

function getIngredientNames(ingredients: IngredientItem[]) {
  return ingredients
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
}

function formatMinutes(minutes: number | null | undefined) {
  const safeMinutes = Number(minutes || 0);
  if (safeMinutes <= 0) return '—';

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours <= 0) return `${mins} min`;
  if (mins <= 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

async function resolveStorageUrl(path?: string | null, fallbackUrl?: string | null) {
  const cleanPath = path?.trim();
  const cleanFallbackUrl = fallbackUrl?.trim() || null;

  if (cleanPath) {
    const { data, error } = await supabase.storage
      .from(RECIPE_BUCKET)
      .createSignedUrl(cleanPath, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return cleanFallbackUrl;
}

async function resolveRecipeImageUrl(recipe: RecipeRow) {
  const media = sortByPosition(asArray(recipe.cover_media));
  const firstMedia = media.find((item) => item.path || item.url);

  const resolvedCover = await resolveStorageUrl(
    recipe.cover_image_path || firstMedia?.path || null,
    recipe.cover_image_url || firstMedia?.url || null
  );

  if (resolvedCover) return resolvedCover;

  const firstStepPhoto = sortByPosition(asArray(recipe.steps)).find(
    (step) => asArray(step.photo_paths).length > 0 || asArray(step.photo_urls).length > 0
  );

  const resolvedStepPhoto = await resolveStorageUrl(
    firstStepPhoto?.photo_paths?.[0] ?? null,
    firstStepPhoto?.photo_urls?.[0] ?? null
  );

  return resolvedStepPhoto || FALLBACK_RECIPE_IMAGE;
}

async function hydrateRecipeMedia(recipe: RecipeRow): Promise<RecipeRow> {
  const coverMedia = await Promise.all(
    sortByPosition(asArray(recipe.cover_media)).map(async (item) => ({
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

  const coverImageUrl = await resolveStorageUrl(recipe.cover_image_path, recipe.cover_image_url);

  return {
    ...recipe,
    cover_image_url: coverImageUrl ?? recipe.cover_image_url,
    cover_media: coverMedia,
    steps,
  };
}

export default function RecipeDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<RecipeRow | null>(null);
  const [imageUrl, setImageUrl] = useState<string>(FALLBACK_RECIPE_IMAGE);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id || typeof id !== 'string') {
        setRecipe(null);
        setLoading(false);
        return;
      }

      let isActive = true;
      setLoading(true);

      (async () => {
        try {
          const { data, error } = await supabase
            .from('recipes')
            .select(
              'id, user_id, title, description, difficulty, tags, cover_image_url, cover_image_path, cover_media, prep_time_minutes, cook_time_minutes, additional_time_minutes, total_time_minutes, servings, ingredients, steps, created_at, updated_at'
            )
            .eq('id', id)
            .single();

          if (error) throw error;
          if (!isActive) return;

          const hydratedRecipe = await hydrateRecipeMedia(data as RecipeRow);
          if (!isActive) return;

          setRecipe(hydratedRecipe);

          const resolvedImageUrl = await resolveRecipeImageUrl(hydratedRecipe);
          if (!isActive) return;

          setImageUrl(resolvedImageUrl);
        } catch (e) {
          if (!isActive) return;
          console.error('Recipe detail load failed:', e);

          const message = e instanceof Error ? e.message : 'Unable to load recipe';
          Alert.alert('Error', message);
          setRecipe(null);
        } finally {
          if (!isActive) return;
          setLoading(false);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [id])
  );

  const tags = useMemo(() => asArray(recipe?.tags).filter(Boolean), [recipe]);

  const ingredients = useMemo(() => {
    if (!recipe) return [];
    return sortByPosition(asArray(recipe.ingredients));
  }, [recipe]);

  const steps = useMemo(() => {
    if (!recipe) return [];
    return sortByPosition(asArray(recipe.steps));
  }, [recipe]);

  const galleryMedia = useMemo(() => {
    if (!recipe) return [];

    const mediaUrls = sortByPosition(asArray(recipe.cover_media))
      .map((item) => item.url?.trim())
      .filter((url): url is string => Boolean(url));

    return Array.from(new Set(mediaUrls));
  }, [recipe]);

  const ingredientNames = useMemo(() => getIngredientNames(ingredients), [ingredients]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.missingState}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border.light, backgroundColor: colors.background }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={[styles.missingTitle, { color: colors.text.primary }]}>Recipe not found</ThemedText>
          <ThemedText style={[styles.missingBody, { color: colors.text.secondary }]}>This recipe could not be loaded.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const descriptionLength = recipe.description?.length ?? 0;
  const descriptionOffset = descriptionLength > 120 ? Math.min((descriptionLength - 120) / 8, 24) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
            onError={(event) => console.warn('Hero image failed to load:', imageUrl, event.nativeEvent.error)}
          />
          <View style={styles.heroOverlay} />

          <View style={[styles.heroTopRow, { paddingTop: insets.top + theme.spacing.sm }]}> 
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: 'rgba(17, 24, 28, 0.45)' }]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color={theme.neutral.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.brand.primary }]}
              onPress={() => router.push('/recipe/new')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color={theme.neutral.white} />
            </TouchableOpacity>
          </View>

          <View style={[styles.heroContent, { paddingTop: insets.top + 72 }]}> 
            <View style={styles.tagRow}>
              <View style={styles.heroTag}>
                <ThemedText style={styles.heroTagText}>{recipe.difficulty?.trim() || 'Recipe'}</ThemedText>
              </View>
              {recipe.servings ? (
                <View style={[styles.heroTag, styles.heroTagAlt]}>
                  <ThemedText style={styles.heroTagText}>{recipe.servings} servings</ThemedText>
                </View>
              ) : null}
            </View>

            <ThemedText style={styles.heroTitle}>{recipe.title}</ThemedText>
            <ThemedText style={styles.heroDescription}>
              {recipe.description?.trim() || 'A homemade recipe from your collection.'}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.metaRow, { marginTop: -theme.spacing['3xl'] + descriptionOffset }]}> 
          <InfoCard
            colors={colors}
            icon="time-outline"
            value={formatMinutes(recipe.total_time_minutes)}
            label="Total time"
            iconColor={theme.brand.primary}
          />
          <InfoCard
            colors={colors}
            icon="restaurant-outline"
            value={String(ingredients.length)}
            label="Ingredients"
            iconColor={theme.brand.red}
          />
        </View>

        <View style={styles.timeMetaRow}>
          <InfoCard
            colors={colors}
            icon="hourglass-outline"
            value={formatMinutes(recipe.prep_time_minutes)}
            label="Prep"
            iconColor={theme.brand.primary}
            compact
          />
          <InfoCard
            colors={colors}
            icon="flame-outline"
            value={formatMinutes(recipe.cook_time_minutes)}
            label="Cook"
            iconColor={theme.brand.red}
            compact
          />
          <InfoCard
            colors={colors}
            icon="add-circle-outline"
            value={formatMinutes(recipe.additional_time_minutes)}
            label="Extra"
            iconColor={theme.brand.tertiary}
            compact
          />
        </View>

        <View style={styles.updatedMetaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.text.tertiary} />
          <ThemedText style={[styles.updatedMetaText, { color: colors.text.tertiary }]}>Updated {formatDate(recipe.updated_at)}</ThemedText>
        </View>

        {(tags.length > 0 || galleryMedia.length > 1) && (
          <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}> 
            <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Recipe details</ThemedText>

            {tags.length > 0 && (
              <View style={styles.overviewBlock}>
                <ThemedText style={[styles.overviewLabel, { color: colors.text.tertiary }]}>Tags</ThemedText>
                <View style={styles.chipRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={[styles.tagChip, { backgroundColor: colors.input.background, borderColor: colors.border.light }]}> 
                      <ThemedText style={[styles.tagChipText, { color: colors.text.secondary }]}>#{tag}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {galleryMedia.length > 1 && (
              <View style={styles.overviewBlock}>
                <ThemedText style={[styles.overviewLabel, { color: colors.text.tertiary }]}>Photos</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                  {galleryMedia.map((url, index) => (
                    <Image
                      key={`${recipe.id}-gallery-${index}`}
                      source={{ uri: url }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                      onError={(event) => console.warn('Gallery image failed to load:', url, event.nativeEvent.error)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}> 
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Ingredients</ThemedText>
          <View style={styles.ingredientList}>
            {ingredients.length === 0 ? (
              <ThemedText style={[styles.stepText, { color: colors.text.secondary }]}>No ingredients added yet.</ThemedText>
            ) : (
              ingredients.map((ingredient, index) => (
                <View key={ingredient.id ?? `${recipe.id}-ingredient-${index}`} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <View style={styles.ingredientCopy}>
                    <ThemedText style={[styles.ingredientAmount, { color: theme.brand.tertiary }]}> 
                      {ingredient.quantity || ingredient.unit
                        ? [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')
                        : '—'}
                    </ThemedText>
                    <ThemedText style={[styles.ingredientName, { color: colors.text.primary }]}> 
                      {ingredient.name || formatIngredientLine(ingredient) || 'Untitled ingredient'}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border.light }]}> 
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Directions</ThemedText>
          <View style={styles.stepsList}>
            {steps.length === 0 ? (
              <ThemedText style={[styles.stepText, { color: colors.text.secondary }]}>No steps added yet.</ThemedText>
            ) : (
              steps.map((step, index) => {
                const stepPhotos = asArray(step.photo_urls).filter(Boolean);

                return (
                  <View key={step.id ?? `${recipe.id}-step-${index}`} style={styles.stepRow}>
                    <View style={styles.stepBadge}>
                      <ThemedText style={styles.stepBadgeText}>{index + 1}</ThemedText>
                    </View>

                    <View style={styles.stepContent}>
                      <ThemedText style={[styles.stepText, { color: colors.text.secondary }]}> 
                        {step.instruction?.trim() || 'No instruction provided.'}
                      </ThemedText>

                      {stepPhotos.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.stepPhotoRow}
                        >
                          {stepPhotos.map((url, photoIndex) => (
                            <Image
                              key={`${step.id ?? index}-photo-${photoIndex}`}
                              source={{ uri: url }}
                              style={styles.stepPhoto}
                              resizeMode="cover"
                              onError={(event) => console.warn('Step image failed to load:', url, event.nativeEvent.error)}
                            />
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: '#FFF7E7', borderColor: '#F2D39B' }]}> 
          <ThemedText style={[styles.sectionTitle, { color: '#6F4B00' }]}>Market note</ThemedText>
          <ThemedText style={[styles.marketNote, { color: '#7A5A18' }]}> 
            {ingredientNames.length > 0
              ? `This recipe works best with fresh ingredients, especially ${ingredientNames.slice(0, 2).join(' and ')}.`
              : 'This recipe works best when made with fresh, seasonal ingredients.'}
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({
  colors,
  icon,
  value,
  label,
  iconColor,
  compact = false,
}: {
  colors: any;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  iconColor: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        compact ? styles.compactMetaCard : styles.metaCard,
        { backgroundColor: colors.background, borderColor: colors.border.light },
      ]}
    >
      <Ionicons name={icon} size={compact ? 16 : 18} color={iconColor} />
      <ThemedText style={[compact ? styles.compactMetaValue : styles.metaValue, { color: colors.text.primary }]}> 
        {value}
      </ThemedText>
      <ThemedText style={[compact ? styles.compactMetaLabel : styles.metaLabel, { color: colors.text.secondary }]}> 
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing['4xl'],
  },
  hero: {
    minHeight: 420,
    justifyContent: 'space-between',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 28, 0.32)',
  },
  heroTopRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'transparent',
  },
  heroContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  heroTag: {
    backgroundColor: '#F4EEC7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  heroTagAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  heroTagText: {
    color: theme.brand.tertiary,
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: theme.neutral.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
    maxWidth: '88%',
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  metaValue: {
    marginTop: theme.spacing.sm,
    fontSize: 20,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  metaLabel: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
  },
  timeMetaRow: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  updatedMetaRow: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  updatedMetaText: {
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.medium,
    fontFamily: theme.typography.fontFamily,
  },
  compactMetaCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  compactMetaValue: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  compactMetaLabel: {
    marginTop: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily,
  },
  sectionCard: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderRadius: 24,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  overviewBlock: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  overviewLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  galleryRow: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 18,
  },
  ingredientList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ingredientDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.brand.primary,
  },
  ingredientCopy: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  ingredientAmount: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeights.medium,
    fontFamily: theme.typography.fontFamily,
  },
  stepsList: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: theme.neutral.white,
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  stepContent: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
  },
  stepPhotoRow: {
    gap: theme.spacing.md,
    paddingTop: 4,
    paddingRight: theme.spacing.sm,
  },
  stepPhoto: {
    width: 220,
    height: 160,
    borderRadius: 20,
  },
  marketNote: {
    marginTop: theme.spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
  },
  missingState: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingTitle: {
    marginTop: theme.spacing.lg,
    fontSize: 28,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  missingBody: {
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
  },
});
