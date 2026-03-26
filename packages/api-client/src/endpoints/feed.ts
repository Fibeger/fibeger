import { getApiClient } from "../client";
import type { FeedPost } from "../types";

export function getFeed(params?: {
  type?: "friends" | "public";
  userId?: number;
}): Promise<FeedPost[]> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set("type", params.type);
  if (params?.userId) searchParams.set("userId", String(params.userId));
  const qs = searchParams.toString();
  return getApiClient().get<FeedPost[]>(`/api/feed${qs ? `?${qs}` : ""}`);
}

export function createPost(data: {
  caption?: string;
  mediaUrl: string;
  mediaType: string;
  isPublic: boolean;
}): Promise<FeedPost> {
  return getApiClient().post<FeedPost>("/api/feed", data);
}

export function deletePost(id: number): Promise<void> {
  return getApiClient().delete(`/api/feed/${id}`);
}

export function toggleLike(id: number): Promise<{ liked: boolean }> {
  return getApiClient().post(`/api/feed/${id}/like`);
}
