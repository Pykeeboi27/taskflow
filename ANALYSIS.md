# TaskFlow — Comprehensive Codebase Analysis Report

---

## 1. Executive Summary

TaskFlow is a two-tier web application: a **Next.js frontend** (TypeScript) and a **FastAPI backend** (Python) backed by SQLite. The architecture is clean, the separation of concerns is good, and the code is well-organized. However, **two critical bugs** mean the application cannot function in its current state, and there are several security and logic issues that must be resolved before any production deployment.

**Critical issues discovered:**
1. Every frontend API call uses the wrong URL path — missing the `/api/v1` prefix
2. Backend error messages never reach the user — API error response shape is mismatched
3. The `SECRET_KEY` in `.env` is still the placeholder value `"your-secret-key-here"`
4. The `useTasks` hook re-fetches and resets pagination to page 1 on every page change
5. JWT tokens are not invalidated on logout

---

## 2. Technology Stack

### Frontend

| Technology | Purpose | Evidence |
|---|---|---|
| Next.js 16.2.9 | Framework / SSR | `package.json` |
| React 19.2.4 | UI rendering | `package.json` |
| TypeScript 5 | Language | `tsconfig.json` |
| Tailwind CSS 4 | Styling | `postcss.config.mjs`, `globals.css` |
| React Context API | Auth state management | `AuthContext.tsx` |
| `next/navigation` `useRouter` | Client-side routing | All page files |
| Native `fetch` | HTTP client | `api.ts` |
| Geist (Google Font) | Typography | `layout.tsx` |
| ESLint 9 | Linting | `eslint.config.mjs` |

No form library, no testing library, no external auth library.

### Backend

| Technology | Purpose | Evidence |
|---|---|---|
| Python 3.13 | Language | `__pycache__` dirs |
| FastAPI | Web framework | `main.py`, `requirements.txt` |
| Uvicorn | ASGI server | `requirements.txt`, `main.py` |
| SQLAlchemy (async) | ORM | `database.py`, `models.py` |
| SQLite + aiosqlite | Database | `database.py`, `tasks.db` |
| Pydantic v2 | Request/response validation | `schemas.py` |
| python-jose | JWT encoding/decoding | `auth.py` |
| passlib + bcrypt | Password hashing | `auth.py` |
| python-dotenv | Env config | `auth.py`, `.env` |
| Alembic | DB migrations (listed, unused) | `requirements.txt` |

### Package Management / Config

| Technology | Purpose | Evidence |
|---|---|---|
| npm | Frontend package manager | `package-lock.json` |
| pip / venv | Backend package manager | `venv/`, `requirements.txt` |
| `.env` / `.env.local` | Environment config | Both directories |

---

## 3. Project Structure Overview

```
taskflow/
├── taskflow-frontend/          # Next.js App Router project
│   ├── src/
│   │   ├── app/                # Pages (App Router)
│   │   │   ├── page.tsx        # Landing / redirect
│   │   │   ├── layout.tsx      # Root layout + AuthProvider
│   │   │   ├── auth/login/     # Login page
│   │   │   ├── auth/register/  # Register page
│   │   │   ├── dashboard/      # Protected dashboard
│   │   │   └── not-found.tsx   # 404 page
│   │   ├── components/
│   │   │   ├── Auth/           # LoginForm, RegisterForm, AuthGuard
│   │   │   ├── Common/         # Button, Card, Input, Loading
│   │   │   ├── Layout/         # Header, Footer
│   │   │   └── Tasks/          # TaskList, TaskItem, TaskForm, TaskFilters
│   │   ├── context/AuthContext.tsx   # Auth state + JWT decode
│   │   ├── hooks/
│   │   │   ├── useAuth.ts      # Re-exports useAuthContext
│   │   │   └── useTasks.ts     # Task CRUD + pagination state
│   │   ├── lib/api.ts          # All HTTP calls + token management
│   │   └── types/index.ts      # Shared TypeScript types
│   └── .env.local              # NEXT_PUBLIC_API_URL

└── taskflow-backend/           # FastAPI project
    ├── app/
    │   ├── main.py             # App factory, CORS, startup
    │   ├── database.py         # Async engine + session
    │   ├── models.py           # User + Task SQLAlchemy models
    │   ├── schemas.py          # Pydantic schemas
    │   ├── auth.py             # JWT + password utils + get_current_user
    │   └── routers/
    │       ├── auth.py         # /api/v1/auth/* endpoints
    │       └── tasks.py        # /api/v1/tasks/* endpoints
    ├── main.py                 # Uvicorn launcher
    └── .env                    # DB URL, secret key, token config
```

---

## 4. Architecture Explanation

TaskFlow is a **decoupled frontend/backend monorepo**. The two halves talk only through HTTP REST calls.

- The frontend is a **Next.js App Router** application, running entirely in the browser after initial load (all components use `"use client"`). It stores JWT tokens in `localStorage` and attaches a Bearer token to every API request.
- The backend is a **FastAPI async REST API**, protected entirely via JWT Bearer tokens. It serves data from a local SQLite file. All data access is user-scoped — users can only see their own tasks.

There is no server-side rendering of protected content, no middleware-level route protection, and no shared session store.

---

## 5. Authentication Flow

### Step-by-step

| Step | What happens | Files |
|---|---|---|
| 1. User opens app | Root layout wraps children in `<AuthProvider>` | `layout.tsx`, `AuthContext.tsx` |
| 2. AuthProvider mounts | Reads `auth_token` from localStorage, decodes JWT payload for user info, sets `isLoading=false` | `AuthContext.tsx:82-89` |
| 3. Dashboard accessed | `AuthGuard` checks `isAuthenticated`; redirects to `/auth/login` if false | `AuthGuard.tsx` |
| 4. Login form submitted | `LoginForm` calls `auth.login(email, password)` after basic empty-check | `LoginForm.tsx:27-46` |
| 5. API call made | `api.ts:login()` → POST to `/auth/login` (⚠️ should be `/api/v1/auth/login`) | `api.ts:193` |
| 6. Backend receives request | Validates `LoginRequest` via Pydantic | `routers/auth.py:70` |
| 7. User lookup | `SELECT * FROM users WHERE email = ?` | `routers/auth.py:71` |
| 8. Password check | `passlib.verify(plain, hashed)` using bcrypt | `auth.py:36` |
| 9. Tokens created | `python-jose` signs access (60 min) + refresh (7 day) JWTs with `HS256` | `auth.py:49-54` |
| 10. Response returned | `{user_id, email, access_token, refresh_token}` | `schemas.py:20-24` |
| 11. Frontend stores tokens | `localStorage.setItem("auth_token", ...)` and `"refresh_token"` | `api.ts:197-199` |
| 12. User state set | `AuthContext` sets `user` from response | `AuthContext.tsx:93-94` |
| 13. Redirect | `router.push("/dashboard")` | `LoginForm.tsx:41` |
| 14. Token refresh | On any 401 (except auth routes), auto-refreshes token and retries | `api.ts:153-165` |
| 15. Logout | Calls POST `/auth/logout`, then clears localStorage and redirects | `AuthContext.tsx:102-108`, `api.ts:205-210` |

---

## 6. Request Lifecycle

Using **"Create a task"** as the example:

```
User fills TaskForm → clicks "Add Task"
  → TaskForm.handleSubmit (TaskForm.tsx:42)
  → api.createTask(title, description) (api.ts:229)
  → apiRequest("POST", "/tasks", payload) (api.ts:125)
      → reads auth_token from localStorage
      → fetch("http://localhost:8000/tasks", { method: "POST", headers: { Authorization: "Bearer ..." }, body: JSON })
      ⚠️ WRONG URL — should be /api/v1/tasks/
  → Backend router: POST /api/v1/tasks/ (routers/tasks.py:26)
  → Dependency: get_current_user() → verifies JWT, loads User from DB
  → Creates Task record, commits to SQLite
  → Returns TaskResponse JSON (201 Created)
  → Frontend: task returned to onTaskCreated callback
  → TaskList.handleTaskCreated → fetchTasks() re-fetches list
  → setTasks([...]) → TaskList re-renders with new task
```

---

## 7. Database Architecture

### Schema

**users table**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, default uuid4 |
| email | VARCHAR(255) | UNIQUE, NOT NULL, indexed |
| password | VARCHAR(255) | NOT NULL (bcrypt hash) |
| created_at | DATETIME(tz) | NOT NULL |
| updated_at | DATETIME(tz) | NOT NULL |

**tasks table**

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, default uuid4 |
| user_id | UUID | FK → users.id, NOT NULL |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | nullable |
| status | ENUM('pending','completed') | NOT NULL, default 'pending' |
| created_at | DATETIME(tz) | NOT NULL |
| updated_at | DATETIME(tz) | NOT NULL |

### Indexes
- `users.email` — unique index (fast login lookup)
- `tasks.user_id` — index (fast user-scoped queries)
- Composite `(user_id, created_at)` — supports filtered+sorted pagination

### Relationships
- `User` → `Task`: one-to-many, `cascade="all, delete-orphan"`

### Migration strategy
Tables are created via `create_all` on startup (`main.py:26-28`). Alembic is installed but **has no migration files** — schema changes would require manual intervention or destroy existing data.

### CRUD flow
All data access goes through: `router → SQLAlchemy async select/insert/update/delete → AsyncSession → SQLite`. Every query is user-scoped (e.g., `Task.user_id == current_user.id`) — no cross-user data leakage possible.

---

## 8. Component Interaction

```
RootLayout (layout.tsx)
└── AuthProvider (AuthContext.tsx)   ← provides user, login, logout, isAuthenticated
    ├── Header                       ← reads auth.user, calls auth.logout
    ├── [page routes]
    │   ├── page.tsx (landing)       ← reads isAuthenticated, redirects
    │   ├── auth/login/page.tsx
    │   │   └── LoginForm            ← calls auth.login(), router.push
    │   ├── auth/register/page.tsx
    │   │   └── RegisterForm         ← calls auth.register(), router.push
    │   └── dashboard/page.tsx
    │       └── AuthGuard            ← redirects if !isAuthenticated
    │           └── DashboardContent
    │               └── TaskList     ← uses useTasks() hook
    │                   ├── TaskForm     ← calls api.createTask directly
    │                   ├── TaskFilters  ← calls setStatusFilter
    │                   └── TaskItem     ← calls onUpdate, onDelete (from useTasks)
    └── Footer
```

**State flow:**
- Auth state lives in `AuthContext` (React Context), consumed via `useAuth()`
- Task state lives inside `useTasks()` hook (local to `TaskList`)
- No global state management library — purely React built-ins

---

## 9. Dependency Analysis

```
Frontend (browser)
  └── lib/api.ts
        ├── /api/v1/auth/* ──────────────────→ Backend: routers/auth.py
        └── /api/v1/tasks/* ─────────────────→ Backend: routers/tasks.py
                                                    ├── auth.py (JWT verify + user load)
                                                    ├── models.py (SQLAlchemy ORM)
                                                    └── database.py → SQLite (tasks.db)

External dependencies:
  Frontend: Google Fonts (Geist), no other external services
  Backend: No external services — all local
```

---

## 10. Code Quality Findings

---

## 11. Syntax Errors

**No syntax errors found.** TypeScript compiles cleanly (strict mode enabled). Python files have valid syntax (confirmed by presence of `__pycache__` compiled files).

---

## 12. Semantic Errors

### CRITICAL — API path mismatch: all frontend requests hit wrong URLs

**File:** `src/lib/api.ts` — every API call  
**Severity:** Critical  
**Root cause:** The backend registers all routes under `/api/v1/` prefix (auth router: `prefix="/api/v1/auth"`, tasks router: `prefix="/api/v1/tasks"`). The frontend calls `/auth/login`, `/tasks`, etc. with no `/api/v1` prefix.

```
Frontend calls:  http://localhost:8000/auth/login   ❌
Backend expects: http://localhost:8000/api/v1/auth/login ✓

Frontend calls:  http://localhost:8000/tasks        ❌
Backend expects: http://localhost:8000/api/v1/tasks/ ✓
```

**Fix:** Add the prefix to `BASE_URL` in `api.ts`, or prefix every endpoint call:

```ts
// api.ts line 10 — change to:
export const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1";
```

---

### CRITICAL — Backend error messages never reach the user

**File:** `src/lib/api.ts:72-87`  
**Severity:** Critical  
**Root cause:** FastAPI returns errors as `{"detail": {"error": "...", "message": "...", "field": "..."}}`. The `parseErrorResponse` function reads `payload.error`, `payload.message`, `payload.field` from the top level. Since the data is nested under `detail`, all three are `undefined`, and users always see `"Request failed"` instead of meaningful messages like `"Invalid email or password"`.

```ts
// Backend returns: { "detail": { "error": "invalid_credentials", "message": "Invalid email or password." } }
// Frontend reads:  payload.error   → undefined  → falls back to "Request failed"
//                  payload.message → undefined  → falls back to statusText "Unauthorized"
```

**Fix:**
```ts
async function parseErrorResponse(response: Response): Promise<ApiErrorResponse> {
  try {
    const body = await response.json();
    const detail = body?.detail ?? body;  // unwrap FastAPI's detail wrapper
    return {
      error: detail.error ?? "Request failed",
      message: detail.message ?? response.statusText ?? "Request failed",
      field: detail.field,
    };
  } catch {
    return { error: "Request failed", message: response.statusText || "Request failed" };
  }
}
```

---

### HIGH — `useTasks` pagination resets to page 1 on every page change

**File:** `src/hooks/useTasks.ts:46-78`  
**Severity:** High  
**Root cause:** `fetchTasks` is in a `useCallback` with deps `[limit, page, statusFilter]`. When `setPage(2)` is called, `page` state changes → `fetchTasks` gets a new reference → the `useEffect` fires again (because `fetchTasks` is in its deps array) → the effect calls `fetchTasks(initialPage, initialLimit, undefined)` (always 1, 10), resetting pagination back to page 1.

**Fix:** Stabilize the effect — either use a ref to track initial-mount-only, or restructure `fetchTasks` to not be a dependency of the initial-load effect:

```ts
const hasFetchedRef = useRef(false);

useEffect(() => {
  if (hasFetchedRef.current) return;
  hasFetchedRef.current = true;
  void fetchTasks(initialPage, initialLimit, undefined);
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

---

### MEDIUM — `isValidEmail` check is too weak

**File:** `src/components/Auth/RegisterForm.tsx:19-21`  
**Severity:** Medium  
**Root cause:** Only checks if the string contains `"@"`. Inputs like `"@"`, `"a@"`, or `"@b"` all pass. The backend catches this with Pydantic's `EmailStr`, so it won't persist, but the UX gives no immediate feedback.

**Fix:** Use `type="email"` browser validation (already in use) and optionally add a basic regex, or rely solely on the server response.

---

### LOW — `refreshTokensInternal` casts response to wrong type

**File:** `src/lib/api.ts:119`  
**Severity:** Low  
**Root cause:** The `/auth/refresh` endpoint returns `{access_token, refresh_token}` (`RefreshResponse`), but the code casts it to `AuthResponse` (which also includes `user_id`, `email`). The extra fields are simply absent at runtime; only `access_token` and `refresh_token` are used, so it works, but the type is incorrect.

**Fix:** Change to the correct type: `const tokens = await response.json() as { access_token: string; refresh_token: string };`

---

### LOW — Dead render: `<PageLoader>` rendered hidden

**File:** `src/components/Tasks/TaskList.tsx:46-48`  
**Severity:** Low  
**Root cause:** `<PageLoader />` is rendered inside `<div className="hidden">`. It serves no functional purpose and wastes a render.

**Fix:** Delete lines 46–48.

---

### LOW — Saving an edited task with empty description sends `""` instead of `null`

**File:** `src/components/Tasks/TaskItem.tsx:59,79`  
**Severity:** Low  
**Root cause:** `editDescription` is initialized to `task.description ?? ""`. When saved, it always sends a string. If the user clears the description, the backend stores `""` instead of `NULL`.

**Fix:**
```ts
description: editDescription.trim() || undefined,
```

---

## 13. Runtime Risks

### HIGH — No error boundary anywhere in the component tree

**Severity:** High  
Any unhandled JavaScript error in any component will crash the entire app with a blank screen. Next.js does provide a default error boundary for the App Router, but there are no custom `error.tsx` files to give users a graceful recovery UI.

**Fix:** Add `error.tsx` files at the route level (e.g., `src/app/dashboard/error.tsx`).

---

### MEDIUM — Unhandled rejection in `AuthGuard` / `Header` logout

**File:** `src/components/Layout/Header.tsx:16`  
**Severity:** Medium  
`onClick={() => void auth.logout()}` — if `logout()` throws, the error is silently dropped (`void`). The `AuthContext.logout` already has a `try/finally`, so the user is always redirected, but any network error during the logout API call is never surfaced.

---

### MEDIUM — Token expiry not checked on page load

**File:** `src/context/AuthContext.tsx:82-88`  
**Severity:** Medium  
On mount, the token is decoded to get user info, but the `exp` field is never checked. An expired token makes the user appear authenticated until the first API call fails with 401. The auto-refresh then fires, but the UX flash (seeing the dashboard briefly) is confusing.

**Fix:** Check `payload.exp` during `userFromToken()`:
```ts
if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
```

---

### LOW — Race condition in task updates

**File:** `src/hooks/useTasks.ts:111-135`  
**Severity:** Low  
If the user rapidly toggles task status (complete → undo → complete), multiple concurrent `updateTask` API calls are in-flight. The optimistic update and rollback logic may restore an outdated state depending on which response arrives last. There is no request cancellation.

---

## 14. Security Findings

### CRITICAL — `SECRET_KEY` is the placeholder value

**File:** `taskflow-backend/.env:2`  
**Severity:** Critical  
```
SECRET_KEY=your-secret-key-here
```
The `.env` and `.env.example` files are **identical**. Anyone who knows this project (e.g., from version control) can forge valid JWTs and impersonate any user.

**Fix:** Generate a strong random secret:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Set the result as `SECRET_KEY` in `.env`. Never commit `.env` — add it to `.gitignore`.

---

### HIGH — Logout does not invalidate tokens (no token blacklist)

**File:** `taskflow-backend/app/routers/auth.py:140-143`  
**Severity:** High  
The logout endpoint just returns `{"message": "Logout successful"}`. The JWT remains cryptographically valid until it expires (up to 60 minutes for access, 7 days for refresh). If a token is stolen, there is no way to revoke it.

**Fix:** For a lightweight solution, maintain a short-lived server-side blocklist (in-memory set or Redis) of revoked `jti` (JWT ID) claims. Add `jti` to every token payload and check it on each request.

---

### HIGH — No rate limiting on authentication endpoints

**File:** `taskflow-backend/app/routers/auth.py`  
**Severity:** High  
`/api/v1/auth/login` and `/api/v1/auth/register` have no rate limiting. An attacker can brute-force passwords or flood registration.

**Fix:** Add `slowapi` (FastAPI rate-limiting middleware) to the auth router.

---

### MEDIUM — `.env` should not be committed to version control

**File:** `taskflow-backend/.env`  
**Severity:** Medium  
The `.env` file is present and contains credentials. It does not appear in a `.gitignore` (no `.gitignore` was found in either project). If committed, secrets become permanently part of git history.

**Fix:** Add `.env` to `.gitignore` in both frontend and backend. Use `.env.example` to document required variables.

---

### MEDIUM — CORS locked to `localhost:3000` only

**File:** `taskflow-backend/app/main.py:13-18`  
**Severity:** Medium  
CORS is hardcoded to `http://localhost:3000`. Acceptable for development, but this must be made environment-configurable before any deployment.

**Fix:**
```python
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, ...)
```

---

### LOW — Tokens stored in `localStorage` (XSS risk)

**File:** `src/lib/api.ts:26-48`  
**Severity:** Low  
`localStorage` is accessible to any JavaScript on the page. An XSS vulnerability (e.g., from a malicious dependency) could steal both tokens.

**Fix:** For higher security, use `httpOnly` cookies. This requires backend changes to set/clear cookies and frontend changes to drop the manual token storage.

---

### LOW — `@app.on_event("startup")` is deprecated

**File:** `taskflow-backend/app/main.py:25`  
**Severity:** Low  
FastAPI deprecated `on_event` in favor of the `lifespan` context manager. This works but generates deprecation warnings.

**Fix:**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="TaskFlow API", lifespan=lifespan)
```

---

## 15. Performance Findings

### LOW — Two separate DB queries for paginated task list (could be one)

**File:** `taskflow-backend/app/routers/tasks.py:56-66`  
**Severity:** Low  
The list endpoint runs two queries: one for `COUNT(*)` and one for the page of results. For SQLite at this scale, the overhead is negligible. For larger datasets, a window function or a single query returning both could improve efficiency.

---

### LOW — `useMemo` on status styles is unnecessary

**File:** `src/components/Tasks/TaskItem.tsx:65-71`  
**Severity:** Low  
`useMemo` for a simple string ternary over a single primitive value (`task.status`) adds hook overhead with no measurable gain. Plain inline computation is faster here.

---

### LOW — Every task update re-fetches the full list

**File:** `src/hooks/useTasks.ts:101-108`  
**Severity:** Low  
`createTask` calls `fetchTasks()` after every creation, which re-fetches the entire current page. For small task counts this is fine. Optimistic updates (already implemented for `updateTask`) would be more efficient for `createTask` too.

---

## 16. Best Practices Assessment

| Area | Status | Notes |
|---|---|---|
| Project structure | ✅ Good | Clean separation of concerns, logical folder layout |
| Naming conventions | ✅ Good | Consistent PascalCase components, camelCase functions, snake_case Python |
| TypeScript strictness | ✅ Good | `strict: true` in tsconfig |
| Pydantic validation | ✅ Good | All inputs validated at API boundary |
| Password hashing | ✅ Good | bcrypt via passlib |
| User-scoped queries | ✅ Good | Every task query filters by `user_id` |
| DB indexes | ✅ Good | Email, user_id, composite index present |
| Cascade deletes | ✅ Good | `cascade="all, delete-orphan"` on User→Task |
| Error handling | ⚠️ Partial | Errors caught but messages lost due to shape mismatch |
| Form validation | ⚠️ Partial | Client validation is thin; backend is the real guard |
| Testing | ❌ Missing | No tests in either project |
| Logging | ❌ Missing | No structured logging in backend |
| API versioning | ⚠️ Partial | `/api/v1/` prefix exists but frontend ignores it |
| DB migrations | ❌ Missing | Alembic installed but unconfigured; `create_all` used |
| Environment config | ❌ Critical | Placeholder secret key in committed `.env` |
| Accessibility | ⚠️ Partial | `aria-invalid` used; `aria-describedby` missing on inputs with errors |
| Error boundaries | ❌ Missing | No `error.tsx` files in App Router |
| Documentation | ⚠️ Minimal | No API docs beyond FastAPI's auto-generated Swagger |

---

## 17. Prioritized Recommendations

| Priority | Issue | File | Fix |
|---|---|---|---|
| 🔴 P0 | API path mismatch — app is entirely broken | `src/lib/api.ts:10` | Append `/api/v1` to `BASE_URL` |
| 🔴 P0 | Error messages lost — users see "Request failed" always | `src/lib/api.ts:72-87` | Unwrap `detail` in `parseErrorResponse` |
| 🔴 P0 | Placeholder `SECRET_KEY` in `.env` — tokens can be forged | `.env:2` | Generate real secret; add `.env` to `.gitignore` |
| 🟠 P1 | Pagination resets to page 1 on every page change | `useTasks.ts:76-78` | Guard `useEffect` with a ref to run only on mount |
| 🟠 P1 | JWT not invalidated on logout | `routers/auth.py:140` | Implement token blocklist with `jti` claims |
| 🟠 P1 | No rate limiting on auth routes | `routers/auth.py` | Add `slowapi` rate limiting |
| 🟡 P2 | Token expiry not checked on load — stale auth state | `AuthContext.tsx:53-71` | Check `exp` in `userFromToken()` |
| 🟡 P2 | No error boundaries — crashes show blank screen | `src/app/` | Add `error.tsx` at each route segment |
| 🟡 P2 | DB migrations unconfigured — schema changes destroy data | `requirements.txt` | Configure Alembic with initial migration |
| 🟡 P2 | CORS hardcoded to localhost | `main.py:15` | Read from `ALLOWED_ORIGINS` env var |
| 🟢 P3 | `@app.on_event("startup")` deprecated | `main.py:25` | Migrate to lifespan context manager |
| 🟢 P3 | Dead `<PageLoader>` in hidden div | `TaskList.tsx:46-48` | Delete those 3 lines |
| 🟢 P3 | Empty description saves `""` instead of `null` | `TaskItem.tsx:79` | Use `editDescription.trim() \|\| undefined` |
| 🟢 P3 | No tests anywhere | Both projects | Add pytest for backend, React Testing Library for frontend |
| 🟢 P3 | Weak `isValidEmail` check | `RegisterForm.tsx:19` | Rely on browser's `type="email"` + backend validation |

---

**Bottom line:** Fix P0 items first — without them the app simply doesn't work. The two most impactful single-line fixes are appending `/api/v1` to `BASE_URL` and unwrapping `detail` in `parseErrorResponse`. After those, rotate the secret key before any environment beyond a local dev machine.
