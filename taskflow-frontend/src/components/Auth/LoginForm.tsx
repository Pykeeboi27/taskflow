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
  return "Check your email and password and try again.";
}

export default function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(undefined);
    setPasswordError(undefined);
    setFormError(null);

    let hasError = false;
    if (!email.trim()) {
      setEmailError("Email is required.");
      hasError = true;
    }
    if (!password.trim()) {
      setPasswordError("Password is required.");
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);
    try {
      await auth.login(email, password);
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
        <h1 className="text-2xl font-bold text-ink tracking-tight">Sign in</h1>
        <p className="text-sm text-ink-dim mt-1">Welcome back. Let&apos;s get to work.</p>
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
          placeholder="••••••••"
          error={passwordError}
          autoComplete="current-password"
        />
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      <p className="text-sm text-ink-dim">
        No account?{" "}
        <Link href="/auth/register" className="text-brand font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
