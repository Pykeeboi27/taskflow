"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import Button from "@/components/Common/Button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--color-brand)" />
      <path d="M7 8h10M7 12h6M7 16h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type TopbarProps = {
  onMenuClick?: () => void;
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user?.email?.charAt(0).toUpperCase() ?? "?";

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-canvas-raised border-b border-line shrink-0 z-10">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        {onMenuClick ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu size={17} aria-hidden="true" />
          </Button>
        ) : null}

        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-sm font-semibold text-ink tracking-tight">TaskFlow</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {isDark ? (
            <Sun size={15} aria-hidden="true" />
          ) : (
            <Moon size={15} aria-hidden="true" />
          )}
        </Button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="User menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="size-8 rounded-full bg-brand-soft text-brand-fg text-[13px] font-semibold flex items-center justify-center hover:bg-brand-soft/70 transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
          >
            {initials}
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-10 w-52 bg-canvas-raised rounded-xl border border-line shadow-raised overflow-hidden z-50"
            >
              <div className="px-3 py-2.5 border-b border-line">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                  Signed in as
                </p>
                <p className="text-sm text-ink truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-danger-tint transition-colors"
              >
                <LogOut size={13} aria-hidden="true" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
