"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.tasks import router as tasks_router


app = FastAPI(title="TaskFlow API", version="1.0.0")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(tasks_router)


@app.on_event("startup")
async def on_startup() -> None:
	async with engine.begin() as connection:
		await connection.run_sync(Base.metadata.create_all)


@app.get("/")
async def health_check() -> dict[str, str]:
	return {"status": "ok", "service": "taskflow-api"}
