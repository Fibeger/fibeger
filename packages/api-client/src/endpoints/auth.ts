import { getApiClient } from "../client";
import type { AuthTokens, LoginRequest, SignupRequest, User } from "../types";

export function login(data: LoginRequest): Promise<AuthTokens> {
  return getApiClient().post<AuthTokens>("/api/auth/login", data);
}

export function signup(data: SignupRequest): Promise<{ message: string }> {
  return getApiClient().post("/api/auth/signup", data);
}

export function refreshToken(refreshToken: string): Promise<AuthTokens> {
  return getApiClient().post<AuthTokens>("/api/auth/refresh", { refreshToken });
}

export function logout(): Promise<void> {
  return getApiClient().post("/api/auth/logout");
}

export function getMe(): Promise<User> {
  return getApiClient().get<User>("/api/auth/me");
}
