"""Pydantic schemas for the Taskflow application."""

from datetime import datetime
from typing import Annotated, Optional, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=8)]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    access_token: str
    refresh_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str


class TaskCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=255, strip_whitespace=True)]
    description: Annotated[Optional[str], Field(default=None, max_length=1000)] = None


class TaskUpdate(BaseModel):
    title: Annotated[
        Optional[str],
        Field(default=None, min_length=1, max_length=255, strip_whitespace=True),
    ] = None
    description: Annotated[Optional[str], Field(default=None, max_length=1000)] = None
    status: Optional[Literal["pending", "completed"]] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: Optional[str]
    status: Literal["pending", "completed"]
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    items: list[TaskResponse]
    total: int
    page: int
    limit: int
    pages: int


class ErrorDetail(BaseModel):
    error: str
    message: str
    field: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: ErrorDetail
