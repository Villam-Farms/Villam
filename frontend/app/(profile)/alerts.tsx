import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import {
  listNotifications,
  readAllNotifications,
  readNotification,
  type NotificationItem,
} from "@/lib/social";

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const accessToken = session?.access_token ?? null;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      let active = true;
      setLoading(true);
      listNotifications(accessToken)
        .then((data) => {
          if (active) setItems(data);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [accessToken]),
  );

  const openNotification = async (item: NotificationItem) => {
    if (!accessToken) return;
    if (!item.is_read) {
      await readNotification(accessToken, item.id);
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, is_read: true } : entry)));
    }

    if (item.type === "message" && item.entity_type === "thread" && item.entity_id) {
      router.push(`/(profile)/messages/${item.entity_id}`);
      return;
    }

    if (item.type === "follow" && item.entity_type === "profile" && item.entity_id) {
      router.push({ pathname: "/user/[id]", params: { id: item.entity_id } });
    }
  };

  const markAllRead = async () => {
    if (!accessToken) return;
    await readAllNotifications(accessToken);
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={26} color={colors.text.primary} />
          </Pressable>
          <ThemedText style={[styles.title, { color: colors.text.primary }]}>Alerts</ThemedText>
          <Pressable onPress={markAllRead} hitSlop={8}>
            <ThemedText style={[styles.actionText, { color: theme.brand.primary }]}>Read all</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.brand.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void openNotification(item)}
                style={[
                  styles.card,
                  {
                    backgroundColor: item.is_read ? colors.card : theme.brand.light,
                    borderColor: colors.border.light,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <ThemedText style={[styles.cardTitle, { color: colors.text.primary }]}>{item.title}</ThemedText>
                  <ThemedText style={[styles.cardTime, { color: colors.text.tertiary }]}>
                    {formatTimestamp(item.created_at)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.cardBody, { color: colors.text.secondary }]}>{item.body}</ThemedText>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="notifications-outline" size={28} color={colors.text.tertiary} />
                <ThemedText style={{ color: colors.text.secondary }}>No alerts yet.</ThemedText>
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
  actionText: { fontSize: theme.typography.fontSizes.h5, fontWeight: theme.typography.fontWeights.semibold },
  loadingState: { paddingTop: theme.spacing.xl, alignItems: "center" },
  listContent: { paddingBottom: theme.spacing.xl, gap: theme.spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  cardTitle: { flex: 1, fontSize: theme.typography.fontSizes.h4, fontWeight: theme.typography.fontWeights.semibold },
  cardTime: { fontSize: theme.typography.fontSizes.body },
  cardBody: { fontSize: theme.typography.fontSizes.h5, lineHeight: 20 },
  emptyState: { alignItems: "center", paddingTop: theme.spacing.xl, gap: theme.spacing.sm },
});
