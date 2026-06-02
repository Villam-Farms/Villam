// app/(tabs)/create.tsx
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CreateScreen() {
  const { colors } = useTheme();
  const { type } = useLocalSearchParams<{ type?: string }>();

  const selectedType =
    type === 'recipe'
      ? 'Recipe'
      : type === 'grocery'
        ? 'Grocery List'
        : 'Choose what you want to create';

  const handleCreateRecipe = () => {
    router.push('/recipe/new');
  };

  const handleCreateGroceryList = () => {
    router.push('/grocery-list/new');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ThemedText type="title" style={{ color: colors.text.primary }}>
          Create
        </ThemedText>

        <ThemedText style={[styles.subtitle, { color: colors.text.secondary }]}>
          {selectedType}
        </ThemedText>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.createCard,
              {
                backgroundColor: colors.input.background,
                borderColor: colors.border.light,
              },
            ]}
            onPress={handleCreateRecipe}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.brand.primary }]}>
              <Ionicons name="restaurant-outline" size={22} color="#fff" />
            </View>

            <View style={styles.cardCopy}>
              <ThemedText style={[styles.cardTitle, { color: colors.text.primary }]}>
                New Recipe
              </ThemedText>
              <ThemedText style={[styles.cardBody, { color: colors.text.secondary }]}>
                Add ingredients, steps, and cooking details.
              </ThemedText>
            </View>

            <Ionicons name="chevron-forward" size={22} color={colors.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.createCard,
              {
                backgroundColor: colors.input.background,
                borderColor: colors.border.light,
              },
            ]}
            onPress={handleCreateGroceryList}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.brand.primary }]}>
              <Ionicons name="cart-outline" size={22} color="#fff" />
            </View>

            <View style={styles.cardCopy}>
              <ThemedText style={[styles.cardTitle, { color: colors.text.primary }]}>
                New Grocery List
              </ThemedText>
              <ThemedText style={[styles.cardBody, { color: colors.text.secondary }]}>
                Start a grocery list and save it when you are ready.
              </ThemedText>
            </View>

            <Ionicons name="chevron-forward" size={22} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    marginTop: 8,
  },
  actions: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  createCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily,
  },
});