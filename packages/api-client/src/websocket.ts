import type { EventType, RealtimeEvent } from "./types";

type EventListener = (event: RealtimeEvent) => void;
type ConnectionStateListener = (connected: boolean) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private connectionStateListeners: Set<ConnectionStateListener> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private _isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private wsUrl: string;
  private getToken: () => string | null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(wsUrl: string, getToken: () => string | null) {
    this.wsUrl = wsUrl;
    this.getToken = getToken;
  }

  connect(): void {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const token = this.getToken();
      const url = token ? `${this.wsUrl}?token=${encodeURIComponent(token)}` : this.wsUrl;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyConnectionState(true);
        this.startPing();
      };

      this.ws.onclose = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          if ((data as { type: string }).type === "pong") return;

          const listeners = this.listeners.get(data.type);
          if (listeners) {
            listeners.forEach((listener) => {
              try {
                listener(data);
              } catch (err) {
                console.error("[WebSocketClient] Listener error:", err);
              }
            });
          }
        } catch (err) {
          console.error("[WebSocketClient] Parse error:", err);
        }
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private cleanup(): void {
    this.isConnecting = false;
    this._isConnected = false;
    this.notifyConnectionState(false);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.ws = null;
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
    this.isConnecting = false;
    this.notifyConnectionState(false);
  }

  on(type: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.off(type, listener);
  }

  off(type: EventType, listener: EventListener): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(type);
    }
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.add(listener);
    listener(this._isConnected);
    return () => this.connectionStateListeners.delete(listener);
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionStateListeners.forEach((l) => {
      try { l(connected); } catch {}
    });
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
