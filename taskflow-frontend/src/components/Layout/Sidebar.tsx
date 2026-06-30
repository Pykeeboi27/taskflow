"use client";

import { X } from "lucide-react";
import { useTaskContext } from "@/context/TaskContext";
import type { TaskStatus } from "@/types";

const filters: Array<{ label: string; value: TaskStatus | undefined }> = [
  { label: "All tasks", value: undefined },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
];

type SidebarProps = {
  onClose?: () => void;
};

export default function Sidebar({ onClose }: SidebarProps) {
  const { statusFilter, setStatusFilter, total, pendingCount, completedCount } =
    useTaskContext();

  const counts: Record<string, number> = {
    "All tasks": total,
    Pending: pendingCount,
    Completed: completedCount,
  };

  return (
    <aside className="w-52 shrink-0 border-r border-line bg-canvas-raised flex flex-col h-full">
      {/* Mobile close button */}
      {onClose ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-line md:hidden">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-widest">
            Menu
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors p-1"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <nav className="flex-1 px-3 py-4" aria-label="Task filters">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted px-2 mb-2">
          Filters
        </p>
        <ul role="list" className="space-y-0.5">
          {filters.map((filter) => {
            const isActive = statusFilter === filter.value;
            const count = counts[filter.label] ?? 0;

            return (
              <li key={filter.label}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    onClose?.();
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-brand-soft text-brand-fg font-medium border-l-2 border-brand pl-[calc(0.5rem-2px)]"
                      : "text-ink-dim hover:bg-canvas-input hover:text-ink"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`text-xs tabular-nums ${isActive ? "text-brand-fg" : "text-ink-muted"}`}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
