import { getApiClient } from "../client";
import type { User, FriendRequest } from "../types";

export function getFriends(): Promise<User[]> {
  return getApiClient().get<User[]>("/api/friends");
}

export function removeFriend(friendId: number): Promise<void> {
  return getApiClient().delete("/api/friends", { friendId });
}

export function searchUsers(query: string): Promise<User[]> {
  return getApiClient().get<User[]>(`/api/friends/request?search=${encodeURIComponent(query)}`);
}

export function sendFriendRequest(receiverId: number): Promise<FriendRequest> {
  return getApiClient().post<FriendRequest>("/api/friends/request", { receiverId });
}

export function getFriendRequest(id: number): Promise<FriendRequest> {
  return getApiClient().get<FriendRequest>(`/api/friends/request/${id}`);
}

export function respondToFriendRequest(
  id: number,
  action: "accept" | "reject"
): Promise<FriendRequest> {
  return getApiClient().put<FriendRequest>(`/api/friends/request/${id}`, { action });
}
