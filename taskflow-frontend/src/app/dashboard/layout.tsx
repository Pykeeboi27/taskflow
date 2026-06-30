"use client";

import { useState } from "react";
import AuthGuard from "@/components/Auth/AuthGuard";
import Topbar from "@/components/Layout/Topbar";
import Sidebar from "@/components/Layout/Sidebar";
import { TaskProvider } from "@/context/TaskContext";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      <TaskProvider>
        <div className="flex flex-col h-screen bg-canvas">
          <Topbar onMenuClick={() => setMobileSidebarOpen(true)} />

          <div className="flex flex-1 min-h-0">
            {/* Desktop sidebar — always visible */}
            <div className="hidden md:flex">
              <Sidebar />
            </div>

            {/* Mobile sidebar drawer */}
            {mobileSidebarOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/30 md:hidden"
                  aria-hidden="true"
                  onClick={() => setMobileSidebarOpen(false)}
                />
                <div className="fixed inset-y-0 left-0 z-50 md:hidden">
                  <Sidebar onClose={() => setMobileSidebarOpen(false)} />
                </div>
              </>
            ) : null}

            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </TaskProvider>
    </AuthGuard>
  );
}
