"use client";

import Button from "@/components/Common/Button";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const auth = useAuth();

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-xl font-bold text-blue-600">TaskFlow</div>
        {auth.isAuthenticated ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{auth.user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void auth.logout()}
            >
              Logout
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
