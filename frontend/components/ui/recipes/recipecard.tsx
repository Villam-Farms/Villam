// components/ui/RecipeCard.tsx
import { StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import React from 'react';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/useTheme';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface RecipeCardProps {
  id: string;
  title: string;
  rating: number;
  ratingsCount: number;
  duration: string;
  difficulty?: string;
  imageUrl?: string;
  onPress?: () => void;
}

export function RecipeCard({ 
  id,
  title, 
  rating, 
  ratingsCount, 
  duration,
  difficulty,
  imageUrl,
  onPress,
}: RecipeCardProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Recipe Image */}
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.imageContainer, { backgroundColor: colors.card }]}
      >
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
      </TouchableOpacity>

      {/* Recipe Info */}
      <View style={styles.infoContainer}>
        {/* Title */}
        <ThemedText 
          style={[styles.title, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {title}
        </ThemedText>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          <Ionicons 
            name="star" 
            size={16} 
            color={theme.brand.red} 
            style={styles.starIcon}
          />
          <ThemedText style={[styles.ratingText, { color: colors.text.primary }]}>
            {rating} ({ratingsCount.toLocaleString()} Ratings)
          </ThemedText>
        </View>

        {/* Duration */}
        <View style={styles.durationContainer}>
          <Ionicons 
            name="time-outline" 
            size={18} 
            color={colors.text.secondary} 
            style={styles.clockIcon}
          />
          <ThemedText style={[styles.durationText, { color: colors.text.primary }]}>
            {difficulty ? `${duration} • ${difficulty}` : duration}
          </ThemedText>
        </View>
      </View>

      {/* Edit Button */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 180, // Adjust based on your needs
    marginRight: theme.spacing.md,
  },
  imageContainer: {
    width: '100%',
    height: 131,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.semibold,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 22,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
  },
  starIcon: {
    marginRight: 4,
  },
  ratingText: {
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
  },
  clockIcon: {
    marginRight: 3,
  },
  durationText: {
    fontSize: theme.typography.fontSizes.h4,
    fontFamily: theme.typography.fontFamily,
  },
});
