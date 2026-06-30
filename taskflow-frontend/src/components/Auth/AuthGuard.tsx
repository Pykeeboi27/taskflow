"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { PageLoader } from "@/components/Common/Loading";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

type AuthGuardProps = Readonly<{
  children: ReactNode;
}>;

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push("/auth/login");
    }
  }, [auth.isAuthenticated, auth.isLoading, router]);

  if (auth.isLoading) {
    return <PageLoader />;
  }

  if (!auth.isAuthenticated) {
    return null;
  }

  return children;
}