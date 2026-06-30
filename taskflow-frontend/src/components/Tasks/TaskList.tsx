"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Plus } from "lucide-react";
import TaskItem from "@/components/Tasks/TaskItem";
import TaskForm from "@/components/Tasks/TaskForm";
import Sheet from "@/components/Common/Sheet";
import Button from "@/components/Common/Button";
import { SkeletonCard } from "@/components/Common/Loading";
import { useTaskContext } from "@/context/TaskContext";

export default function TaskList() {
  const { tasks, total, page, pages, isLoading, error, setPage } = useTaskContext();
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalPages = pages > 0 ? pages : 1;

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink tracking-tight">Tasks</h1>
          <p className="text-xs text-ink-muted mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus size={14} aria-hidden="true" />
          New Task
        </Button>
      </div>

      {/* Error */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger mb-4"
        >
          {error}
        </div>
      ) : null}

      {/* Task list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 gap-4">
          <ClipboardList size={40} className="text-ink-muted" aria-hidden="true" />
          <div className="text-center">
            <p className="text-sm font-medium text-ink">No tasks yet</p>
            <p className="text-xs text-ink-dim mt-1">Create your first task to get started.</p>
          </div>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            <Plus size={13} aria-hidden="true" />
            New Task
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-4 border-t border-line pt-4 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Previous
              </Button>
              <span className="text-sm text-ink-muted tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                Next
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="New Task">
        <TaskForm onSuccess={() => setSheetOpen(false)} />
      </Sheet>
    </>
  );
}
