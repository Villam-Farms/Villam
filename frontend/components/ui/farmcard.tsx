import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, theme } from "@/constants/theme";
import { SaveButton } from "@/components/save-button";
import { Ionicons } from "@expo/vector-icons";

interface FarmCardProps {
  id?: string;
  name: string;
  rating: number;
  reviews: number;
  distance: string;
  products: string;
  imageUrl?: string;
  onPress?: () => void;
  onDirectionPress?: () => void;
  onSharePress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
}

const PRODUCTS_LINES = 2;
const PRODUCTS_LINE_HEIGHT = 14; // tweak if you want tighter/looser

export default function FarmCard({
  id,
  name,
  rating,
  reviews,
  distance,
  products,
  imageUrl,
  onPress,
  onDirectionPress,
  onSharePress,
  onFavoritePress,
  isFavorite = false,
}: FarmCardProps) {
  const { colors, isDark } = useTheme();
  const transparentBg = { lightColor: "transparent", darkColor: "transparent" } as const;

  const safeProducts = products?.trim().length ? products : " "; // keeps reserved height even if empty

  return (
    <View style={styles.shadowWrapper}>
      <TouchableOpacity
        testID={id ? `farm-card-${id}` : undefined}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        style={[styles.farmCard, { backgroundColor: colors.surface }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Image (fixed height, so all cards start the same) */}
        <ThemedView
          {...transparentBg}
          style={[
            styles.farmImage,
            { backgroundColor: isDark ? colors.border.default : colors.border.light },
          ]}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.farmImageContent} />
          ) : (
            <View style={styles.farmPlaceholder}>
              <View style={[styles.placeholderOrb, styles.placeholderOrbLarge]} />
              <View style={[styles.placeholderOrb, styles.placeholderOrbSmall]} />
              <View style={styles.placeholderIcon}>
                <Ionicons name="leaf" size={30} color={theme.brand.primary} />
              </View>
            </View>
          )}
        </ThemedView>

        {/* Info */}
        <ThemedView {...transparentBg} style={styles.farmInfo}>
          {/* Header (clamped to 1 line) */}
          <ThemedView {...transparentBg} style={styles.farmHeader}>
            <ThemedText
              type="defaultSemiBold"
              style={styles.farmName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {name}
            </ThemedText>

            {id ? <SaveButton type="farm" itemId={id} size={18} /> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={isFavorite ? "Remove favorite farm" : "Favorite farm"} onPress={onFavoritePress} hitSlop={8}>
              <IconSymbol
                name={isFavorite ? "heart.fill" : "heart"}
                size={18}
                color={isFavorite ? colors.text.primary : colors.icon.default}
              />
            </TouchableOpacity>}
          </ThemedView>

          {/* Rating row (distance clamped too) */}
          <ThemedView {...transparentBg} style={styles.farmRating}>
            <IconSymbol name="star.fill" size={14} color="#FFD700" />
            <ThemedText style={[styles.ratingText, { color: colors.text.secondary }]}>
              {rating.toFixed(1)} ({reviews})
            </ThemedText>

            <ThemedText
              style={[styles.distanceText, { color: colors.text.tertiary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              📍 {distance}
            </ThemedText>
          </ThemedView>

          {/* Products: reserve exactly 2 lines worth of height */}
          <View style={styles.productsBlock}>
            <ThemedText
              style={[styles.farmProducts, { color: colors.text.tertiary }]}
              numberOfLines={PRODUCTS_LINES}
              ellipsizeMode="tail"
            >
              {safeProducts}
            </ThemedText>
          </View>

          {/* Actions (fixed-ish height buttons) */}
          <ThemedView {...transparentBg} style={styles.farmActions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: colors.border.default, backgroundColor: colors.background },
              ]}
              onPress={onDirectionPress}
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${name}`}
            >
              <IconSymbol name="location.fill" size={14} color={colors.icon.default} />
              <ThemedText style={[styles.actionText, { color: colors.text.secondary }]}>
                Direction
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: colors.border.default, backgroundColor: colors.background },
              ]}
              onPress={onSharePress}
              accessibilityRole="button"
              accessibilityLabel={`Share ${name}`}
            >
              <IconSymbol name="square.and.arrow.up" size={14} color={colors.icon.default} />
              <ThemedText style={[styles.actionText, { color: colors.text.secondary }]}>
                Share
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    shadowOpacity: 0.25,
    elevation: 4,
    borderRadius: BorderRadius.lg,
  },

  farmCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },

  farmImage: {
    height: 110,
    width: "100%",
  },

  farmImageContent: {
    height: "100%",
    width: "100%",
  },
  farmPlaceholder: {
    flex: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.brand.light,
  },
  placeholderOrb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: theme.brand.secondary,
    opacity: 0.3,
  },
  placeholderOrbLarge: {
    width: 150,
    height: 150,
    right: -30,
    top: -65,
  },
  placeholderOrbSmall: {
    width: 90,
    height: 90,
    left: -15,
    bottom: -40,
  },
  placeholderIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },

  farmInfo: {
    padding: Spacing.md,
  },

  farmHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },

  farmName: {
    flex: 1,
    marginRight: Spacing.sm,
    fontSize: theme.typography.fontSizes.h4,
  },

  farmRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },

  ratingText: {
    fontSize: 12,
    marginLeft: Spacing.xs,
  },

  distanceText: {
    fontSize: 12,
    marginLeft: Spacing.sm,
    flexShrink: 1,
  },

  productsBlock: {
    minHeight: PRODUCTS_LINES * PRODUCTS_LINE_HEIGHT,
    marginBottom: Spacing.sm,
  },

  farmProducts: {
    fontSize: 11,
    lineHeight: PRODUCTS_LINE_HEIGHT,
  },

  farmActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  actionButton: {
    flex: 1,
    height: 32, 
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },

  actionText: {
    fontSize: 11,
  },
});
