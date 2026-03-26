import { getApiClient } from "../client";
import type { User, Friend } from "../types";

export function getProfile(): Promise<User> {
  return getApiClient().get<User>("/api/profile");
}

export function updateProfile(data: Partial<User>): Promise<User> {
  return getApiClient().put<User>("/api/profile", data);
}

export function getProfileByUsername(
  username: string
): Promise<User & { isFriend?: boolean; isOwnProfile?: boolean }> {
  return getApiClient().get(`/api/profile/${username}`);
}

export function getProfileFriends(username: string): Promise<User[]> {
  return getApiClient().get<User[]>(`/api/profile/${username}/friends`);
}

export function uploadAvatar(formData: FormData): Promise<{ avatar: string }> {
  return getApiClient().upload("/api/profile/avatar", formData);
}

export function uploadBanner(formData: FormData): Promise<{ banner: string }> {
  return getApiClient().upload("/api/profile/banner", formData);
}

export function deleteBanner(): Promise<void> {
  return getApiClient().delete("/api/profile/banner");
}

export function changeUsername(username: string): Promise<User> {
  return getApiClient().put<User>("/api/profile/username", { username });
}

export function deleteAccount(): Promise<void> {
  return getApiClient().delete("/api/profile/delete");
}
