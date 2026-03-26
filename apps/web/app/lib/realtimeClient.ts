import { WebSocketClient, type EventType, type RealtimeEvent } from "@fibeger/api-client";

const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export const realtimeClient = new WebSocketClient(wsUrl, getToken);

export type { EventType, RealtimeEvent };
