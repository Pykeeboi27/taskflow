import type {
  ApiError,
  AuthResponse,
  CreateTaskPayload,
  Task,
  TaskListResponse,
  UpdateTaskPayload,
} from "@/types";

export const BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1";

const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

type ApiErrorResponse = ApiError;

type ApiRequestOptions = {
  retryOn401?: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function getStoredToken(key: string) {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(key);
}

function setStoredToken(key: string, value: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, value);
}

function clearStoredTokens() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function redirectToLogin() {
  if (!isBrowser()) {
    return;
  }

  window.location.href = "/auth/login";
}

function buildUrl(
  endpoint: string,
  query?: Record<string, string | number | undefined>,
) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(`${base}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseErrorResponse(
  response: Response,
): Promise<ApiErrorResponse> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    // FastAPI wraps error details under a "detail" key.
    // Guard against detail being a plain string (e.g. generic 401 from auth middleware).
    const detail =
      body && typeof body.detail === "object" && body.detail !== null
        ? (body.detail as Record<string, unknown>)
        : body;

    return {
      error:
        typeof detail?.error === "string" ? detail.error : "Request failed",
      message:
        typeof detail?.message === "string"
          ? detail.message
          : (response.statusText ?? "Request failed"),
      field: typeof detail?.field === "string" ? detail.field : undefined,
    };
  } catch {
    return {
      error: "Request failed",
      message: response.statusText || "Request failed",
    };
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function refreshTokensInternal() {
  const refreshToken = getStoredToken(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    clearStoredTokens();
    redirectToLogin();
    throw {
      error: "Unauthorized",
      message: "Refresh token not found",
    } satisfies ApiErrorResponse;
  }

  const response = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearStoredTokens();
    redirectToLogin();
    throw await parseErrorResponse(response);
  }

  const tokens = (await response.json()) as AuthResponse;

  setStoredToken(AUTH_TOKEN_KEY, tokens.access_token);
  setStoredToken(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const retryOn401 = options.retryOn401 ?? true;
  const authToken = getStoredToken(AUTH_TOKEN_KEY);

  const headers: Record<string, string> = {};

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let requestBody: BodyInit | undefined;

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(endpoint), {
    method,
    headers,
    body: requestBody,
  });

  if (response.status === 401 && retryOn401 && !endpoint.startsWith("/auth/")) {
    try {
      await refreshTokensInternal();
    } catch (error) {
      throw error;
    }

    return apiRequest<T>(method, endpoint, body, { retryOn401: false });
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return readJson<T>(response);
}

export async function register(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("POST", "/auth/register", {
    email,
    password,
  });

  setStoredToken(AUTH_TOKEN_KEY, response.access_token);
  setStoredToken(REFRESH_TOKEN_KEY, response.refresh_token);

  return response;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>("POST", "/auth/login", {
    email,
    password,
  });

  setStoredToken(AUTH_TOKEN_KEY, response.access_token);
  setStoredToken(REFRESH_TOKEN_KEY, response.refresh_token);

  return response;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>("POST", "/auth/logout");
  } finally {
    clearStoredTokens();
  }
}

export async function getTasks(
  page: number,
  limit: number,
  status?: string,
): Promise<TaskListResponse> {
  const query: Record<string, string | number | undefined> = {
    page,
    limit,
    status,
  };

  const endpoint = buildUrl("/tasks", query).slice(BASE_URL.length);

  return apiRequest<TaskListResponse>("GET", endpoint);
}

export async function createTask(
  title: string,
  description?: string,
): Promise<Task> {
  return apiRequest<Task>("POST", "/tasks", {
    title,
    description,
  } satisfies CreateTaskPayload);
}

export async function updateTask(
  id: string,
  payload: UpdateTaskPayload,
): Promise<Task> {
  return apiRequest<Task>("PUT", `/tasks/${id}`, payload);
}

export async function deleteTask(id: string): Promise<void> {
  await apiRequest<void>("DELETE", `/tasks/${id}`);
}

export async function refreshTokens(): Promise<void> {
  await refreshTokensInternal();
}

const api = {
  apiRequest,
  register,
  login,
  logout,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  refreshTokens,
};

export default api;
