import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { theme } from "@/constants/theme";
import { useAuth } from "@/context/auth-context";
import { useTheme } from "@/hooks/useTheme";
import { getThread, sendThreadMessage, type ConversationThreadDetail } from "@/lib/social";

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MessageThreadScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const threadId = typeof id === "string" ? id : "";
  const accessToken = session?.access_token ?? null;
  const currentUserId = session?.user.id ?? null;
  const [detail, setDetail] = useState<ConversationThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken || !threadId) return;
      let active = true;
      setLoading(true);
      getThread(accessToken, threadId)
        .then((data) => {
          if (active) setDetail(data);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [accessToken, threadId]),
  );

  const title = useMemo(() => {
    return detail?.thread.other_user?.full_name ?? detail?.thread.other_user?.username ?? "Conversation";
  }, [detail?.thread.other_user]);

  const handleSend = async () => {
    if (!accessToken || !threadId || !draft.trim()) return;
    setSending(true);
    try {
      const message = await sendThreadMessage(accessToken, threadId, draft.trim());
      setDetail((prev) =>
        prev
          ? {
              thread: {
                ...prev.thread,
                last_message_preview: message.body,
                last_message_at: message.created_at,
              },
              messages: [...prev.messages, message],
            }
          : prev,
      );
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={26} color={colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.title, { color: colors.text.primary }]}>{title}</ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.text.secondary }]}>
                {detail?.thread.farm_name ? `About ${detail.thread.farm_name}` : "Direct message"}
              </ThemedText>
            </View>
          </View>

          {loading && !detail ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={theme.brand.primary} />
            </View>
          ) : (
            <FlatList
              data={detail?.messages ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesContent}
              renderItem={({ item }) => {
                const mine = item.sender_id === currentUserId;
                return (
                  <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                    <View
                      style={[
                        styles.bubble,
                        {
                          backgroundColor: mine ? theme.brand.primary : colors.card,
                          borderColor: colors.border.light,
                        },
                      ]}
                    >
                      <ThemedText style={{ color: mine ? theme.neutral.white : colors.text.primary }}>
                        {item.body}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.time, { color: colors.text.tertiary }]}>
                      {formatTimestamp(item.created_at)}
                    </ThemedText>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.text.tertiary} />
                  <ThemedText style={{ color: colors.text.secondary }}>Start the conversation.</ThemedText>
                </View>
              }
            />
          )}

          <View style={[styles.composer, { borderColor: colors.border.light, backgroundColor: colors.background }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Send a message..."
              placeholderTextColor={colors.input.placeholder}
              multiline
              style={[
                styles.input,
                { color: colors.input.text, backgroundColor: colors.input.background, borderColor: colors.border.light },
              ]}
            />
            <Button variant="primary" onPress={handleSend} disabled={sending || !draft.trim()} style={styles.sendButton}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: theme.spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  title: { fontSize: theme.typography.fontSizes.h3, fontWeight: theme.typography.fontWeights.bold },
  subtitle: { fontSize: theme.typography.fontSizes.h5 },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesContent: { paddingBottom: theme.spacing.lg, gap: theme.spacing.sm },
  messageRow: { maxWidth: "82%" },
  messageRowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageRowOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  time: { marginTop: 4, fontSize: theme.typography.fontSizes.body },
  emptyState: { alignItems: "center", paddingTop: theme.spacing.xl, gap: theme.spacing.sm },
  composer: {
    borderTopWidth: 1,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  input: {
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    textAlignVertical: "top",
  },
  sendButton: { alignSelf: "flex-end", minWidth: 96 },
});
