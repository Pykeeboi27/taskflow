"use client";

import { X } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const accentClasses = {
  success: "border-l-success",
  error: "border-l-danger",
  info: "border-l-brand",
};

const textClasses = {
  success: "text-success",
  error: "text-danger",
  info: "text-brand-fg",
};

export default function ToastStack() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 min-w-[280px] max-w-sm bg-canvas-raised rounded-xl shadow-modal border border-line border-l-4 px-4 py-3 ${accentClasses[toast.type]}`}
        >
          <p
            className={`flex-1 text-sm font-medium ${textClasses[toast.type]}`}
          >
            {toast.message}
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-ink-muted hover:text-ink transition-colors mt-0.5"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
