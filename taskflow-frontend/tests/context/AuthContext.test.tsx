import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

import { useRouter } from "next/navigation";
import { login as apiLogin, logout as apiLogout, register as apiRegister } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a base64url-encoded JWT payload so we can test AuthProvider's
 * token-reading logic without touching any source file.
 */
function makeToken(
  payload: Record<string, unknown>,
  expired = false,
): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    exp: expired ? now - 60 : now + 3600,
    ...payload,
  };
  const json = JSON.stringify(claims);
  const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `eyJhbGciOiJIUzI1NiJ9.${b64}.sig`;
}

const VALID_TOKEN = makeToken({ user_id: "u123", email: "test@example.com" });
const EXPIRED_TOKEN = makeToken({ user_id: "u123", email: "test@example.com" }, true);

// ---------------------------------------------------------------------------
// Test consumer
// ---------------------------------------------------------------------------

function AuthConsumer() {
  const { user, isAuthenticated, isLoading, login, register, logout } =
    useAuthContext();

  if (isLoading) {
    return <div data-testid="loading">loading</div>;
  }

  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="user-id">{user?.id ?? "none"}</div>
      <div data-testid="user-email">{user?.email ?? "none"}</div>
      <button onClick={() => void login("test@example.com", "pass")}>login</button>
      <button onClick={() => void register("test@example.com", "pass")}>register</button>
      {/* .catch prevents the re-thrown error from try/finally reaching the
          global unhandled-rejection handler when apiLogout is mocked to reject */}
      <button onClick={() => void logout().catch(() => undefined)}>logout</button>
    </div>
  );
}

function renderAuth() {
  render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("AuthContext", () => {
  const user = userEvent.setup({ delay: null });
  const mockReplace = vi.fn();
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({
      replace: mockReplace,
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as ReturnType<typeof useRouter>);
  });

  // -------------------------------------------------------------------------
  // Initial token reading (useEffect on mount)
  // -------------------------------------------------------------------------

  it("shows unauthenticated state when no token is in localStorage", async () => {
    renderAuth();
    await screen.findByTestId("authenticated");

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("user-id")).toHaveTextContent("none");
  });

  it("authenticates the user from a valid unexpired token", async () => {
    localStorage.setItem("auth_token", VALID_TOKEN);
    renderAuth();
    await screen.findByTestId("authenticated");

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("user-id")).toHaveTextContent("u123");
    expect(screen.getByTestId("user-email")).toHaveTextContent("test@example.com");
  });

  it("rejects an expired token and removes it from localStorage", async () => {
    localStorage.setItem("auth_token", EXPIRED_TOKEN);
    renderAuth();
    await screen.findByTestId("authenticated");

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("rejects a malformed token (fewer than 3 segments) and removes it", async () => {
    localStorage.setItem("auth_token", "not.a.valid.jwt.at.all");
    renderAuth();
    await screen.findByTestId("authenticated");

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("rejects a token missing required user_id/email claims", async () => {
    const badToken = makeToken({ sub: "no-user-id" });
    localStorage.setItem("auth_token", badToken);
    renderAuth();
    await screen.findByTestId("authenticated");

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------

  it("login() sets user from the auth response (userFromAuthResponse mapping)", async () => {
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      user_id: "login_user",
      email: "login@example.com",
    });

    renderAuth();
    await screen.findByTestId("authenticated");

    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("login_user");
      expect(screen.getByTestId("user-email")).toHaveTextContent("login@example.com");
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
  });

  // -------------------------------------------------------------------------
  // register()
  // -------------------------------------------------------------------------

  it("register() sets user from the auth response", async () => {
    vi.mocked(apiRegister).mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      user_id: "reg_user",
      email: "reg@example.com",
    });

    renderAuth();
    await screen.findByTestId("authenticated");

    await user.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() => {
      expect(screen.getByTestId("user-id")).toHaveTextContent("reg_user");
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    });
  });

  // -------------------------------------------------------------------------
  // logout()
  // -------------------------------------------------------------------------

  it("logout() clears the user and calls router.replace('/auth/login')", async () => {
    localStorage.setItem("auth_token", VALID_TOKEN);
    vi.mocked(apiLogout).mockResolvedValue(undefined);

    renderAuth();
    await screen.findByTestId("authenticated");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("user-id")).toHaveTextContent("none");
      expect(mockReplace).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("logout() still clears user even when apiLogout throws", async () => {
    localStorage.setItem("auth_token", VALID_TOKEN);
    vi.mocked(apiLogout).mockRejectedValue(new Error("Network error"));

    renderAuth();
    await screen.findByTestId("authenticated");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "logout" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    });
  });

  // -------------------------------------------------------------------------
  // useAuthContext safety guard
  // -------------------------------------------------------------------------

  it("useAuthContext throws when used outside AuthProvider", () => {
    function BadConsumer() {
      useAuthContext();
      return null;
    }
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    expect(() => render(<BadConsumer />)).toThrow(
      "useAuthContext must be used within an AuthProvider",
    );
    consoleSpy.mockRestore();
  });
});
