import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/hooks/useTheme";
import { listThreads, type ConversationThread } from "@/lib/social";

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric" });
}

export default function InboxScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const accessToken = session?.access_token ?? null;
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      let active = true;
      setLoading(true);
      listThreads(accessToken)
        .then((data) => {
          if (active) setThreads(data);
        })
        .catch((error) => {
          if (!active) return;
          Alert.alert("Unable to load inbox", error instanceof Error ? error.message : "Please try again.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [accessToken]),
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={26} color={colors.text.primary} />
          </Pressable>
          <ThemedText style={[styles.title, { color: colors.text.primary }]}>Inbox</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.brand.primary} />
          </View>
        ) : (
          <FlatList
            data={threads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/(profile)/messages/${item.id}`)}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border.light }]}
              >
                <View style={styles.cardHeader}>
                  {item.other_user?.avatar_url ? (
                    <Image
                      source={{ uri: item.other_user.avatar_url }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        styles.avatarFallback,
                        { backgroundColor: colors.background, borderColor: colors.border.light },
                      ]}
                    >
                      <Ionicons name="person" size={18} color={colors.text.secondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.cardTitle, { color: colors.text.primary }]}>
                      {item.other_user?.full_name ?? item.other_user?.username ?? "Farmer"}
                    </ThemedText>
                    <ThemedText style={[styles.cardMeta, { color: colors.text.tertiary }]}>
                      {item.farm_name ? `Farm: ${item.farm_name}` : "Conversation"}
                    </ThemedText>
                  </View>
                  <View style={styles.trailing}>
                    <ThemedText style={[styles.cardMeta, { color: colors.text.tertiary }]}>
                      {formatTimestamp(item.last_message_at)}
                    </ThemedText>
                    {item.unread_count > 0 ? (
                      <View style={styles.unreadBadge}>
                        <ThemedText style={styles.unreadText}>{item.unread_count}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
                <ThemedText style={[styles.preview, { color: colors.text.secondary }]} numberOfLines={2}>
                  {item.last_message_preview || "No messages yet."}
                </ThemedText>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.text.tertiary} />
                <ThemedText style={{ color: colors.text.secondary }}>No conversations yet.</ThemedText>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: theme.spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
  },
  title: { fontSize: theme.typography.fontSizes.h2, fontWeight: theme.typography.fontWeights.bold },
  loadingState: { paddingTop: theme.spacing.xl, alignItems: "center" },
  listContent: { paddingBottom: theme.spacing.xl, gap: theme.spacing.sm },
  card: { borderWidth: 1, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: theme.typography.fontSizes.h4, fontWeight: theme.typography.fontWeights.semibold },
  cardMeta: { fontSize: theme.typography.fontSizes.body },
  preview: { fontSize: theme.typography.fontSizes.h5, lineHeight: 20 },
  trailing: { alignItems: "flex-end", gap: 6 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { color: theme.neutral.white, fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingTop: theme.spacing.xl, gap: theme.spacing.sm },
});
