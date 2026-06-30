"use client";

import { useEffect, useState } from "react";

import Button from "@/components/Common/Button";
import Card from "@/components/Common/Card";
import Input from "@/components/Common/Input";
import api from "@/lib/api";
import type { ApiError, Task } from "@/types";

type TaskFormProps = {
  onTaskCreated: (task: Task) => void;
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as ApiError).message);
  }

  return "Failed to create task.";
}

export default function TaskForm({ onTaskCreated }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setIsLoading(true);

    try {
      const task = await api.createTask(title.trim(), description.trim() || undefined);

      setTitle("");
      setDescription("");
      onTaskCreated(task);
      setSuccessMessage("Task created!");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Task</h2>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            {successMessage}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error === "Title is required.") {
                setError(null);
              }
            }}
            maxLength={255}
            placeholder="Task title"
            error={error === "Title is required." ? error : undefined}
          />

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <Button type="submit" isLoading={isLoading}>
            Add Task
          </Button>
        </form>
      </div>
    </Card>
  );
}