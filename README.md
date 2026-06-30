# TaskFlow

A minimal task management app with a clean, token-based UI. Built with Next.js on the frontend and FastAPI on the backend.

## Stack

**Frontend**
- Next.js 16 + React 19
- Tailwind CSS v4 (token-based design system)
- TypeScript

**Backend**
- FastAPI + SQLAlchemy
- SQLite (via Alembic migrations)
- JWT authentication (python-jose + passlib)

## Features

- Create, complete, and delete tasks
- JWT-based auth (register / login)
- Dark mode with system preference detection and manual toggle
- Theme persists across sessions via `localStorage`

## Getting Started

### Backend

```bash
cd taskflow-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at `http://localhost:8000`.

### Frontend

```bash
cd taskflow-frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Project Structure

```
taskflow/
├── taskflow-frontend/   # Next.js app
│   └── src/
│       ├── app/         # Routes (dashboard, auth, landing)
│       ├── components/  # UI components
│       ├── context/     # Auth + Toast providers
│       └── hooks/       # useTheme, etc.
└── taskflow-backend/    # FastAPI app
    ├── app/             # Routers, models, schemas
    └── alembic/         # DB migrations
```
