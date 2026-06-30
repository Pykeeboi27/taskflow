"use client";

import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
};

export default function Card({
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-canvas-raised rounded-xl shadow-card border border-line ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
