import { initApiClient, authApi, type User } from "@fibeger/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";

let currentUser: User | null = null;

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  currentUser = null;
}

initApiClient({
  baseUrl: API_URL,
  wsUrl: WS_URL,
  getAccessToken: getAccessToken,
  onTokenExpired: async () => {
    try {
      const rt = localStorage.getItem("refresh_token");
      if (rt) {
        const result = await authApi.refreshToken(rt);
        setTokens(result.accessToken, result.refreshToken);
        return;
      }
    } catch {}
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  },
});

export async function login(loginStr: string, password: string): Promise<User> {
  const result = await authApi.login({ login: loginStr, password });
  setTokens(result.accessToken, result.refreshToken);
  currentUser = result.user;
  return result.user;
}

export async function signup(username: string, email: string, password: string) {
  return authApi.signup({ username, email, password });
}

export async function logout() {
  try {
    await authApi.logout();
  } catch {}
  clearTokens();
  currentUser = null;
}

export async function getSession(): Promise<User | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const user = await authApi.getMe();
    currentUser = user;
    return user;
  } catch {
    clearTokens();
    return null;
  }
}

export function getCurrentUser(): User | null {
  return currentUser;
}
