import type { ApiError } from "./types";

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ClientConfig {
  baseUrl: string;
  wsUrl: string;
  getAccessToken: () => string | null;
  onTokenExpired?: () => void;
}

class ApiClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  getConfig(): ClientConfig {
    return this.config;
  }

  updateConfig(config: Partial<ClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    const token = this.config.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private authHeaders(): HeadersInit {
    const token = this.config.getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { isFormData?: boolean }
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const fetchOptions: RequestInit = {
      method,
      credentials: "include",
    };

    if (options?.isFormData) {
      fetchOptions.headers = this.authHeaders();
      fetchOptions.body = body as FormData;
    } else {
      fetchOptions.headers = this.headers();
      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
      this.config.onTokenExpired?.();
      throw new ApiClientError(401, "unauthorized", "Unauthorized");
    }

    if (!response.ok) {
      try {
        const error: ApiError = await response.json();
        throw new ApiClientError(
          response.status,
          error.error || "unknown_error",
          error.error || "Request failed",
          typeof error.details === "object" ? error.details as Record<string, string> : undefined
        );
      } catch (e) {
        if (e instanceof ApiClientError) throw e;
        const text = await response.text().catch(() => "");
        throw new ApiClientError(response.status, "unknown_error", text || "Request failed");
      }
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("DELETE", path, body);
  }

  upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>("POST", path, formData, { isFormData: true });
  }
}

let clientInstance: ApiClient | null = null;

export function initApiClient(config: ClientConfig): ApiClient {
  clientInstance = new ApiClient(config);
  return clientInstance;
}

export function getApiClient(): ApiClient {
  if (!clientInstance) {
    throw new Error(
      "API client not initialized. Call initApiClient() first."
    );
  }
  return clientInstance;
}
