"""
Route-level integration tests for app/routers/tasks.py.

Uses ``authed_client`` (conftest.py) so ``get_current_user`` is overridden to
return ``test_user`` — auth overhead is eliminated and CRUD logic is the focus.

Covers: create, list (pagination + filters + ownership isolation + ordering),
get, update (partial semantics), delete, and unauthenticated access rejection.
"""

import pytest
from uuid import uuid4

from app.models import Task, User

TASKS = "/api/v1/tasks/"


def _task_url(task_id) -> str:
    return f"/api/v1/tasks/{task_id}"


# ─── Create ───────────────────────────────────────────────────────────────────


@pytest.mark.routes
class TestCreateTask:
    async def test_returns_201_with_task_data(self, authed_client):
        response = await authed_client.post(TASKS, json={"title": "Buy groceries"})
        assert response.status_code == 201
        body = response.json()
        assert body["title"] == "Buy groceries"
        assert "id" in body

    async def test_status_is_always_forced_to_pending(self, authed_client):
        response = await authed_client.post(TASKS, json={"title": "Any task"})
        assert response.json()["status"] == "pending"

    async def test_description_is_stored_when_provided(self, authed_client):
        response = await authed_client.post(
            TASKS, json={"title": "Task", "description": "Some details"}
        )
        assert response.json()["description"] == "Some details"

    async def test_description_is_null_when_omitted(self, authed_client):
        response = await authed_client.post(TASKS, json={"title": "Task"})
        assert response.json()["description"] is None

    async def test_empty_title_returns_422(self, authed_client):
        response = await authed_client.post(TASKS, json={"title": ""})
        assert response.status_code == 422

    async def test_missing_title_returns_422(self, authed_client):
        response = await authed_client.post(TASKS, json={"description": "No title"})
        assert response.status_code == 422

    async def test_unauthenticated_request_returns_401(self, client):
        response = await client.post(TASKS, json={"title": "Unauthorized"})
        assert response.status_code == 401


# ─── List ─────────────────────────────────────────────────────────────────────


@pytest.mark.routes
class TestListTasks:
    async def _create(self, client, title: str) -> dict:
        return (await client.post(TASKS, json={"title": title})).json()

    async def test_empty_list_returns_zero_total_and_zero_pages(self, authed_client):
        response = await authed_client.get(TASKS)
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 0
        assert body["items"] == []
        assert body["pages"] == 0

    async def test_returns_all_created_tasks(self, authed_client):
        for title in ["A", "B", "C"]:
            await self._create(authed_client, title)
        body = (await authed_client.get(TASKS)).json()
        assert body["total"] == 3
        assert len(body["items"]) == 3

    async def test_pagination_pages_is_ceiling_of_total_over_limit(self, authed_client):
        for i in range(5):
            await self._create(authed_client, f"Task {i}")
        body = (await authed_client.get(TASKS + "?limit=2")).json()
        assert body["pages"] == 3  # ceil(5/2)
        assert body["limit"] == 2
        assert body["total"] == 5

    async def test_page_2_contains_correct_slice(self, authed_client):
        for i in range(5):
            await self._create(authed_client, f"Task {i}")
        body = (await authed_client.get(TASKS + "?page=2&limit=2")).json()
        assert len(body["items"]) == 2
        assert body["page"] == 2

    async def test_last_page_may_have_fewer_items_than_limit(self, authed_client):
        for i in range(5):
            await self._create(authed_client, f"Task {i}")
        body = (await authed_client.get(TASKS + "?page=3&limit=2")).json()
        # 5 tasks, limit 2 → page 3 has 1 item
        assert len(body["items"]) == 1

    async def test_page_below_minimum_returns_422(self, authed_client):
        response = await authed_client.get(TASKS + "?page=0")
        assert response.status_code == 422

    async def test_limit_above_50_returns_422(self, authed_client):
        response = await authed_client.get(TASKS + "?limit=51")
        assert response.status_code == 422

    async def test_status_filter_pending_excludes_completed(self, authed_client):
        await self._create(authed_client, "Pending task")
        task = await self._create(authed_client, "To complete")
        await authed_client.put(_task_url(task["id"]), json={"status": "completed"})

        body = (await authed_client.get(TASKS + "?status=pending")).json()
        assert body["total"] == 1
        assert body["items"][0]["status"] == "pending"

    async def test_status_filter_completed_excludes_pending(self, authed_client):
        task = await self._create(authed_client, "Complete me")
        await authed_client.put(_task_url(task["id"]), json={"status": "completed"})
        await self._create(authed_client, "Still pending")

        body = (await authed_client.get(TASKS + "?status=completed")).json()
        assert body["total"] == 1
        assert body["items"][0]["status"] == "completed"

    async def test_invalid_status_value_returns_422(self, authed_client):
        response = await authed_client.get(TASKS + "?status=in_progress")
        assert response.status_code == 422

    async def test_list_is_ordered_by_created_at_descending(self, authed_client):
        """The most recently created task must appear first (ORDER BY created_at DESC)."""
        for title in ["First", "Second", "Third"]:
            await self._create(authed_client, title)
        items = (await authed_client.get(TASKS)).json()["items"]
        created_ats = [item["created_at"] for item in items]
        assert created_ats == sorted(created_ats, reverse=True)

    async def test_list_only_returns_current_users_tasks(
        self, authed_client, db_session, test_user
    ):
        """
        Tasks owned by a different user_id must NOT appear in test_user's list.
        We insert a second user and their task directly via the DB session to
        avoid complicated dependency-override juggling.
        """
        # Create another user and attach a task to them directly
        other = User(email="other@example.com", password="hashed-irrelevant")
        db_session.add(other)
        await db_session.flush()  # populate other.id
        other_task = Task(user_id=other.id, title="Other user's task", status="pending")
        db_session.add(other_task)
        await db_session.commit()

        # Create one task for test_user via the API
        await self._create(authed_client, "My task")

        body = (await authed_client.get(TASKS)).json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "My task"


# ─── Get ──────────────────────────────────────────────────────────────────────


@pytest.mark.routes
class TestGetTask:
    async def test_existing_task_returns_200(self, authed_client):
        task_id = (await authed_client.post(TASKS, json={"title": "Fetch me"})).json()[
            "id"
        ]
        response = await authed_client.get(_task_url(task_id))
        assert response.status_code == 200
        assert response.json()["id"] == task_id

    async def test_nonexistent_id_returns_404_task_not_found(self, authed_client):
        response = await authed_client.get(_task_url(uuid4()))
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "task_not_found"

    async def test_another_users_task_returns_404(
        self, authed_client, db_session, test_user
    ):
        """Ownership check: test_user cannot retrieve a task belonging to another user."""
        other = User(email="other2@example.com", password="x")
        db_session.add(other)
        await db_session.flush()
        other_task = Task(user_id=other.id, title="Private", status="pending")
        db_session.add(other_task)
        await db_session.commit()
        await db_session.refresh(other_task)

        response = await authed_client.get(_task_url(other_task.id))
        assert response.status_code == 404


# ─── Update ───────────────────────────────────────────────────────────────────


@pytest.mark.routes
class TestUpdateTask:
    async def test_title_update_changes_only_title(self, authed_client):
        task = (
            await authed_client.post(
                TASKS, json={"title": "Old", "description": "Keep me"}
            )
        ).json()
        response = await authed_client.put(_task_url(task["id"]), json={"title": "New"})
        assert response.status_code == 200
        body = response.json()
        assert body["title"] == "New"
        assert body["description"] == "Keep me"  # untouched

    async def test_status_update_changes_only_status(self, authed_client):
        task = (await authed_client.post(TASKS, json={"title": "Task"})).json()
        response = await authed_client.put(
            _task_url(task["id"]), json={"status": "completed"}
        )
        assert response.json()["status"] == "completed"
        assert response.json()["title"] == "Task"  # untouched

    async def test_partial_update_leaves_all_unset_fields_unchanged(
        self, authed_client
    ):
        """exclude_unset semantics: only provided keys are written to the DB."""
        task = (
            await authed_client.post(
                TASKS, json={"title": "Original", "description": "Keep"}
            )
        ).json()
        await authed_client.put(_task_url(task["id"]), json={"status": "completed"})
        body = (await authed_client.get(_task_url(task["id"]))).json()
        assert body["title"] == "Original"
        assert body["description"] == "Keep"
        assert body["status"] == "completed"

    async def test_nonexistent_id_returns_404(self, authed_client):
        response = await authed_client.put(_task_url(uuid4()), json={"title": "Ghost"})
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "task_not_found"

    async def test_another_users_task_returns_404(
        self, authed_client, db_session, test_user
    ):
        other = User(email="other3@example.com", password="x")
        db_session.add(other)
        await db_session.flush()
        other_task = Task(user_id=other.id, title="Not yours", status="pending")
        db_session.add(other_task)
        await db_session.commit()
        await db_session.refresh(other_task)

        response = await authed_client.put(
            _task_url(other_task.id), json={"title": "Stolen"}
        )
        assert response.status_code == 404

    async def test_invalid_status_value_returns_422(self, authed_client):
        task = (await authed_client.post(TASKS, json={"title": "Task"})).json()
        response = await authed_client.put(
            _task_url(task["id"]), json={"status": "in_progress"}
        )
        assert response.status_code == 422


# ─── Delete ───────────────────────────────────────────────────────────────────


@pytest.mark.routes
class TestDeleteTask:
    async def test_existing_task_returns_204_no_content(self, authed_client):
        task_id = (await authed_client.post(TASKS, json={"title": "Delete me"})).json()[
            "id"
        ]
        response = await authed_client.delete(_task_url(task_id))
        assert response.status_code == 204

    async def test_deleted_task_is_no_longer_retrievable(self, authed_client):
        task_id = (await authed_client.post(TASKS, json={"title": "Gone"})).json()["id"]
        await authed_client.delete(_task_url(task_id))
        response = await authed_client.get(_task_url(task_id))
        assert response.status_code == 404

    async def test_deleted_task_no_longer_appears_in_list(self, authed_client):
        task_id = (
            await authed_client.post(TASKS, json={"title": "Remove from list"})
        ).json()["id"]
        await authed_client.delete(_task_url(task_id))
        body = (await authed_client.get(TASKS)).json()
        assert body["total"] == 0

    async def test_nonexistent_id_returns_404(self, authed_client):
        response = await authed_client.delete(_task_url(uuid4()))
        assert response.status_code == 404
        assert response.json()["detail"]["error"] == "task_not_found"

    async def test_another_users_task_returns_404(
        self, authed_client, db_session, test_user
    ):
        other = User(email="other4@example.com", password="x")
        db_session.add(other)
        await db_session.flush()
        other_task = Task(user_id=other.id, title="Not yours", status="pending")
        db_session.add(other_task)
        await db_session.commit()
        await db_session.refresh(other_task)

        response = await authed_client.delete(_task_url(other_task.id))
        assert response.status_code == 404
