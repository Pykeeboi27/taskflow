"use client";

import { useEffect } from "react";

import Button from "@/components/Common/Button";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          An unexpected error occurred. You can try again or refresh the page.
        </p>
        {error.digest ? (
          <p className="text-xs text-gray-400">Error ID: {error.digest}</p>
        ) : null}
      </div>
      <Button onClick={unstable_retry}>Try again</Button>
    </div>
  );
}
