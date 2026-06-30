"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className = "", id, ...props },
  ref,
) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium tracking-wide uppercase text-ink-dim"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        className={`w-full px-3 py-2 border rounded-lg text-sm text-ink bg-canvas-input focus:outline-none focus:ring-2 focus:ring-brand focus:border-line-strong transition ${error ? "border-danger" : "border-line"} ${className}`.trim()}
        {...props}
      />
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-xs text-danger mt-1"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
