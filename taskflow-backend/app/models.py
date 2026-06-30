"""Database models for the Taskflow application."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.database import Base


def utcnow() -> datetime:
	return datetime.now(timezone.utc)


class User(Base):
	"""Application user."""

	__tablename__ = "users"

	id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
	email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
	password: Mapped[str] = mapped_column(String(255), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
	updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

	tasks: Mapped[list[Task]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Task(Base):
	"""Task owned by a user."""

	__tablename__ = "tasks"
	__table_args__ = (Index("ix_tasks_user_id_created_at", "user_id", "created_at"),)

	id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
	user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
	title: Mapped[str] = mapped_column(String(255), nullable=False)
	description: Mapped[str | None] = mapped_column(Text, nullable=True)
	status: Mapped[str] = mapped_column(
		Enum("pending", "completed", name="task_status", native_enum=False),
		default="pending",
		nullable=False,
	)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
	updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

	user: Mapped[User] = relationship(back_populates="tasks")
