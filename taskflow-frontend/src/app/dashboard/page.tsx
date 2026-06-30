"use client";

import AuthGuard from "@/components/Auth/AuthGuard";
import TaskList from "@/components/Tasks/TaskList";
import { useAuth } from "@/hooks/useAuth";

function DashboardContent() {
  const { user } = useAuth();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.email}!</h1>
      <p className="text-gray-500 text-sm mt-1 mb-8">Here are your tasks.</p>
      <TaskList />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}