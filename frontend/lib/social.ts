import { apiRequest } from "@/lib/api";
import type { ProfileRow } from "@/lib/follows";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  actor?: ProfileRow | null;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at?: string | null;
};

export type ConversationMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at?: string | null;
  read_at?: string | null;
  sender?: ProfileRow | null;
};

export type ConversationThread = {
  id: string;
  farm_id: string;
  farm_name?: string | null;
  other_user?: ProfileRow | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  unread_count: number;
};

export type ConversationThreadDetail = {
  thread: ConversationThread;
  messages: ConversationMessage[];
};

export async function listNotifications(accessToken: string) {
  return apiRequest<NotificationItem[]>("/notifications", { accessToken });
}

export async function readNotification(accessToken: string, notificationId: string) {
  await apiRequest<void>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "POST",
    accessToken,
  });
}

export async function readAllNotifications(accessToken: string) {
  await apiRequest<void>("/notifications/read-all", {
    method: "POST",
    accessToken,
  });
}

export async function listThreads(accessToken: string) {
  return apiRequest<ConversationThread[]>("/threads", { accessToken });
}

export async function createThread(
  accessToken: string,
  farmId: string,
  message?: string,
) {
  return apiRequest<ConversationThread>("/threads", {
    method: "POST",
    accessToken,
    body: {
      farm_id: farmId,
      message: message?.trim() || null,
    },
  });
}

export async function getThread(accessToken: string, threadId: string) {
  return apiRequest<ConversationThreadDetail>(`/threads/${encodeURIComponent(threadId)}`, {
    accessToken,
  });
}

export async function sendThreadMessage(
  accessToken: string,
  threadId: string,
  body: string,
) {
  return apiRequest<ConversationMessage>(`/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    accessToken,
    body: { body },
  });
}
