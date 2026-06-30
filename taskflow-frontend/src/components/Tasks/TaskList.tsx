"use client";

import TaskFilters from "@/components/Tasks/TaskFilters";
import TaskForm from "@/components/Tasks/TaskForm";
import TaskItem from "@/components/Tasks/TaskItem";
import Button from "@/components/Common/Button";
import Spinner, { PageLoader } from "@/components/Common/Loading";
import { useTasks } from "@/hooks/useTasks";
import type { Task } from "@/types";

type TaskListProps = {
  onTaskCreated?: (task: Task) => void;
};

export default function TaskList({ onTaskCreated }: TaskListProps) {
  const {
    tasks,
    total,
    page,
    limit,
    pages,
    isLoading,
    error,
    statusFilter,
    fetchTasks,
    setPage,
    setLimit,
    setStatusFilter,
    updateTask,
    deleteTask,
  } = useTasks();

  const handleTaskCreated = (task: Task) => {
    onTaskCreated?.(task);
    void fetchTasks();
  };

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = total === 0 ? 0 : Math.min(page * limit, total);
  const totalPages = pages > 0 ? pages : 1;

  return (
    <div className="space-y-6">
      <TaskForm onTaskCreated={handleTaskCreated} />

      <div className="hidden">
        <PageLoader />
      </div>

      <TaskFilters activeFilter={statusFilter} onFilterChange={setStatusFilter} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {tasks.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              No tasks yet. Create your first task above!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onUpdate={updateTask}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-gray-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-gray-500">
              Showing {startItem}–{endItem} of {total} tasks
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>

              <span>
                Page {page} of {totalPages}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-500">
              <span>Per page</span>
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-900"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );
}