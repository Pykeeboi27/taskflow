"use client";

type SpinnerSize = "sm" | "md" | "lg";

type SpinnerProps = {
  size?: SpinnerSize;
};

const sizeMap: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

export default function Spinner({ size = "md" }: SpinnerProps) {
  const dimension = sizeMap[size];

  return (
    <svg
      aria-hidden="true"
      className="animate-spin text-brand"
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-canvas-raised rounded-xl border border-line px-5 py-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-line rounded w-3/4" />
          <div className="h-3 bg-line rounded w-1/2" />
        </div>
      </div>
      <div className="mt-3 h-3 bg-line rounded w-1/4" />
    </div>
  );
}
