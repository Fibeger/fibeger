import { WebSocketClient } from "@fibeger/api-client";
import { getAccessToken } from "./auth";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

export const realtimeClient = new WebSocketClient(WS_URL, getAccessToken);
