import { getApiClient } from "../client";
import type { GroupChat, GroupCall, Message } from "../types";

export function getGroupChats(): Promise<GroupChat[]> {
  return getApiClient().get<GroupChat[]>("/api/groupchats");
}

export function createGroupChat(data: {
  name: string;
  description?: string;
  memberIds: number[];
}): Promise<GroupChat> {
  return getApiClient().post<GroupChat>("/api/groupchats", data);
}

export function getGroupChat(id: number): Promise<GroupChat> {
  return getApiClient().get<GroupChat>(`/api/groupchats/${id}`);
}

export function deleteGroupChat(id: number): Promise<void> {
  return getApiClient().delete(`/api/groupchats/${id}`);
}

export function getGroupMessages(groupId: number): Promise<Message[]> {
  return getApiClient().get<Message[]>(`/api/groupchats/${groupId}/messages`);
}

export function sendGroupMessage(
  groupId: number,
  data: { content: string; attachments?: string; replyToId?: number }
): Promise<Message> {
  return getApiClient().post<Message>(`/api/groupchats/${groupId}/messages`, data);
}

export function addGroupMember(
  groupId: number,
  userId: number
): Promise<void> {
  return getApiClient().post(`/api/groupchats/${groupId}/members`, { userId });
}

export function removeGroupMember(
  groupId: number,
  userId: number
): Promise<void> {
  return getApiClient().delete(`/api/groupchats/${groupId}/members/${userId}`);
}

export function uploadGroupAvatar(
  groupId: number,
  formData: FormData
): Promise<{ avatar: string }> {
  return getApiClient().upload(`/api/groupchats/${groupId}/avatar`, formData);
}

export function getGroupCall(groupId: number): Promise<GroupCall | null> {
  return getApiClient().get(`/api/groupchats/${groupId}/call`);
}

export function startGroupCall(groupId: number): Promise<GroupCall> {
  return getApiClient().post<GroupCall>(`/api/groupchats/${groupId}/call`);
}

export function endGroupCall(groupId: number): Promise<void> {
  return getApiClient().delete(`/api/groupchats/${groupId}/call`);
}

export function joinGroupCall(groupId: number): Promise<void> {
  return getApiClient().post(`/api/groupchats/${groupId}/call/join`);
}

export function leaveGroupCall(groupId: number): Promise<void> {
  return getApiClient().post(`/api/groupchats/${groupId}/call/leave`);
}

export function sendCallSignal(
  groupId: number,
  data: { targetUserId: number; signal: unknown }
): Promise<void> {
  return getApiClient().post(`/api/groupchats/${groupId}/call/signal`, data);
}
