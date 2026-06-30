"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import Button from "@/components/Common/Button";
import Input from "@/components/Common/Input";
import { useAuth } from "@/hooks/useAuth";

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Registration failed. Please try again.";
}

function isValidEmail(email: string) {
  return email.includes("@") && email.includes(".");
}

export default function RegisterForm() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);
    setFormError(null);

    let hasError = false;
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      hasError = true;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      hasError = true;
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);
    try {
      await auth.register(email, password);
      router.push("/dashboard");
    } catch (caughtError) {
      setFormError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Create account</h1>
        <p className="text-sm text-ink-dim mt-1">Get started — it only takes a moment.</p>
      </div>

      {formError ? (
        <div
          role="alert"
          className="bg-danger-tint border border-danger/20 text-danger text-sm rounded-lg px-4 py-3"
        >
          {formError}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(undefined);
          }}
          placeholder="you@example.com"
          error={emailError}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPasswordError(undefined);
          }}
          placeholder="At least 8 characters"
          error={passwordError}
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setConfirmError(undefined);
          }}
          placeholder="Repeat password"
          error={confirmError}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create account
        </Button>
      </form>

      <p className="text-sm text-ink-dim">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-brand font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
