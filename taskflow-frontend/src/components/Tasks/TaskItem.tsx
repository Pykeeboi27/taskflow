"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/Common/Button";
import Modal from "@/components/Common/Modal";
import { useTaskContext } from "@/context/TaskContext";
import { useToast } from "@/context/ToastContext";
import type { Task } from "@/types";

type TaskItemProps = {
  task: Task;
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (Number.isNaN(date.getTime()) || diffSeconds < 0) return "just now";
  if (diffSeconds < 60)
    return diffSeconds <= 5 ? "just now" : `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function TaskItem({ task }: TaskItemProps) {
  const { updateTask, deleteTask } = useTaskContext();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(
    task.description ?? "",
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isCompleted = task.status === "completed";

  const handleToggleStatus = async () => {
    setIsUpdating(true);
    try {
      await updateTask(task.id, {
        status: isCompleted ? "pending" : "completed",
      });
    } catch {
      addToast("Failed to update task.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;
    setIsUpdating(true);
    try {
      await updateTask(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
      addToast("Task updated.", "success");
    } catch {
      addToast("Failed to update task.", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      addToast("Task deleted.", "info");
    } catch {
      addToast("Failed to delete task.", "error");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <div
        className="group bg-canvas-raised rounded-xl border border-line shadow-card hover:shadow-raised transition-shadow duration-150"
        style={{
          borderLeftWidth: "3px",
          borderLeftColor: isCompleted
            ? "var(--color-success)"
            : "var(--color-warn)",
        }}
      >
        {isEditing ? (
          <div className="px-5 py-4 space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-canvas-input focus:outline-none focus:ring-2 focus:ring-brand focus:border-line-strong"
              placeholder="Task title"
              autoFocus
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-canvas-input focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              placeholder="Description (optional)"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdating}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className={`text-sm font-medium leading-snug ${
                  isCompleted ? "line-through text-ink-muted" : "text-ink"
                }`}
              >
                {task.title}
              </h3>
              {task.description ? (
                <p className="mt-1 text-[13px] text-ink-dim line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              ) : null}
              <time
                dateTime={task.created_at}
                title={new Date(task.created_at).toLocaleString()}
                className="mt-2 block text-[11px] text-ink-muted"
              >
                {formatRelativeTime(task.created_at)}
              </time>
            </div>

            {/* Action tray — revealed on hover / focus-within */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  isCompleted ? "Mark as pending" : "Mark as complete"
                }
                isLoading={isUpdating}
                onClick={handleToggleStatus}
              >
                {isCompleted ? (
                  <Circle
                    size={14}
                    className="text-ink-muted"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    size={14}
                    className="text-success"
                    aria-hidden="true"
                  />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit task"
                onClick={() => {
                  setEditTitle(task.title);
                  setEditDescription(task.description ?? "");
                  setIsEditing(true);
                }}
                disabled={isUpdating || isDeleting}
              >
                <Pencil size={13} className="text-ink-dim" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete task"
                onClick={() => setShowDeleteModal(true)}
                disabled={isUpdating || isDeleting}
              >
                <Trash2 size={13} className="text-danger" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete task?"
      >
        <p className="text-sm text-ink-dim mb-5">
          &ldquo;{task.title}&rdquo; will be permanently removed.
        </p>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isDeleting}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
