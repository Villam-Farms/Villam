import React, { useState } from "react";
import { Alert, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/hooks/useTheme";
import { saveSearch, type SavedSearchContext, type SavedSearchFilters } from "@/lib/saved";
import { theme } from "@/constants/theme";

export function SaveSearchButton({ context, query, filters = {}, visible = true }: { context: SavedSearchContext; query: string; filters?: SavedSearchFilters; visible?: boolean }) {
  const { session } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  if (!visible) return null;
  const handlePress = async () => {
    if (!session?.user.id || saving) return;
    try {
      setSaving(true);
      await saveSearch(session.user.id, context, query, filters);
      await queryClient.invalidateQueries({ queryKey: ["saved-searches", session.user.id] });
      Alert.alert("Search saved", "You can reopen it from Profile → Saved.");
    } catch (error) {
      Alert.alert("Could not save search", error instanceof Error ? error.message : "Please try again.");
    } finally { setSaving(false); }
  };
  return <TouchableOpacity onPress={handlePress} disabled={saving} style={[styles.button, { borderColor: colors.border.light, backgroundColor: colors.background }]} accessibilityRole="button" accessibilityLabel="Save this search"><Ionicons name={saving ? "hourglass-outline" : "bookmark-outline"} size={18} color={theme.brand.primary} /></TouchableOpacity>;
}
const styles = StyleSheet.create({ button: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" } });
