"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { User } from "@fibeger/api-client";
import { getSession, logout as authLogout, getAccessToken } from "../lib/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
  isAuthenticated: false,
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await getSession();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    window.location.href = "/auth/login";
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  return {
    user,
    loading,
    logout,
    refresh,
    isAuthenticated: !!user,
  };
}
