"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export default function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-sm rounded-xl border border-line shadow-modal bg-canvas-raised p-0"
      onCancel={onClose}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-ink-muted hover:text-ink transition-colors"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
