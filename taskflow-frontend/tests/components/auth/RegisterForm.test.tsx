import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterForm from "@/components/Auth/RegisterForm";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockRegister = vi.fn();

function setupMocks() {
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  } as ReturnType<typeof useRouter>);

  vi.mocked(useAuth).mockReturnValue({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: vi.fn(),
    register: mockRegister,
    logout: vi.fn(),
  });
}

async function fillAndSubmit({
  email = "valid@example.com",
  password = "securepass",
  confirmPassword = "securepass",
}: {
  email?: string;
  password?: string;
  confirmPassword?: string;
} = {}) {
  const user = userEvent.setup({ delay: null });
  render(<RegisterForm />);

  if (email) {
    await user.type(screen.getByPlaceholderText("you@example.com"), email);
  }
  if (password) {
    await user.type(
      screen.getByPlaceholderText("At least 8 characters"),
      password,
    );
  }
  if (confirmPassword) {
    await user.type(
      screen.getByPlaceholderText("Repeat password"),
      confirmPassword,
    );
  }

  // fireEvent.submit bypasses jsdom's native type="email" constraint validation
  // so our custom handleSubmit runs its own checks for all test cases.
  const form = screen
    .getByRole("button", { name: /create account/i })
    .closest("form")!;
  fireEvent.submit(form);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("RegisterForm", () => {
  beforeEach(() => {
    setupMocks();
    mockPush.mockReset();
    mockRegister.mockReset();
    mockRegister.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Renders
  // -------------------------------------------------------------------------

  it("renders the form fields and submit button", () => {
    render(<RegisterForm />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("At least 8 characters"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Repeat password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // isValidEmail (no "@" in email)
  // -------------------------------------------------------------------------

  it("shows an email error and does not call register when email has no '@'", async () => {
    await fillAndSubmit({ email: "invalidemail.com" });

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("shows an email error and does not call register when email has no '.'", async () => {
    await fillAndSubmit({ email: "invalid@email" });

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Password length validation (< 8 chars)
  // -------------------------------------------------------------------------

  it("shows a password error when password is shorter than 8 characters", async () => {
    await fillAndSubmit({ password: "short", confirmPassword: "short" });

    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("accepts a password of exactly 8 characters (boundary)", async () => {
    await fillAndSubmit({ password: "exactly8", confirmPassword: "exactly8" });

    await waitFor(() => {
      expect(
        screen.queryByText("Password must be at least 8 characters."),
      ).not.toBeInTheDocument();
    });
    expect(mockRegister).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Password confirmation mismatch
  // -------------------------------------------------------------------------

  it("shows a confirm-password error when passwords do not match", async () => {
    await fillAndSubmit({
      password: "password1",
      confirmPassword: "password2",
    });

    expect(
      await screen.findByText("Passwords do not match."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Multiple simultaneous validation errors
  // -------------------------------------------------------------------------

  it("shows all applicable errors at once when multiple fields are invalid", async () => {
    await fillAndSubmit({
      email: "notvalid",
      password: "short",
      confirmPassword: "different",
    });

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it("calls register with email and password when all fields are valid", async () => {
    await fillAndSubmit({
      email: "user@example.com",
      password: "securepass",
      confirmPassword: "securepass",
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        "user@example.com",
        "securepass",
      );
    });
  });

  it("redirects to /dashboard after a successful registration", async () => {
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling (getErrorMessage)
  // -------------------------------------------------------------------------

  it("displays the error message from a thrown ApiError object", async () => {
    mockRegister.mockRejectedValue({ message: "Email already in use." });
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already in use.",
    );
  });

  it("displays the fallback message when the thrown error has no message", async () => {
    mockRegister.mockRejectedValue("unexpected string error");
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Registration failed. Please try again.",
    );
  });
});
