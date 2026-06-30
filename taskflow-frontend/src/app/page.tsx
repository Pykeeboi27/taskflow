"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/Common/Button";
import { PageLoader } from "@/components/Common/Loading";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <section className="max-w-xl text-center">
        <h1 className="text-4xl font-bold text-gray-900">Manage your tasks, effortlessly.</h1>
        <p className="mt-3 text-lg text-gray-500">
          TaskFlow helps you stay organized and productive.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" onClick={() => router.push("/auth/register")}>
            Get Started
          </Button>
          <Button variant="ghost" size="lg" onClick={() => router.push("/auth/login")}>
            Login
          </Button>
        </div>
      </section>
    </main>
  );
}
