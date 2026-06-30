"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, ...props },
  ref,
) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`w-full px-3 py-2 border rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${error ? "border-red-500" : "border-gray-300"} ${className}`.trim()}
        {...props}
      />
      {error ? <p className="text-sm text-red-600 mt-0.5">{error}</p> : null}
    </div>
  );
});

export default Input;