"use client";

import { useAuth } from "@/hooks/useAuth";
import { useTaskContext } from "@/context/TaskContext";
import TaskList from "@/components/Tasks/TaskList";

function StatCard({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className="bg-canvas-raised border border-line rounded-xl px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
        {label}
      </p>
      <p className={`text-2xl sm:text-3xl font-bold mt-1 ${colorClass}`}>
        {count}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { total, pendingCount, completedCount } = useTaskContext();
  const displayName = user?.email?.split("@")[0] ?? "there";

  return (
    <div className="px-4 py-4 sm:px-8 sm:py-6">
      <p className="text-sm text-ink-dim mb-5">
        Good work, <span className="text-ink font-medium">{displayName}</span>
      </p>

      <div className="grid grid-cols-3 gap-2 mb-6 sm:gap-4 sm:mb-8">
        <StatCard label="Total" count={total} colorClass="text-ink" />
        <StatCard label="Pending" count={pendingCount} colorClass="text-warn" />
        <StatCard
          label="Done"
          count={completedCount}
          colorClass="text-success"
        />
      </div>

      <TaskList />
    </div>
  );
}
