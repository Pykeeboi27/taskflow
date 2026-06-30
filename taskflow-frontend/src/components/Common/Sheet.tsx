"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          aria-hidden="true"
          onClick={onClose}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={open ? undefined : true}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-[400px] bg-canvas-raised shadow-modal border-l border-line flex flex-col transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </>
  );
}
