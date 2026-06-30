"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as api from "@/lib/api";
import type {
  ApiError,
  Task,
  TaskListResponse,
  TaskStatus,
  UpdateTaskPayload,
} from "@/types";

type TaskContextValue = {
  tasks: Task[];
  total: number;
  pendingCount: number;
  completedCount: number;
  page: number;
  pages: number;
  isLoading: boolean;
  error: string | null;
  statusFilter: TaskStatus | undefined;
  fetchTasks: () => Promise<void>;
  setPage: (page: number) => void;
  setStatusFilter: (status: TaskStatus | undefined) => void;
  createTask: (title: string, description?: string) => Promise<Task>;
  updateTask: (id: string, payload: UpdateTaskPayload) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
};

const TaskContext = createContext<TaskContextValue | null>(null);

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return (error as ApiError).message;
  }
  return "Something went wrong";
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [page, setPageState] = useState(1);
  const [pages, setPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilterState] = useState<TaskStatus | undefined>(
    undefined,
  );

  const fetchCounts = useCallback(async () => {
    try {
      const [allResult, pendingResult] = await Promise.all([
        api.getTasks(1, 1, undefined),
        api.getTasks(1, 1, "pending"),
      ]);
      const allTotal = (allResult as TaskListResponse).total;
      const pendingTotal = (pendingResult as TaskListResponse).total;
      setPendingCount(pendingTotal);
      setCompletedCount(allTotal - pendingTotal);
    } catch {
      // sidebar counts are non-critical
    }
  }, []);

  const fetchTasks = useCallback(
    async (
      nextPage = page,
      nextFilter: TaskStatus | undefined = statusFilter,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = (await api.getTasks(
          nextPage,
          PAGE_SIZE,
          nextFilter,
        )) as TaskListResponse;
        setTasks(response.items);
        setTotal(response.total);
        setPageState(response.page);
        setPages(response.pages);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      } finally {
        setIsLoading(false);
      }
    },
    [page, statusFilter],
  );

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void fetchTasks(1, undefined);
    void fetchCounts();
  }, [fetchTasks, fetchCounts]);

  const setPage = (nextPage: number) => {
    setPageState(nextPage);
    void fetchTasks(nextPage, statusFilter);
  };

  const setStatusFilter = (nextFilter: TaskStatus | undefined) => {
    setPageState(1);
    setStatusFilterState(nextFilter);
    void fetchTasks(1, nextFilter);
  };

  const createTask = async (title: string, description?: string) => {
    setError(null);
    try {
      const created = await api.createTask(title, description);
      await fetchTasks(page, statusFilter);
      void fetchCounts();
      return created;
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  const updateTask = async (id: string, payload: UpdateTaskPayload) => {
    setError(null);
    const previousTasks = tasks;
    try {
      if (previousTasks.find((t) => t.id === id)) {
        setTasks((curr) =>
          curr.map((t) => (t.id === id ? { ...t, ...payload } : t)),
        );
      }
      const updated = await api.updateTask(id, payload);
      setTasks((curr) => curr.map((t) => (t.id === id ? updated : t)));
      void fetchCounts();
      return updated;
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
      setTasks((curr) => curr.filter((t) => t.id !== id));
      void fetchCounts();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      throw caughtError;
    }
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        total,
        pendingCount,
        completedCount,
        page,
        pages,
        isLoading,
        error,
        statusFilter,
        fetchTasks: () => fetchTasks(page, statusFilter),
        setPage,
        setStatusFilter,
        createTask,
        updateTask,
        deleteTask,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTaskContext must be used within TaskProvider");
  return ctx;
}
