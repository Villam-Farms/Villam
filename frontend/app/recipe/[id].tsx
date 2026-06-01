import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { recipes as localRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";

type DBIngredient = {
  id?: string;
  position?: number;
  quantity?: string;
  unit?: string;
  name?: string;
};

type DBStep = {
  id?: string;
  position?: number;
  instruction?: string;
  photos?: Array<{
    position?: number;
    path?: string;
    url?: string;
  }>;
};

type DBRecipe = {
  id: string;
  title: string;
  description: string | null;
  prep_time_minutes: number;
  cook_time_minutes: number;
  additional_time_minutes: number;
  total_time_minutes: number;
  servings: number | null;
  ingredients: DBIngredient[] | null;
  steps: DBStep[] | null;
};

type DBGroceryList = {
  id: string;
  title: string;
  created_at: string;
};

type DBGroceryListItem = {
  id: string;
  list_id: string;
  user_id: string;
  position: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  is_checked: boolean;
  created_at?: string;
};

type NormalizedRecipe = {
  id: string;
  source: "db" | "local";
  title: string;
  description: string;
  imageUrl?: string;
  duration: string;
  servings?: string;
  rating?: string;
  ratingsCount?: string;
  ingredients: Array<{
    id: string;
    quantity: string;
    unit: string;
    name: string;
  }>;
  steps: Array<{
    id: string;
    instruction: string;
  }>;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeText = (value?: string | null) => (value ?? "").trim().toLowerCase();

const buildIngredientKey = (name?: string | null, unit?: string | null) =>
  `${normalizeText(name)}__${normalizeText(unit)}`;

export default function RecipeDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();

  const [dbRecipe, setDbRecipe] = useState<DBRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingList, setCreatingList] = useState(false);

  const localRecipe = useMemo(
    () => localRecipes.find((item) => item.id === id),
    [id]
  );

  useEffect(() => {
    let cancelled = false;

    const loadRecipe = async () => {
      if (!id || !isUuid(id)) {
        setDbRecipe(null);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("recipes")
        .select(`
          id,
          title,
          description,
          prep_time_minutes,
          cook_time_minutes,
          additional_time_minutes,
          total_time_minutes,
          servings,
          ingredients,
          steps
        `)
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error) {
        console.log("Recipe load error:", error);
        setDbRecipe(null);
        setLoading(false);
        return;
      }

      setDbRecipe(data as DBRecipe);
      setLoading(false);
    };

    loadRecipe();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const recipe: NormalizedRecipe | null = useMemo(() => {
    if (dbRecipe) {
      const ingredients = Array.isArray(dbRecipe.ingredients)
        ? [...dbRecipe.ingredients]
            .filter((item) => item?.name?.trim())
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((item, index) => ({
              id: item.id ?? `${dbRecipe.id}-ingredient-${index}`,
              quantity: item.quantity?.trim() ?? "",
              unit: item.unit?.trim() ?? "",
              name: item.name?.trim() ?? "",
            }))
        : [];

      const steps = Array.isArray(dbRecipe.steps)
        ? [...dbRecipe.steps]
            .filter((step) => step?.instruction?.trim())
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((step, index) => ({
              id: step.id ?? `${dbRecipe.id}-step-${index}`,
              instruction: step.instruction?.trim() ?? "",
            }))
        : [];

      return {
        id: dbRecipe.id,
        source: "db",
        title: dbRecipe.title,
        description: dbRecipe.description ?? "",
        duration: dbRecipe.total_time_minutes > 0 ? `${dbRecipe.total_time_minutes} min` : "—",
        servings: dbRecipe.servings ? String(dbRecipe.servings) : undefined,
        ingredients,
        steps,
      };
    }

    if (localRecipe) {
      const ingredients = localRecipe.produce.map((item, index) => ({
        id: `${localRecipe.id}-ingredient-${index}`,
        quantity: index === 0 ? "2" : index === 1 ? "1" : "",
        unit: index === 0 ? "cups" : index === 1 ? "handful" : "",
        name: item,
      }));

      const steps = [
        `Wash and prep the ${localRecipe.produce.join(", ").toLowerCase()} so everything is ready before cooking.`,
        `Build the base of the dish and cook for about ${localRecipe.duration.toLowerCase()} while adjusting seasoning as needed.`,
        `Finish with a fresh garnish and plate immediately for the best texture and flavor.`,
      ].map((instruction, index) => ({
        id: `${localRecipe.id}-step-${index}`,
        instruction,
      }));

      return {
        id: localRecipe.id,
        source: "local",
        title: localRecipe.title,
        description: localRecipe.description ?? "",
        imageUrl: localRecipe.imageUrl,
        duration: localRecipe.duration,
        rating: String(localRecipe.rating),
        ratingsCount: localRecipe.ratingsCount.toLocaleString(),
        ingredients,
        steps,
      };
    }

    return null;
  }, [dbRecipe, localRecipe]);

  const handleCreateGroceryList = async () => {
    try {
      if (!recipe) {
        Alert.alert("Recipe not found", "Try again in a moment.");
        return;
      }

      const ingredientRows = recipe.ingredients
        .filter((item) => item.name.trim().length > 0)
        .map((item) => ({
          quantity: item.quantity.trim() || null,
          unit: item.unit.trim() || null,
          name: item.name.trim(),
          dedupeKey: buildIngredientKey(item.name, item.unit),
        }));

      if (ingredientRows.length === 0) {
        Alert.alert("No ingredients", "This recipe has no ingredients to add.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        Alert.alert("Not signed in", "Please sign in to update your grocery list.");
        return;
      }

      setCreatingList(true);

      const { data: existingList, error: existingListError } = await supabase
        .from("grocery_lists")
        .select("id, title, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingListError) throw existingListError;

      let activeList: DBGroceryList | null = existingList as DBGroceryList | null;

      if (!activeList) {
        const { data: newList, error: newListError } = await supabase
          .from("grocery_lists")
          .insert({
            user_id: user.id,
            title: "My Grocery List",
            source_recipe_id: isUuid(recipe.id) ? recipe.id : null,
          })
          .select("id, title, created_at")
          .single();

        if (newListError) throw newListError;
        activeList = newList as DBGroceryList;
      }

      const { data: existingItems, error: existingItemsError } = await supabase
        .from("grocery_list_items")
        .select("id, list_id, user_id, position, quantity, unit, name, is_checked, created_at")
        .eq("list_id", activeList.id)
        .order("position", { ascending: true });

      if (existingItemsError) throw existingItemsError;

      const typedExistingItems = (existingItems ?? []) as DBGroceryListItem[];

      const existingKeys = new Set(
        typedExistingItems.map((item) => buildIngredientKey(item.name, item.unit))
      );

      const maxPosition = typedExistingItems.reduce(
        (max, item) => Math.max(max, Number(item.position ?? 0)),
        -1
      );

      const itemsToInsert = ingredientRows
        .filter((item) => !existingKeys.has(item.dedupeKey))
        .map((item, index) => ({
          list_id: activeList!.id,
          user_id: user.id,
          position: maxPosition + index + 1,
          quantity: item.quantity,
          unit: item.unit,
          name: item.name,
          is_checked: false,
        }));

      if (itemsToInsert.length > 0) {
        const { error: insertItemsError } = await supabase
          .from("grocery_list_items")
          .insert(itemsToInsert);

        if (insertItemsError) throw insertItemsError;
      }

      const skippedCount = ingredientRows.length - itemsToInsert.length;

      if (itemsToInsert.length === 0) {
        Alert.alert(
          "Nothing new to add",
          "All of this recipe’s ingredients are already in your current grocery list."
        );
      } else if (skippedCount > 0) {
        Alert.alert(
          "Grocery list updated",
          `${itemsToInsert.length} ingredient(s) added. ${skippedCount} duplicate item(s) skipped.`
        );
      } else {
        Alert.alert(
          "Grocery list updated",
          `${itemsToInsert.length} ingredient(s) added to your current grocery list.`
        );
      }

      router.push(`/grocery-list/${activeList.id}`);
    } catch (error: any) {
      console.log("Create grocery list error:", error);
      Alert.alert(
        "Could not update grocery list",
        error?.message ?? "Something went wrong."
      );
    } finally {
      setCreatingList(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.brand.primary} />
          <ThemedText style={[styles.stateText, { color: colors.text.secondary }]}>
            Loading recipe...
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerState}>
          <TouchableOpacity
            style={[
              styles.backButton,
              { borderColor: colors.border.light, backgroundColor: colors.background },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={[styles.missingTitle, { color: colors.text.primary }]}>
            Recipe not found
          </ThemedText>
          <ThemedText style={[styles.missingBody, { color: colors.text.secondary }]}>
            That recipe page does not exist yet.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {recipe.imageUrl ? (
            <>
              <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} />
              <View style={styles.heroOverlay} />
            </>
          ) : (
            <View
              style={[
                styles.heroFallback,
                { backgroundColor: colors.input.background, borderColor: colors.border.light },
              ]}
            />
          )}

          <View style={[styles.heroTopRow, { paddingTop: insets.top + theme.spacing.sm }]}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: recipe.imageUrl ? "rgba(17, 24, 28, 0.45)" : colors.background,
                  borderColor: recipe.imageUrl ? "transparent" : colors.border.light,
                },
              ]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={recipe.imageUrl ? theme.neutral.white : colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.heroContent, { paddingTop: insets.top + 72 }]}>
            <ThemedText
              style={[
                styles.heroTitle,
                { color: recipe.imageUrl ? theme.neutral.white : colors.text.primary },
              ]}
            >
              {recipe.title}
            </ThemedText>

            {!!recipe.description && (
              <ThemedText
                style={[
                  styles.heroDescription,
                  {
                    color: recipe.imageUrl ? "rgba(255,255,255,0.9)" : colors.text.secondary,
                  },
                ]}
              >
                {recipe.description}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.metaCard,
              { backgroundColor: colors.background, borderColor: colors.border.light },
            ]}
          >
            <Ionicons name="time-outline" size={18} color={theme.brand.primary} />
            <ThemedText style={[styles.metaValue, { color: colors.text.primary }]}>
              {recipe.duration}
            </ThemedText>
            <ThemedText style={[styles.metaLabel, { color: colors.text.secondary }]}>
              Total time
            </ThemedText>
          </View>

          <View
            style={[
              styles.metaCard,
              { backgroundColor: colors.background, borderColor: colors.border.light },
            ]}
          >
            <Ionicons
              name={recipe.servings ? "people-outline" : "restaurant-outline"}
              size={18}
              color={theme.brand.primary}
            />
            <ThemedText style={[styles.metaValue, { color: colors.text.primary }]}>
              {recipe.servings ?? recipe.rating ?? "—"}
            </ThemedText>
            <ThemedText style={[styles.metaLabel, { color: colors.text.secondary }]}>
              {recipe.servings ? "Servings" : recipe.ratingsCount ? `${recipe.ratingsCount} ratings` : "Recipe"}
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.actionCard,
            { backgroundColor: colors.background, borderColor: colors.border.light },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.addToListBtn,
              {
                backgroundColor: creatingList ? colors.border.light : theme.brand.primary,
              },
            ]}
            onPress={handleCreateGroceryList}
            activeOpacity={0.85}
            disabled={creatingList}
          >
            {creatingList ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="cart-outline" size={18} color="#fff" />
            )}
            <ThemedText style={styles.addToListBtnText}>
              {creatingList ? "Updating list..." : "Add ingredients to grocery list"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.background, borderColor: colors.border.light },
          ]}
        >
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Ingredients
          </ThemedText>

          <View style={styles.ingredientList}>
            {recipe.ingredients.map((ingredient) => {
              const amount = [ingredient.quantity, ingredient.unit].filter(Boolean).join(" ");

              return (
                <View key={ingredient.id} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  <View style={styles.ingredientCopy}>
                    {!!amount && (
                      <ThemedText style={[styles.ingredientAmount, { color: theme.brand.tertiary }]}>
                        {amount}
                      </ThemedText>
                    )}
                    <ThemedText style={[styles.ingredientName, { color: colors.text.primary }]}>
                      {ingredient.name}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: colors.background, borderColor: colors.border.light },
          ]}
        >
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Directions
          </ThemedText>

          <View style={styles.stepsList}>
            {recipe.steps.map((step, index) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <ThemedText style={styles.stepBadgeText}>{index + 1}</ThemedText>
                </View>
                <ThemedText style={[styles.stepText, { color: colors.text.secondary }]}>
                  {step.instruction}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing["4xl"],
  },
  hero: {
    minHeight: 320,
    justifyContent: "space-between",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17, 24, 28, 0.32)",
  },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 1,
  },
  heroTopRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 2,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
    maxWidth: "90%",
  },
  metaRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginTop: -theme.spacing.lg,
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
  actionCard: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderRadius: 24,
    padding: theme.spacing.lg,
  },
  addToListBtn: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  addToListBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: theme.typography.fontWeights.bold,
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
  ingredientList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  ingredientDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.brand.primary,
  },
  ingredientCopy: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
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
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "flex-start",
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepBadgeText: {
    color: theme.neutral.white,
    fontSize: 14,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
  },
  centerState: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    marginTop: theme.spacing.md,
    fontSize: 15,
  },
  missingTitle: {
    marginTop: theme.spacing.lg,
    fontSize: 28,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  missingBody: {
    marginTop: theme.spacing.sm,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
  },
});