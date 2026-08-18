import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useSavedItem } from "@/hooks/useSaved";
import type { SavedItemType } from "@/lib/saved";

export function SaveButton({ type, itemId, light = false, size = 20 }: { type: SavedItemType; itemId: string; light?: boolean; size?: number }) {
  const { colors } = useTheme();
  const { isSaved, isLoading, toggle, error } = useSavedItem(type, itemId);
  const [visualSaved, setVisualSaved] = useState(isSaved);

  useEffect(() => {
    if (!isLoading) setVisualSaved(isSaved);
  }, [isLoading, isSaved]);

  const color = visualSaved ? "#E85D3F" : light ? "#FFFFFF" : colors.text.primary;
  useEffect(() => {
    if (!error) return;
    const message = error instanceof Error ? error.message : "Please try again.";
    const migrationHint = message.includes("saved_items")
      ? " The saved-items database migration may not have been applied yet."
      : "";
    Alert.alert("Could not update favorite", `${message}${migrationHint}`);
  }, [error]);
  const iconName = type === "farm"
    ? (visualSaved ? "heart" : "heart-outline")
    : (visualSaved ? "bookmark" : "bookmark-outline");
  const handlePress = async () => {
    const next = !visualSaved;
    setVisualSaved(next);
    try {
      await toggle(next);
    } catch {
      setVisualSaved(!next);
    }
  };
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: light ? "rgba(17,24,28,0.45)" : colors.background }]}
      onPress={(event) => { event.stopPropagation(); void handlePress(); }}
      disabled={isLoading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={visualSaved ? `Remove saved ${type}` : `Save ${type}`}
    >
      {isLoading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={iconName} size={size} color={color} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
