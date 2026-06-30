# TaskFlow Frontend — Session Handoff

## What was completed

### Favicon
- Created `public/favicon.svg` — 32×32 SVG matching the LogoMark (violet `#5B5BD6` rounded-rect, white task-lines path).
- Wired in `src/app/layout.tsx` via `metadata.icons.icon`.

### Dark mode (root cause + fix)
**Problem:** Clicking the Moon/Sun toggle added `.dark` to `<html>` correctly, but page colors never changed.

**Root cause:** Tailwind v4's `@variant dark (&:where(.dark, .dark *))` declaration silently strips any bare `.dark { }` block found in user CSS — it treats the selector as belonging to the variant system. `body {}` and `dialog::backdrop {}` survived; `.dark {}` did not. Confirmed by diffing `globals.css` source against the compiled `.next/dev/static/chunks/src_app_globals_css_*.single.css` — the entire `.dark {}` block was absent from output.

**Fix applied** (`src/app/globals.css`): Wrapped the dark token overrides in `@layer base` so Tailwind passes them through as explicit user base styles instead of intercepting them.

```css
/* ✅ After fix */
@layer base {
  .dark {
    --color-canvas: #111110;
    /* ... all other token overrides ... */
  }
}
```

### Hydration mismatch (fixed)
- Anti-FOUC inline `<script>` in `src/app/layout.tsx` reads `localStorage` and conditionally adds `.dark` to `<html>` before React hydrates.
- `suppressHydrationWarning` on `<html>` silences the server/client class mismatch React warning.

### useTheme stale closure (fixed)
- `src/hooks/useTheme.ts`: toggle uses functional `setState((prev) => ...)` pattern — DOM mutation and localStorage write happen inside the updater callback, eliminating the stale closure.

---

## Current state of key files

| File | Status |
|---|---|
| `src/app/globals.css` | Fixed — `.dark {}` inside `@layer base` |
| `src/hooks/useTheme.ts` | Fixed — functional setState, no stale closure |
| `src/app/layout.tsx` | Fixed — anti-FOUC script, `suppressHydrationWarning` |
| `src/components/Layout/Topbar.tsx` | Working — Sun/Moon toggle wired |
| `public/favicon.svg` | Created |

---

## What is still pending

The plan at `C:\Users\jiroh\.claude\plans\linked-puzzling-quail.md` includes a **responsive layout** pass that has NOT been started:

### Responsive work remaining

**`src/app/dashboard/layout.tsx`**
- Add `mobileSidebarOpen` state
- Render sidebar as a fixed drawer overlay on mobile (`md:hidden` wrapper with backdrop)

**`src/components/Layout/Sidebar.tsx`**
- Add optional `onClose?: () => void` prop
- Show `X` close button on mobile

**`src/components/Layout/Topbar.tsx`**
- Add `onMenuClick?: () => void` prop
- Render `Menu` hamburger icon (`md:hidden`) as first child
- Change `px-6` → `px-4 sm:px-6`

**`src/app/dashboard/page.tsx`**
- Outer wrapper: `px-8 py-6` → `px-4 py-4 sm:px-8 sm:py-6`
- StatCards grid: `gap-4 mb-8` → `gap-2 mb-6 sm:gap-4 sm:mb-8`, remove `max-w-lg`
- StatCard inner: `px-5 py-4` → `px-3 py-3 sm:px-5 sm:py-4`
- StatCard number: `text-3xl` → `text-2xl sm:text-3xl`

**`src/components/Tasks/TaskList.tsx`**
- Empty state: `py-20` → `py-12 sm:py-20`

**`src/components/Common/Toast.tsx`**
- Positioning: `right-6 bottom-6` → `right-4 bottom-4 sm:right-6 sm:bottom-6`

**`src/app/page.tsx`**
- Navbar: `px-8` → `px-4 sm:px-8`

---

## Stack notes for next session

- **Next.js**: Custom `16.2.9` build with breaking changes — see `AGENTS.md` for version-specific caveats.
- **Tailwind CSS v4**: Uses `@theme` block for token emission. `dark:` utilities resolve via CSS var cascade — no `dark:` prefix classes needed in components, only token overrides in `globals.css`.
- **Dark mode selector**: `@variant dark (&:where(.dark, .dark *))` — `.dark` class must be on `<html>`.
- **Theme persistence**: `localStorage` key `tf-theme`, values `"dark"` / `"light"`. Fallback: OS preference via `prefers-color-scheme`.
- **Dev server**: `npm run dev` from `taskflow-frontend/`.

---

## Verification checklist for dark mode (should pass now)

1. `npm run dev` → navigate to dashboard
2. Click Moon icon in topbar → all surfaces flip dark (canvas `#111110`, text `#EDEDEC`)
3. Hard-refresh → dark mode persists (anti-FOUC script)
4. Clear `tf-theme` from DevTools localStorage, set OS to dark → auto-applies dark
5. Toggle back to light → all surfaces return to light values
