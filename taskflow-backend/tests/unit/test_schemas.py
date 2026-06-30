"""
Unit tests for app/schemas.py — pure Pydantic validation, no I/O.

Covers field constraints (min/max length, strip_whitespace, EmailStr, Literal)
and the ORM-mode mapping of TaskResponse.
"""

import pytest
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError

from app.schemas import RegisterRequest, TaskCreate, TaskResponse, TaskUpdate


# ─── RegisterRequest ──────────────────────────────────────────────────────────


class TestRegisterRequest:
    def test_valid_request_is_accepted(self):
        obj = RegisterRequest(email="user@example.com", password="password123")
        assert str(obj.email) == "user@example.com"

    def test_invalid_email_is_rejected(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="not-an-email", password="password123")

    def test_email_without_domain_is_rejected(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="user@", password="password123")

    def test_password_shorter_than_8_chars_is_rejected(self):
        with pytest.raises(ValidationError):
            RegisterRequest(email="user@example.com", password="short")

    def test_password_of_exactly_8_chars_is_accepted(self):
        obj = RegisterRequest(email="user@example.com", password="exactly8")
        assert obj.password == "exactly8"

    def test_password_longer_than_8_chars_is_accepted(self):
        obj = RegisterRequest(email="user@example.com", password="longerpassword")
        assert len(obj.password) > 8


# ─── TaskCreate ───────────────────────────────────────────────────────────────


class TestTaskCreate:
    def test_valid_task_is_accepted(self):
        obj = TaskCreate(title="Buy groceries")
        assert obj.title == "Buy groceries"

    def test_description_defaults_to_none(self):
        obj = TaskCreate(title="Task")
        assert obj.description is None

    def test_description_can_be_set(self):
        obj = TaskCreate(title="Task", description="Some details")
        assert obj.description == "Some details"

    def test_empty_title_is_rejected(self):
        with pytest.raises(ValidationError):
            TaskCreate(title="")

    def test_whitespace_only_title_is_not_rejected_due_to_pydantic_v2_bug(self):
        """
        BUG ⚑ — ``strip_whitespace=True`` in ``Field()`` is silently ignored in
        Pydantic v2 (stored as ``json_schema_extra``, not enforced).  A pure-
        whitespace title like ``"   "`` has 3 characters, so it passes the
        ``min_length=1`` constraint without stripping.

        Fix in source: use ``Annotated[str, StringConstraints(strip_whitespace=True,
        min_length=1, max_length=255)]`` instead of ``Field(strip_whitespace=True)``.
        """
        # Does NOT raise: whitespace is not stripped, "   " has length 3 ≥ 1
        obj = TaskCreate(title="   ")
        assert obj.title == "   "  # no strip actually applied

    def test_title_surrounding_whitespace_is_not_stripped_due_to_pydantic_v2_bug(self):
        """
        BUG ⚑ — same root cause as above: ``strip_whitespace`` in ``Field()`` is a
        no-op in Pydantic v2.  Whitespace is preserved rather than trimmed.
        """
        obj = TaskCreate(title="  Hello World  ")
        # strip_whitespace is NOT applied; value comes through unchanged
        assert obj.title == "  Hello World  "

    def test_title_at_max_length_255_is_accepted(self):
        obj = TaskCreate(title="a" * 255)
        assert len(obj.title) == 255

    def test_title_exceeding_255_chars_is_rejected(self):
        with pytest.raises(ValidationError):
            TaskCreate(title="a" * 256)

    def test_description_at_max_length_1000_is_accepted(self):
        obj = TaskCreate(title="Task", description="d" * 1000)
        assert len(obj.description) == 1000

    def test_description_exceeding_1000_chars_is_rejected(self):
        with pytest.raises(ValidationError):
            TaskCreate(title="Task", description="d" * 1001)


# ─── TaskUpdate ───────────────────────────────────────────────────────────────


class TestTaskUpdate:
    def test_empty_update_is_valid(self):
        obj = TaskUpdate()
        assert obj.model_dump(exclude_unset=True) == {}

    def test_only_title_produces_single_field_dict(self):
        obj = TaskUpdate(title="New title")
        assert obj.model_dump(exclude_unset=True) == {"title": "New title"}

    def test_only_status_produces_single_field_dict(self):
        obj = TaskUpdate(status="completed")
        assert obj.model_dump(exclude_unset=True) == {"status": "completed"}

    def test_title_and_status_together(self):
        obj = TaskUpdate(title="Done", status="completed")
        dumped = obj.model_dump(exclude_unset=True)
        assert dumped == {"title": "Done", "status": "completed"}

    def test_status_pending_is_accepted(self):
        obj = TaskUpdate(status="pending")
        assert obj.status == "pending"

    def test_status_completed_is_accepted(self):
        obj = TaskUpdate(status="completed")
        assert obj.status == "completed"

    def test_invalid_status_is_rejected(self):
        with pytest.raises(ValidationError):
            TaskUpdate(status="in_progress")

    def test_title_whitespace_is_not_stripped_due_to_pydantic_v2_bug(self):
        """
        BUG ⚑ — same root cause as ``TestTaskCreate``; ``strip_whitespace`` in
        ``Field()`` is silently ignored in Pydantic v2.
        """
        obj = TaskUpdate(title="  trimmed  ")
        assert obj.title == "  trimmed  "  # no strip actually applied

    def test_title_exceeding_255_chars_is_rejected(self):
        with pytest.raises(ValidationError):
            TaskUpdate(title="a" * 256)


# ─── TaskResponse (ORM mode via from_attributes) ─────────────────────────────


class TestTaskResponse:
    """
    TaskResponse uses ``from_attributes=True`` so it can be constructed from
    an ORM ``Task`` object.  We use a lightweight stand-in to avoid a DB.
    """

    class _FakeTask:
        id = uuid4()
        title = "Test task"
        description = None
        status = "pending"
        created_at = datetime.now(timezone.utc)
        updated_at = datetime.now(timezone.utc)

    def test_model_validate_maps_all_fields(self):
        response = TaskResponse.model_validate(self._FakeTask())
        assert response.title == "Test task"
        assert response.status == "pending"
        assert response.description is None

    def test_model_validate_with_description(self):
        task = self._FakeTask()
        task.description = "Some notes"
        response = TaskResponse.model_validate(task)
        assert response.description == "Some notes"

    def test_model_validate_with_completed_status(self):
        task = self._FakeTask()
        task.status = "completed"
        response = TaskResponse.model_validate(task)
        assert response.status == "completed"

    def test_response_does_not_expose_user_id(self):
        """TaskResponse intentionally omits user_id to avoid leaking ownership."""
        response = TaskResponse.model_validate(self._FakeTask())
        assert not hasattr(response, "user_id")
