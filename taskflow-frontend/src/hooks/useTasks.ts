"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import * as api from "@/lib/api";
import type { ApiError, Task, TaskListResponse, TaskStatus, UpdateTaskPayload } from "@/types";

type UseTasksResult = {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  isLoading: boolean;
  error: string | null;
  statusFilter: TaskStatus | undefined;
  fetchTasks: () => Promise<void>;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setStatusFilter: (status: TaskStatus | undefined) => void;
  createTask: (title: string, description?: string) => Promise<Task>;
  updateTask: (id: string, payload: UpdateTaskPayload) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const apiError = error as ApiError;

    return apiError.message;
  }

  return "Something went wrong";
}

export function useTasks(initialPage = 1, initialLimit = 10): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(initialPage);
  const [limit, setLimitState] = useState(initialLimit);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState<TaskStatus | undefined>(undefined);

  const fetchTasks = useCallback(
    async (
      nextPage = page,
      nextLimit = limit,
      nextStatusFilter: TaskStatus | undefined = statusFilter,
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = (await api.getTasks(
          nextPage,
          nextLimit,
          nextStatusFilter,
        )) as TaskListResponse;

        setTasks(response.items);
        setTotal(response.total);
        setPageState(response.page);
        setLimitState(response.limit);
        setPages(response.pages);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      } finally {
        setIsLoading(false);
      }
    },
    [limit, page, statusFilter],
  );

  // Guard to run only once on mount. Without this, every page/filter change
  // rebuilds fetchTasks (its useCallback deps include page/statusFilter),
  // which causes the effect to re-fire and snap pagination back to page 1.
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void fetchTasks(initialPage, initialLimit, undefined);
  }, [fetchTasks, initialLimit, initialPage]);

  const setPage = (nextPage: number) => {
    setPageState(nextPage);
    void fetchTasks(nextPage, limit, statusFilter);
  };

  const setLimit = (nextLimit: number) => {
    setPageState(1);
    setLimitState(nextLimit);
    void fetchTasks(1, nextLimit, statusFilter);
  };

  const setStatusFilter = (nextStatusFilter: TaskStatus | undefined) => {
    setPageState(1);
    setStatusFilterState(nextStatusFilter);
    void fetchTasks(1, limit, nextStatusFilter);
  };

  const createTask = async (title: string, description?: string) => {
    setError(null);

    try {
      const createdTask = await api.createTask(title, description);
      await fetchTasks(page, limit, statusFilter);

      return createdTask;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  const updateTask = async (id: string, payload: UpdateTaskPayload) => {
    setError(null);

    const previousTasks = tasks;

    try {
      const optimisticTask = previousTasks.find((task) => task.id === id);

      if (optimisticTask) {
        setTasks((currentTasks) =>
          currentTasks.map((task) => (task.id === id ? { ...task, ...payload } : task)),
        );
      }

      const updatedTask = await api.updateTask(id, payload);
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === id ? updatedTask : task)),
      );

      return updatedTask;
    } catch (caughtError) {
      setTasks(previousTasks);
      setError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  const deleteTask = async (id: string) => {
    setError(null);

    try {
      await api.deleteTask(id);
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  return {
    tasks,
    total,
    page,
    limit,
    pages,
    isLoading,
    error,
    statusFilter,
    fetchTasks: () => fetchTasks(page, limit, statusFilter),
    setPage,
    setLimit,
    setStatusFilter,
    createTask,
    updateTask,
    deleteTask,
  };
}