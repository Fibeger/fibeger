import { getApiClient } from "../client";

export function deleteMessage(id: number): Promise<void> {
  return getApiClient().delete(`/api/messages/${id}`);
}

export function addReaction(
  messageId: number,
  emoji: string
): Promise<void> {
  return getApiClient().post(`/api/messages/${messageId}/reactions`, { emoji });
}

export function removeReaction(
  messageId: number,
  emoji: string
): Promise<void> {
  return getApiClient().delete(`/api/messages/${messageId}/reactions`, { emoji });
}

export function markAsRead(data: {
  messageId: number;
  conversationId?: number;
  groupChatId?: number;
}): Promise<void> {
  return getApiClient().post("/api/messages/mark-read", data);
}

export function sendTypingIndicator(data: {
  conversationId?: number;
  groupChatId?: number;
}): Promise<void> {
  return getApiClient().post("/api/typing", data);
}
