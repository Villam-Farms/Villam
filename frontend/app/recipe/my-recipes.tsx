import React, { useDeferredValue, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { theme } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { recipes } from '@/lib/recipes';

// Map your recipe categories to meal times.
// Adjust these to match the actual category strings in your recipes lib.
const MEAL_CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner'];

// Derive a meal-time label from whatever category your recipes use.
// If your recipes already have Breakfast / Lunch / Dinner as categories
// this will work as-is. Otherwise tweak the mapping below.
function getMealTime(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('breakfast') || lower.includes('brunch') || lower.includes('morning')) return 'Breakfast';
  if (lower.includes('lunch') || lower.includes('salad') || lower.includes('sandwich')) return 'Lunch';
  if (lower.includes('dinner') || lower.includes('supper') || lower.includes('main') || lower.includes('pasta') || lower.includes('soup')) return 'Dinner';
  return 'Lunch'; // fallback
}

// Accent color per meal
const MEAL_COLORS: Record<string, string> = {
  Breakfast: '#F59E0B',
  Lunch:     '#10B981',
  Dinner:    '#6366F1',
};

// Icon per meal
const MEAL_ICONS: Record<string, string> = {
  Breakfast: 'sunny-outline',
  Lunch:     'partly-sunny-outline',
  Dinner:    'moon-outline',
};

export default function MyRecipesScreen() {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMeal, setActiveMeal] = useState('All');
  const deferredSearch = useDeferredValue(searchQuery);

  // Attach a mealTime to every recipe
  const annotatedRecipes = useMemo(
    () => recipes.map((r) => ({ ...r, mealTime: getMealTime(r.category) })),
    [],
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return annotatedRecipes.filter((r) => {
      const matchesMeal = activeMeal === 'All' || r.mealTime === activeMeal;
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.produce.some((p) => p.toLowerCase().includes(q));
      return matchesMeal && matchesSearch;
    });
  }, [annotatedRecipes, activeMeal, deferredSearch]);

  // Group filtered recipes by meal time (for the sectioned list)
  const groupedByMeal = useMemo(() => {
    if (activeMeal !== 'All') return null; // flat list when filtered
    const groups: Record<string, typeof filtered> = { Breakfast: [], Lunch: [], Dinner: [] };
    for (const r of filtered) {
      if (groups[r.mealTime]) groups[r.mealTime].push(r);
    }
    return groups;
  }, [filtered, activeMeal]);

  const accentColor = activeMeal === 'All' ? theme.brand.primary : (MEAL_COLORS[activeMeal] ?? theme.brand.primary);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
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
            onPress={() => router.push('/recipe/new')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color={theme.neutral.white} />
            <ThemedText style={styles.addButtonText}>New Recipe</ThemedText>
          </TouchableOpacity>
        </View>

        {/* ── Hero copy ── */}
        <View style={styles.heroCopy}>
          <ThemedText style={[styles.eyebrow, { color: theme.brand.tertiary }]}>
            My kitchen
          </ThemedText>
          <ThemedText style={[styles.heroTitle, { color: colors.text.primary }]}>
            All your recipes, sorted by meal.
          </ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.text.secondary }]}>
            {recipes.length} saved recipes across breakfast, lunch & dinner.
          </ThemedText>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          {(['Breakfast', 'Lunch', 'Dinner'] as const).map((meal) => {
            const count = annotatedRecipes.filter((r) => r.mealTime === meal).length;
            const color = MEAL_COLORS[meal];
            const icon = MEAL_ICONS[meal] as any;
            return (
              <TouchableOpacity
                key={meal}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: activeMeal === meal ? color : colors.border.light,
                    borderWidth: activeMeal === meal ? 2 : 1,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveMeal(activeMeal === meal ? 'All' : meal)}
              >
                <Ionicons name={icon} size={22} color={color} />
                <ThemedText style={[styles.statValue, { color: colors.text.primary }]}>
                  {count}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>
                  {meal}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Search ── */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.input.background,
              borderColor: colors.border.light,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes, produce, category…"
            placeholderTextColor={colors.input.placeholder}
            style={[styles.searchInput, { color: colors.input.text }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Meal filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {MEAL_CATEGORIES.map((meal) => {
            const isActive = meal === activeMeal;
            const chipColor = meal === 'All' ? theme.brand.primary : (MEAL_COLORS[meal] ?? theme.brand.primary);
            const icon = meal !== 'All' ? (MEAL_ICONS[meal] as any) : null;
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
                {icon && (
                  <Ionicons
                    name={icon}
                    size={14}
                    color={isActive ? theme.neutral.white : colors.text.secondary}
                  />
                )}
                <ThemedText
                  style={[
                    styles.filterChipText,
                    { color: isActive ? theme.neutral.white : colors.text.secondary },
                  ]}
                >
                  {meal}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Content: grouped (All) or flat (filtered) ── */}
        {groupedByMeal ? (
          // All view — show Breakfast / Lunch / Dinner sections
          (['Breakfast', 'Lunch', 'Dinner'] as const).map((meal) => {
            const group = groupedByMeal[meal];
            if (group.length === 0) return null;
            const color = MEAL_COLORS[meal];
            const icon = MEAL_ICONS[meal] as any;
            return (
              <View key={meal}>
                {/* Section header */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.sectionIconBadge, { backgroundColor: color + '22' }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
                      {meal}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.sectionCount, { color: colors.text.secondary }]}>
                    {group.length} {group.length === 1 ? 'recipe' : 'recipes'}
                  </ThemedText>
                </View>

                {/* Horizontal scroll for the section */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickPicksRow}
                >
                  {group.map((recipe) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={[
                        styles.quickPickCard,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border.light,
                        },
                      ]}
                      activeOpacity={0.86}
                      onPress={() => router.push(`/recipe/${recipe.id}`)}
                    >
                      {recipe.imageUrl ? (
                        <Image source={{ uri: recipe.imageUrl }} style={styles.quickPickImage} contentFit="cover" />
                      ) : (
                        <View style={[styles.quickPickImage, { backgroundColor: theme.neutral[300] }]} />
                      )}
                      <View style={styles.quickPickBody}>
                        <ThemedText style={[styles.quickPickCategory, { color }]} numberOfLines={1}>
                          {recipe.category}
                        </ThemedText>
                        <ThemedText style={[styles.quickPickTitle, { color: colors.text.primary }]} numberOfLines={2}>
                          {recipe.title}
                        </ThemedText>
                        <View style={styles.quickPickMeta}>
                          <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
                          <ThemedText style={[styles.quickPickMetaText, { color: colors.text.secondary }]}>
                            {recipe.duration}
                          </ThemedText>
                          <ThemedText style={[styles.quickPickMetaText, { color: colors.text.secondary }]}>
                            · {recipe.difficulty}
                          </ThemedText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          })
        ) : (
          // Filtered view — full grid list
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                {activeMeal !== 'All' && (
                  <View style={[styles.sectionIconBadge, { backgroundColor: accentColor + '22' }]}>
                    <Ionicons name={MEAL_ICONS[activeMeal] as any} size={18} color={accentColor} />
                  </View>
                )}
                <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
                  {activeMeal === 'All' ? 'All recipes' : activeMeal}
                </ThemedText>
              </View>
              <ThemedText style={[styles.sectionCount, { color: colors.text.secondary }]}>
                {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
              </ThemedText>
            </View>

            <View style={styles.recipeGrid}>
              {filtered.length === 0 ? (
                <View
                  style={[
                    styles.emptyState,
                    { backgroundColor: colors.background, borderColor: colors.border.light },
                  ]}
                >
                  <Ionicons name="search-outline" size={26} color={colors.text.tertiary} />
                  <ThemedText style={[styles.emptyStateTitle, { color: colors.text.primary }]}>
                    No recipes found
                  </ThemedText>
                  <ThemedText style={[styles.emptyStateBody, { color: colors.text.secondary }]}>
                    Try a different search term or switch back to All.
                  </ThemedText>
                </View>
              ) : (
                filtered.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[
                      styles.recipeTile,
                      { backgroundColor: colors.background, borderColor: colors.border.light },
                    ]}
                    activeOpacity={0.88}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  >
                    {recipe.imageUrl ? (
                      <Image source={{ uri: recipe.imageUrl }} style={styles.recipeTileImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.recipeTileImage, { backgroundColor: theme.neutral[300] }]} />
                    )}
                    <View style={styles.recipeTileBody}>
                      <View style={styles.recipeTileTopRow}>
                        <ThemedText style={[styles.recipeTileCategory, { color: accentColor }]}>
                          {recipe.category}
                        </ThemedText>
                        <View style={styles.recipeTileRating}>
                          <Ionicons name="star" size={12} color={theme.brand.red} />
                          <ThemedText style={[styles.recipeTileRatingText, { color: colors.text.secondary }]}>
                            {recipe.rating}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.recipeTileTitle, { color: colors.text.primary }]}>
                        {recipe.title}
                      </ThemedText>
                      <ThemedText
                        style={[styles.recipeTileDescription, { color: colors.text.secondary }]}
                        numberOfLines={2}
                      >
                        {recipe.description}
                      </ThemedText>
                      <View style={styles.recipeTileFooter}>
                        <View style={styles.recipeTileMetaItem}>
                          <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
                          <ThemedText style={[styles.recipeTileMeta, { color: colors.text.secondary }]}>
                            {recipe.duration}
                          </ThemedText>
                        </View>
                        <ThemedText style={[styles.recipeTileMeta, { color: colors.text.secondary }]}>
                          {recipe.difficulty}
                        </ThemedText>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing['4xl'],
    gap: theme.spacing.lg,
  },
  header: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    height: 44,
    minWidth: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
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
    textTransform: 'uppercase',
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
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.neutral.white,
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
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  quickPicksRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  quickPickCard: {
    width: 200,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickPickImage: {
    width: '100%',
    height: 130,
  },
  quickPickBody: {
    padding: theme.spacing.md,
    gap: 4,
  },
  quickPickCategory: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  quickPickTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  quickPickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  quickPickMetaText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
  },
  recipeGrid: {
    gap: theme.spacing.md,
  },
  recipeTile: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  emptyStateBody: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTileImage: {
    width: '100%',
    height: 180,
  },
  recipeTileBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  recipeTileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTileCategory: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  recipeTileRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeTileRatingText: {
    fontSize: 13,
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
  recipeTileFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  recipeTileMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeTileMeta: {
    fontSize: 13,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
  },
});