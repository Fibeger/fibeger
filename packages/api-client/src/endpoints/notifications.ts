import { getApiClient } from "../client";
import type { Notification } from "../types";

export function getNotifications(unreadOnly?: boolean): Promise<Notification[]> {
  const qs = unreadOnly ? "?unreadOnly=true" : "";
  return getApiClient().get<Notification[]>(`/api/notifications${qs}`);
}

export function markNotificationRead(id: number): Promise<void> {
  return getApiClient().patch(`/api/notifications/${id}`, { read: true });
}

export function deleteNotification(id: number): Promise<void> {
  return getApiClient().delete(`/api/notifications/${id}`);
}

export function markAllNotificationsRead(): Promise<void> {
  return getApiClient().patch("/api/notifications/mark-all-read");
}
