export { initApiClient, getApiClient } from "./client";
export type { ClientConfig } from "./client";
export { WebSocketClient } from "./websocket";
export * from "./types";

export * as authApi from "./endpoints/auth";
export * as profileApi from "./endpoints/profile";
export * as friendsApi from "./endpoints/friends";
export * as feedApi from "./endpoints/feed";
export * as conversationsApi from "./endpoints/conversations";
export * as groupchatsApi from "./endpoints/groupchats";
export * as messagesApi from "./endpoints/messages";
export * as notificationsApi from "./endpoints/notifications";
export * as uploadApi from "./endpoints/upload";
export * as personalityApi from "./endpoints/personality";
