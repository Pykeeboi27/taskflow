"use client";

import { useMemo, useState } from "react";

import Button from "@/components/Common/Button";
import Card from "@/components/Common/Card";
import type { Task, UpdateTaskPayload } from "@/types";

type TaskItemProps = {
  task: Task;
  onUpdate: (id: string, payload: UpdateTaskPayload) => Promise<Task>;
  onDelete: (id: string) => Promise<void>;
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (Number.isNaN(date.getTime()) || diffSeconds < 0) {
    return "just now";
  }

  if (diffSeconds < 60) {
    return diffSeconds <= 5 ? "just now" : `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) {
    return diffWeeks === 1 ? "1 week ago" : `${diffWeeks} weeks ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
}

export default function TaskItem({ task, onUpdate, onDelete }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusStyles = useMemo(
    () =>
      task.status === "completed"
        ? "bg-green-100 text-green-800"
        : "bg-yellow-100 text-yellow-800",
    [task.status],
  );

  const statusLabel = task.status === "completed" ? "Completed" : "Pending";

  const handleSave = async () => {
    setIsUpdating(true);

    try {
      await onUpdate(task.id, {
        title: editTitle,
        description: editDescription,
      });
      setIsEditing(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsUpdating(true);

    try {
      await onUpdate(task.id, {
        status: task.status === "pending" ? "completed" : "pending",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await onDelete(task.id);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Card>
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Task title"
            />
            <textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Task description"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="primary" size="sm" isLoading={isUpdating} onClick={handleSave}>
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setConfirmDelete(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : confirmDelete ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-900">Are you sure?</p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" isLoading={isDeleting} onClick={handleDelete}>
              Yes, delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3
                  className={`truncate font-medium text-gray-900 ${
                    task.status === "completed" ? "text-gray-400 line-through" : ""
                  }`}
                >
                  {task.title}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles}`}>
                  {statusLabel}
                </span>
              </div>

              {task.description ? (
                <p className="mt-1 text-sm text-gray-500">{task.description}</p>
              ) : null}

              <p className="mt-2 text-xs text-gray-400">
                {formatRelativeTime(task.created_at)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant={task.status === "pending" ? "primary" : "ghost"}
              size="sm"
              onClick={handleToggleStatus}
              isLoading={isUpdating}
            >
              {task.status === "pending" ? "✓ Complete" : "↩ Undo"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditTitle(task.title);
                setEditDescription(task.description ?? "");
                setConfirmDelete(false);
                setIsEditing(true);
              }}
              disabled={isUpdating || isDeleting}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={isUpdating || isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}