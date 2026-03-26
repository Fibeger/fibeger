import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { initApiClient, authApi, type User } from "@fibeger/api-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

let tokenStore = {
  accessToken: null as string | null,
  refreshToken: null as string | null,
};

async function loadTokens() {
  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("auth.json");
    tokenStore.accessToken = await store.get("access_token") as string | null;
    tokenStore.refreshToken = await store.get("refresh_token") as string | null;
  } catch {
    tokenStore.accessToken = localStorage.getItem("access_token");
    tokenStore.refreshToken = localStorage.getItem("refresh_token");
  }
}

async function saveTokens(accessToken: string, refreshToken: string) {
  tokenStore.accessToken = accessToken;
  tokenStore.refreshToken = refreshToken;
  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("auth.json");
    await store.set("access_token", accessToken);
    await store.set("refresh_token", refreshToken);
    await store.save();
  } catch {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
  }
}

async function clearTokens() {
  tokenStore.accessToken = null;
  tokenStore.refreshToken = null;
  try {
    const { Store } = await import("@tauri-apps/plugin-store");
    const store = await Store.load("auth.json");
    await store.delete("access_token");
    await store.delete("refresh_token");
    await store.save();
  } catch {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
}

export function getAccessToken(): string | null {
  return tokenStore.accessToken;
}

initApiClient({
  baseUrl: API_URL,
  wsUrl: WS_URL,
  getAccessToken: () => tokenStore.accessToken,
  onTokenExpired: async () => {
    if (tokenStore.refreshToken) {
      try {
        const result = await authApi.refreshToken(tokenStore.refreshToken);
        await saveTokens(result.accessToken, result.refreshToken);
        return;
      } catch {}
    }
    await clearTokens();
    window.location.href = "/auth/login";
  },
});

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (loginStr: string, password: string) => Promise<User>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthCtx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await loadTokens();
      if (tokenStore.accessToken) {
        try {
          const u = await authApi.getMe();
          setUser(u);
        } catch {
          await clearTokens();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (loginStr: string, password: string) => {
    const result = await authApi.login({ login: loginStr, password });
    await saveTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string) => {
    await authApi.signup({ username, email, password });
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    await clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
