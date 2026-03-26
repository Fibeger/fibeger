import { getApiClient } from "../client";
import type { Conversation, Message } from "../types";

export function getConversations(): Promise<Conversation[]> {
  return getApiClient().get<Conversation[]>("/api/conversations");
}

export function createConversation(friendId: number): Promise<Conversation> {
  return getApiClient().post<Conversation>("/api/conversations", { friendId });
}

export function getConversation(id: number): Promise<Conversation> {
  return getApiClient().get<Conversation>(`/api/conversations/${id}`);
}

export function deleteConversation(id: number): Promise<void> {
  return getApiClient().delete(`/api/conversations/${id}`);
}

export function getMessages(conversationId: number): Promise<Message[]> {
  return getApiClient().get<Message[]>(`/api/conversations/${conversationId}/messages`);
}

export function sendMessage(
  conversationId: number,
  data: { content: string; attachments?: string; replyToId?: number }
): Promise<Message> {
  return getApiClient().post<Message>(
    `/api/conversations/${conversationId}/messages`,
    data
  );
}
