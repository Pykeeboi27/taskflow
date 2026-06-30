"use client";

import { useState } from "react";
import Button from "@/components/Common/Button";
import Input from "@/components/Common/Input";
import { useTaskContext } from "@/context/TaskContext";
import { useToast } from "@/context/ToastContext";
import type { ApiError } from "@/types";

type TaskFormProps = {
  onSuccess?: () => void;
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as ApiError).message);
  }
  return "Failed to create task.";
}

export default function TaskForm({ onSuccess }: TaskFormProps) {
  const { createTask } = useTaskContext();
  const { addToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTitleError(undefined);

    if (!title.trim()) {
      setTitleError("Title is required.");
      return;
    }

    setIsLoading(true);
    try {
      await createTask(title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
      addToast("Task created.", "success");
      onSuccess?.();
    } catch (caughtError) {
      addToast(getErrorMessage(caughtError), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="Title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setTitleError(undefined);
        }}
        maxLength={255}
        placeholder="What needs to be done?"
        error={titleError}
        autoFocus
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="task-description"
          className="text-[11px] font-medium tracking-wide uppercase text-ink-dim"
        >
          Description{" "}
          <span className="normal-case font-normal text-ink-muted">
            (optional)
          </span>
        </label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Add details…"
          className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink bg-canvas-input focus:outline-none focus:ring-2 focus:ring-brand focus:border-line-strong resize-none transition"
        />
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full">
        Create task
      </Button>
    </form>
  );
}
