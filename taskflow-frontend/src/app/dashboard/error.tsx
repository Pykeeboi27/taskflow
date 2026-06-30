"use client";

import { useEffect } from "react";

import Button from "@/components/Common/Button";
import Card from "@/components/Common/Card";

export default function DashboardError({
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
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="max-w-md w-full text-center space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Dashboard failed to load
          </h2>
          <p className="text-sm text-gray-500">
            Something went wrong while loading your tasks. Try again — if the
            problem persists, refresh the page.
          </p>
          {error.digest ? (
            <p className="text-xs text-gray-400">Error ID: {error.digest}</p>
          ) : null}
        </div>
        <Button onClick={unstable_retry}>Try again</Button>
      </Card>
    </div>
  );
}
