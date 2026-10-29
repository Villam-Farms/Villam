import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

type Props = {
  colors: ReturnType<typeof useTheme>["colors"];
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
};

/** A consistent loading, error, and empty state for collection screens. */
export function StateCard({ colors, icon = "information-circle-outline", title, body, actionLabel, onAction, loading }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border.light }]}>
      <View style={[styles.icon, { backgroundColor: colors.card }]}>
        {loading ? <ActivityIndicator color={theme.brand.primary} /> : <Ionicons name={icon} size={25} color={colors.text.secondary} />}
      </View>
      <ThemedText style={[styles.title, { color: colors.text.primary }]}>{title}</ThemedText>
      {body ? <ThemedText style={[styles.body, { color: colors.text.secondary }]}>{body}</ThemedText> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity accessibilityRole="button" style={[styles.action, { borderColor: theme.brand.primary }]} onPress={onAction}>
          <ThemedText style={[styles.actionText, { color: theme.brand.primary }]}>{actionLabel}</ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", borderWidth: 1, borderRadius: 20, padding: theme.spacing.xl, marginTop: theme.spacing.md },
  icon: { width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 4 },
  action: { borderWidth: 1, borderRadius: theme.borderRadius.full, paddingHorizontal: 14, paddingVertical: 8, marginTop: 14 },
  actionText: { fontSize: 13, fontWeight: "700" },
});
