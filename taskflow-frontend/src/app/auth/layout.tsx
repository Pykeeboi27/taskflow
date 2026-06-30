import type { ReactNode } from "react";

function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="rgba(255,255,255,0.15)" />
      <path d="M7 8h10M7 12h6M7 16h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-2/5 bg-brand flex-col items-center justify-center px-12 gap-5">
        <LogoMark size={48} />
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold tracking-tight">TaskFlow</h1>
          <p className="mt-2 text-white/65 text-sm leading-relaxed max-w-xs">
            A minimal workspace for getting things done — no clutter, no noise.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-canvas-raised">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect width="24" height="24" rx="6" fill="var(--color-brand)" />
              <path d="M7 8h10M7 12h6M7 16h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-semibold text-ink">TaskFlow</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
