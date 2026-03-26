import { WebSocketClient } from "@fibeger/api-client";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export const realtimeClient = new WebSocketClient(WS_URL, getToken);
