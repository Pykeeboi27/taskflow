"""FastAPI application entry point."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database import Base, engine
from app.limiter import limiter
from app.routers.auth import router as auth_router
from app.routers.tasks import router as tasks_router


app = FastAPI(title="TaskFlow API", version="1.0.0")

# Configure allowed origins from environment so deployments don't require code changes.
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
	CORSMiddleware,
	allow_origins=origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth_router)
app.include_router(tasks_router)


@app.on_event("startup")
async def on_startup() -> None:
	async with engine.begin() as connection:
		await connection.run_sync(Base.metadata.create_all)


@app.get("/")
async def health_check() -> dict[str, str]:
	return {"status": "ok", "service": "taskflow-api"}
