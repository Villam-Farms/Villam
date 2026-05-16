// components/ui/RecipeCard.tsx
import React, { useMemo, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface RecipeCardProps {
  id: string;
  title: string;

  // Overall recipe rating
  rating?: number | null;
  averageRating?: number | null;
  ratingsCount?: number;

  // Current logged-in user's rating
  currentUserRating?: number | null;

  duration: string;
  difficulty?: string | null;
  imageUrl?: string | null;

  isOwner?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
}

export function RecipeCard({
  id,
  title,
  rating = null,
  averageRating = null,
  ratingsCount = 0,
  currentUserRating = null,
  duration,
  difficulty,
  imageUrl,
  isOwner = false,
  onPress,
  onEdit,
}: RecipeCardProps) {
  const { colors } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);

  const overallRating = averageRating ?? rating;
  const hasImage = Boolean(imageUrl && !imageFailed);
  const hasOverallRating = typeof overallRating === "number" && ratingsCount > 0;
  const hasUserRating = typeof currentUserRating === "number";

  const overallRatingLabel = useMemo(() => {
    if (!hasOverallRating) return "No ratings yet";

    const label = ratingsCount === 1 ? "rating" : "ratings";
    return `${overallRating.toFixed(1)} overall (${ratingsCount.toLocaleString()} ${label})`;
  }, [hasOverallRating, overallRating, ratingsCount]);

  const userRatingLabel = hasUserRating ? `Your rating: ${currentUserRating}/5` : "You haven't rated this yet";

  const metaLabel = difficulty?.trim() ? `${duration} • ${difficulty}` : duration;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        testID={`recipe-card-${id}`}
        onPress={onPress}
        activeOpacity={0.82}
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            borderColor: colors.border.light,
          },
        ]}
      >
        <View style={[styles.imageContainer, { backgroundColor: colors.input.background }]}>
          {hasImage ? (
            <Image
              source={{ uri: imageUrl! }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="restaurant-outline" size={30} color={colors.text.tertiary} />
            </View>
          )}

          {(hasOverallRating || hasUserRating) && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <ThemedText style={styles.ratingBadgeText}>
                {hasOverallRating ? overallRating.toFixed(1) : currentUserRating}
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <ThemedText style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>
            {title}
          </ThemedText>

          <View style={styles.metaRow}>
            <Ionicons
              name={hasUserRating ? "star" : "star-outline"}
              size={15}
              color={hasUserRating ? "#F59E0B" : colors.text.tertiary}
            />
            <ThemedText style={[styles.metaText, { color: colors.text.secondary }]} numberOfLines={1}>
              {userRatingLabel}
            </ThemedText>
          </View>

          <View style={styles.metaRow}>
            <Ionicons
              name={hasOverallRating ? "stats-chart-outline" : "star-outline"}
              size={15}
              color={hasOverallRating ? theme.brand.primary : colors.text.tertiary}
            />
            <ThemedText style={[styles.metaText, { color: colors.text.secondary }]} numberOfLines={1}>
              {overallRatingLabel}
            </ThemedText>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
            <ThemedText style={[styles.metaText, { color: colors.text.secondary }]} numberOfLines={1}>
              {metaLabel}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>

      {isOwner && onEdit && (
        <TouchableOpacity style={styles.editButton} onPress={onEdit} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={14} color={theme.neutral.white} />
          <ThemedText style={styles.editButtonText}>Edit</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 190,
    marginRight: theme.spacing.md,
  },
  container: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    height: 132,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(17, 24, 28, 0.78)",
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  ratingBadgeText: {
    color: theme.neutral.white,
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  infoContainer: {
    padding: theme.spacing.md,
    gap: 7,
  },
  title: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: theme.typography.fontWeights.medium,
    fontFamily: theme.typography.fontFamily,
  },
  editButton: {
    marginTop: theme.spacing.sm,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.brand.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    color: theme.neutral.white,
    fontSize: 12,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
});