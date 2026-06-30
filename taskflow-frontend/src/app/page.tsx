"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Layers, Zap } from "lucide-react";

import Button from "@/components/Common/Button";
import { PageLoader } from "@/components/Common/Loading";
import { useAuth } from "@/hooks/useAuth";

function LogoMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="6" fill="var(--color-brand)" />
      <path
        d="M7 8h10M7 12h6M7 16h8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const features = [
  {
    icon: <CheckCircle2 size={18} className="text-brand" aria-hidden="true" />,
    title: "Track anything",
    body: "Create tasks in seconds. No required fields, no friction.",
  },
  {
    icon: <Layers size={18} className="text-brand" aria-hidden="true" />,
    title: "Stay organized",
    body: "Filter by status, see what's pending, close what's done.",
  },
  {
    icon: <Zap size={18} className="text-brand" aria-hidden="true" />,
    title: "Move fast",
    body: "A clean interface that gets out of your way.",
  },
];

export default function Home() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-8 py-4 bg-canvas-raised border-b border-line">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-sm font-semibold text-ink">TaskFlow</span>
        </div>
        <Link
          href="/auth/login"
          className="text-sm text-ink-dim hover:text-ink transition-colors font-medium"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-lg">
          <h1 className="text-[2.5rem] font-bold text-ink leading-tight tracking-tight">
            Get your work out of your head.
          </h1>
          <p className="mt-4 text-base text-ink-dim leading-relaxed">
            A focused, minimal task manager — no clutter, no busywork.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => router.push("/auth/register")}>
              Get started free
            </Button>
            <Link
              href="/auth/login"
              className="text-sm text-ink-dim hover:text-ink font-medium transition-colors"
            >
              Sign in →
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl w-full text-left">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col gap-2">
              {f.icon}
              <p className="text-sm font-semibold text-ink">{f.title}</p>
              <p className="text-sm text-ink-dim">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-ink-muted border-t border-line">
        © {new Date().getFullYear()} TaskFlow
      </footer>
    </div>
  );
}
