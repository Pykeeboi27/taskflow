import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BASE_URL,
  apiRequest,
  getTasks,
  login,
  logout,
  register,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Response whose body is JSON. */
function jsonRes(body: unknown, status: number, statusText = "OK") {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a Response with no body (e.g. 204, bare 401). */
function emptyRes(status: number, statusText = "") {
  return new Response(null, { status, statusText });
}

/** Minimal TaskListResponse shape for getTasks mocks. */
const TASK_LIST = { items: [], total: 0, page: 1, limit: 20, pages: 0 };

/** Minimal AuthResponse shape. */
function authRes(
  overrides: Partial<{
    access_token: string;
    refresh_token: string;
    user_id: string;
    email: string;
  }> = {},
) {
  return {
    access_token: "at",
    refresh_token: "rt",
    user_id: "u1",
    email: "test@example.com",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("src/lib/api.ts", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    // Prevent jsdom "Not implemented: navigation" errors from redirectToLogin().
    vi.stubGlobal("location", { href: "" });
  });

  // -------------------------------------------------------------------------
  // BASE_URL
  // -------------------------------------------------------------------------

  describe("BASE_URL", () => {
    it("uses the fallback URL when NEXT_PUBLIC_API_URL is not set", () => {
      expect(BASE_URL).toBe("http://localhost:8000/api/v1");
    });
  });

  // -------------------------------------------------------------------------
  // buildUrl (tested indirectly via apiRequest / getTasks)
  // -------------------------------------------------------------------------

  describe("buildUrl – indirect", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(jsonRes({}, 200));
    });

    it("constructs the full URL for an endpoint with a leading slash", async () => {
      await apiRequest("GET", "/tasks");
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/tasks`,
        expect.any(Object),
      );
    });

    it("adds a leading slash when the endpoint omits it", async () => {
      await apiRequest("GET", "tasks");
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/tasks`,
        expect.any(Object),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getTasks – URL construction + slice
  // -------------------------------------------------------------------------

  describe("getTasks", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(jsonRes(TASK_LIST, 200));
    });

    it("includes page and limit as query params", async () => {
      await getTasks(2, 10);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("omits status when it is undefined", async () => {
      await getTasks(1, 20, undefined);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("status");
    });

    it("includes status when it is provided", async () => {
      await getTasks(1, 20, "pending");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=pending");
    });

    it("slice(BASE_URL.length) reconstructs the relative endpoint correctly", async () => {
      await getTasks(3, 5, "completed");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe(`${BASE_URL}/tasks?page=3&limit=5&status=completed`);
    });
  });

  // -------------------------------------------------------------------------
  // apiRequest – headers
  // -------------------------------------------------------------------------

  describe("apiRequest – headers", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(jsonRes({ ok: true }, 200));
    });

    it("omits Authorization when no token is stored", async () => {
      await apiRequest("GET", "/tasks");
      const headers = mockFetch.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers).not.toHaveProperty("Authorization");
    });

    it("sends Authorization: Bearer <token> when a token is stored", async () => {
      localStorage.setItem("auth_token", "my_jwt");
      await apiRequest("GET", "/tasks");
      const headers = mockFetch.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["Authorization"]).toBe("Bearer my_jwt");
    });

    it("omits Content-Type when no body is provided", async () => {
      await apiRequest("GET", "/tasks");
      const headers = mockFetch.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers).not.toHaveProperty("Content-Type");
    });

    it("sets Content-Type: application/json when a body is provided", async () => {
      await apiRequest("POST", "/tasks", { title: "My task" });
      const headers = mockFetch.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  // -------------------------------------------------------------------------
  // apiRequest – 204 No Content
  // -------------------------------------------------------------------------

  describe("apiRequest – 204 response", () => {
    it("returns undefined on 204 No Content", async () => {
      mockFetch.mockResolvedValue(emptyRes(204));
      const result = await apiRequest("DELETE", "/tasks/1");
      expect(result).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // parseErrorResponse (tested indirectly via thrown errors)
  // -------------------------------------------------------------------------

  describe("parseErrorResponse – indirect", () => {
    it("unwraps FastAPI detail object → { error, message, field }", async () => {
      mockFetch.mockResolvedValue(
        jsonRes(
          {
            detail: {
              error: "ValidationError",
              message: "Invalid input",
              field: "email",
            },
          },
          422,
          "Unprocessable Entity",
        ),
      );
      await expect(apiRequest("GET", "/profile")).rejects.toEqual({
        error: "ValidationError",
        message: "Invalid input",
        field: "email",
      });
    });

    it("falls back to body-level fields when detail is a string", async () => {
      mockFetch.mockResolvedValue(
        jsonRes(
          {
            detail: "Unauthorized",
            error: "AuthError",
            message: "Not authenticated",
          },
          403,
          "Forbidden",
        ),
      );
      await expect(apiRequest("GET", "/profile")).rejects.toEqual(
        expect.objectContaining({
          error: "AuthError",
          message: "Not authenticated",
        }),
      );
    });

    it("falls back to statusText when body has no error/message fields", async () => {
      mockFetch.mockResolvedValue(
        jsonRes({ some_other_key: "value" }, 400, "Bad Request"),
      );
      await expect(apiRequest("GET", "/profile")).rejects.toMatchObject({
        error: "Request failed",
        message: "Bad Request",
      });
    });

    it("falls back to statusText when response is not valid JSON", async () => {
      mockFetch.mockResolvedValue(
        new Response("not-json", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );
      await expect(apiRequest("GET", "/profile")).rejects.toMatchObject({
        error: "Request failed",
        message: "Internal Server Error",
      });
    });
  });

  // -------------------------------------------------------------------------
  // 401 retry logic
  // -------------------------------------------------------------------------

  describe("apiRequest – 401 refresh-and-retry", () => {
    it("retries once after a successful token refresh", async () => {
      localStorage.setItem("refresh_token", "stored_rt");

      mockFetch
        .mockResolvedValueOnce(emptyRes(401))
        .mockResolvedValueOnce(
          jsonRes({ access_token: "new_at", refresh_token: "new_rt" }, 200),
        )
        .mockResolvedValueOnce(jsonRes({ id: "t1" }, 200));

      const result = await apiRequest<{ id: string }>("GET", "/tasks/t1");

      expect(result).toEqual({ id: "t1" });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(localStorage.getItem("auth_token")).toBe("new_at");
      expect(localStorage.getItem("refresh_token")).toBe("new_rt");
    });

    it("does NOT retry on 401 for /auth/ endpoints", async () => {
      mockFetch.mockResolvedValue(
        jsonRes(
          { detail: { error: "Unauthorized", message: "Bad credentials" } },
          401,
          "Unauthorized",
        ),
      );

      await expect(apiRequest("POST", "/auth/login", {})).rejects.toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws when no refresh token is stored on a 401", async () => {
      mockFetch.mockResolvedValueOnce(emptyRes(401));

      await expect(apiRequest("GET", "/tasks")).rejects.toMatchObject({
        error: "Unauthorized",
        message: "Refresh token not found",
      });
    });

    it("clears tokens and throws when the refresh request itself fails", async () => {
      localStorage.setItem("auth_token", "old_at");
      localStorage.setItem("refresh_token", "old_rt");

      mockFetch
        .mockResolvedValueOnce(emptyRes(401))
        .mockResolvedValueOnce(
          jsonRes(
            { detail: { error: "Unauthorized", message: "Refresh expired" } },
            401,
            "Unauthorized",
          ),
        );

      await expect(apiRequest("GET", "/tasks")).rejects.toBeDefined();
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  describe("login", () => {
    it("persists access_token and refresh_token to localStorage on success", async () => {
      mockFetch.mockResolvedValue(
        jsonRes(
          authRes({ access_token: "login_at", refresh_token: "login_rt" }),
          200,
        ),
      );

      await login("test@example.com", "password");

      expect(localStorage.getItem("auth_token")).toBe("login_at");
      expect(localStorage.getItem("refresh_token")).toBe("login_rt");
    });

    it("returns the AuthResponse from the API", async () => {
      const response = authRes({ access_token: "at2", refresh_token: "rt2" });
      mockFetch.mockResolvedValue(jsonRes(response, 200));

      const result = await login("test@example.com", "password");
      expect(result.access_token).toBe("at2");
      expect(result.email).toBe("test@example.com");
    });
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe("register", () => {
    it("persists access_token and refresh_token to localStorage on success", async () => {
      mockFetch.mockResolvedValue(
        jsonRes(
          authRes({ access_token: "reg_at", refresh_token: "reg_rt" }),
          201,
        ),
      );

      await register("new@example.com", "password123");

      expect(localStorage.getItem("auth_token")).toBe("reg_at");
      expect(localStorage.getItem("refresh_token")).toBe("reg_rt");
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------

  describe("logout", () => {
    it("clears tokens from localStorage on a successful logout", async () => {
      localStorage.setItem("auth_token", "at");
      localStorage.setItem("refresh_token", "rt");
      mockFetch.mockResolvedValue(emptyRes(204));

      await logout();

      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });

    it("still clears tokens even when the API call throws", async () => {
      localStorage.setItem("auth_token", "at");
      localStorage.setItem("refresh_token", "rt");
      mockFetch.mockResolvedValue(
        jsonRes(
          { detail: { error: "Error", message: "Server Error" } },
          500,
          "Internal Server Error",
        ),
      );

      await expect(logout()).rejects.toBeDefined();

      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });
  });
});
