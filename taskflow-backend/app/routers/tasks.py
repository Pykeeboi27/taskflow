"""Task routes for the Taskflow API."""

from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Task, User, utcnow
from app.schemas import TaskCreate, TaskListResponse, TaskResponse, TaskUpdate


router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": "task_not_found", "message": "Task not found.", "field": None},
    )


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    task = Task(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=50),
    status: str | None = Query(default=None, pattern="^(pending|completed)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskListResponse:
    filters = [Task.user_id == current_user.id]
    if status is not None:
        filters.append(Task.status == status)

    total_result = await db.execute(
        select(func.count()).select_from(Task).where(*filters)
    )
    total = total_result.scalar_one()

    offset = (page - 1) * limit
    items_result = await db.execute(
        select(Task)
        .where(*filters)
        .order_by(Task.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = list(items_result.scalars().all())

    pages = ceil(total / limit) if total else 0
    return TaskListResponse(
        items=items, total=total, page=page, limit=limit, pages=pages
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise _not_found()

    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise _not_found()

    update_data = payload.model_dump(exclude_unset=True)
    for field_name, field_value in update_data.items():
        setattr(task, field_name, field_value)

    task.updated_at = utcnow()
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    )
    task = result.scalar_one_or_none()

    if task is None:
        raise _not_found()

    await db.delete(task)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
