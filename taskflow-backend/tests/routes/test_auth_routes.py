"""
Route-level integration tests for app/routers/auth.py.

Drives the full FastAPI app through an in-memory SQLite database via httpx.
Covers: register, login, refresh, logout, and the get_current_user dependency.
"""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from jose import jwt
from sqlalchemy import select

from app.auth import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    decode_token,
    is_token_revoked,
)
from app.limiter import limiter
from app.models import User

REGISTER = "/api/v1/auth/register"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
TASKS = "/api/v1/tasks/"

_VALID_USER = {"email": "user@example.com", "password": "password123"}


# ─── Register ─────────────────────────────────────────────────────────────────

@pytest.mark.routes
class TestRegister:
    async def test_returns_201_with_tokens_and_user_info(self, client):
        response = await client.post(REGISTER, json=_VALID_USER)
        assert response.status_code == 201
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["email"] == _VALID_USER["email"]
        assert "user_id" in body

    async def test_persists_user_so_duplicate_email_returns_409(self, client):
        await client.post(REGISTER, json=_VALID_USER)
        response = await client.post(REGISTER, json=_VALID_USER)
        assert response.status_code == 409
        detail = response.json()["detail"]
        assert detail["error"] == "email_exists"
        assert detail["field"] == "email"

    async def test_invalid_email_returns_422(self, client):
        response = await client.post(
            REGISTER, json={"email": "not-valid", "password": "password123"}
        )
        assert response.status_code == 422

    async def test_password_shorter_than_8_chars_returns_422(self, client):
        response = await client.post(
            REGISTER, json={"email": "a@b.com", "password": "short"}
        )
        assert response.status_code == 422

    async def test_missing_email_field_returns_422(self, client):
        response = await client.post(REGISTER, json={"password": "password123"})
        assert response.status_code == 422

    async def test_rate_limit_returns_429_after_5_requests(self, client):
        """
        Re-enable the limiter for this one test and exhaust the 5/minute quota.
        The 6th request to /register should return 429.
        """
        limiter.enabled = True
        try:
            for i in range(5):
                await client.post(
                    REGISTER,
                    json={"email": f"ratelimit{i}@example.com", "password": "password123"},
                )
            response = await client.post(
                REGISTER,
                json={"email": "rl-sixth@example.com", "password": "password123"},
            )
            assert response.status_code == 429
        finally:
            limiter.enabled = False


# ─── Login ────────────────────────────────────────────────────────────────────

@pytest.mark.routes
class TestLogin:
    async def test_valid_credentials_return_200_with_tokens(self, client):
        await client.post(REGISTER, json=_VALID_USER)
        response = await client.post(LOGIN, json=_VALID_USER)
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["email"] == _VALID_USER["email"]

    async def test_wrong_password_returns_401_invalid_credentials(self, client):
        await client.post(REGISTER, json=_VALID_USER)
        response = await client.post(
            LOGIN,
            json={"email": _VALID_USER["email"], "password": "wrong_password"},
        )
        assert response.status_code == 401
        assert response.json()["detail"]["error"] == "invalid_credentials"

    async def test_unknown_email_returns_401_invalid_credentials(self, client):
        response = await client.post(
            LOGIN, json={"email": "nobody@example.com", "password": "password123"}
        )
        assert response.status_code == 401
        assert response.json()["detail"]["error"] == "invalid_credentials"

    async def test_missing_password_returns_422(self, client):
        response = await client.post(LOGIN, json={"email": "a@b.com"})
        assert response.status_code == 422


# ─── Refresh ──────────────────────────────────────────────────────────────────

@pytest.mark.routes
class TestRefresh:
    async def test_valid_refresh_token_returns_new_token_pair(self, client):
        reg = await client.post(REGISTER, json=_VALID_USER)
        refresh_token = reg.json()["refresh_token"]
        response = await client.post(REFRESH, json={"refresh_token": refresh_token})
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_passing_access_token_as_refresh_returns_401(self, client):
        """token_type guard: access tokens must not be accepted on the refresh endpoint."""
        reg = await client.post(REGISTER, json=_VALID_USER)
        access_token = reg.json()["access_token"]
        response = await client.post(REFRESH, json={"refresh_token": access_token})
        assert response.status_code == 401
        assert response.json()["detail"]["error"] == "invalid_token"

    async def test_malformed_token_returns_401(self, client):
        response = await client.post(
            REFRESH, json={"refresh_token": "this.is.garbage"}
        )
        assert response.status_code == 401

    async def test_expired_refresh_token_returns_401(self, client):
        expired = jwt.encode(
            {
                "sub": str(uuid4()),
                "user_id": str(uuid4()),
                "token_type": "refresh",
                "exp": datetime.now(timezone.utc) - timedelta(seconds=30),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        response = await client.post(REFRESH, json={"refresh_token": expired})
        assert response.status_code == 401

    async def test_refresh_with_deleted_user_returns_401_user_not_found(
        self, client, db_session
    ):
        """Issue tokens, delete the user, then try to refresh — must return 401."""
        from uuid import UUID as _UUID

        reg = await client.post(REGISTER, json=_VALID_USER)
        refresh_token = reg.json()["refresh_token"]
        user_id = _UUID(reg.json()["user_id"])  # JSON gives str; SQLAlchemy Uuid needs UUID

        # Remove the user directly
        result = await db_session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one()
        await db_session.delete(user)
        await db_session.commit()

        response = await client.post(REFRESH, json={"refresh_token": refresh_token})
        assert response.status_code == 401
        assert response.json()["detail"]["error"] == "user_not_found"


# ─── Logout ───────────────────────────────────────────────────────────────────

@pytest.mark.routes
class TestLogout:
    async def test_logout_returns_200_with_success_message(self, client):
        reg = await client.post(REGISTER, json=_VALID_USER)
        token = reg.json()["access_token"]
        response = await client.post(
            LOGOUT, headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json() == {"message": "Logout successful"}

    async def test_logout_adds_jti_to_revocation_set(self, client):
        reg = await client.post(REGISTER, json=_VALID_USER)
        token = reg.json()["access_token"]
        await client.post(LOGOUT, headers={"Authorization": f"Bearer {token}"})
        payload = decode_token(token)
        assert is_token_revoked(payload["jti"]) is True

    async def test_revoked_token_cannot_reach_protected_endpoint(self, client):
        """A second request with the same access token must be rejected after logout."""
        reg = await client.post(REGISTER, json=_VALID_USER)
        token = reg.json()["access_token"]
        await client.post(LOGOUT, headers={"Authorization": f"Bearer {token}"})
        response = await client.get(TASKS, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    async def test_logout_without_bearer_token_returns_401(self, client):
        response = await client.post(LOGOUT)
        assert response.status_code == 401


# ─── get_current_user dependency (tested through protected endpoints) ─────────

@pytest.mark.routes
class TestGetCurrentUser:
    """
    Exercises the ``get_current_user`` dependency's failure branches by hitting
    any auth-protected endpoint (GET /api/v1/tasks/ is the most convenient).
    """

    async def test_missing_authorization_header_returns_401(self, client):
        response = await client.get(TASKS)
        assert response.status_code == 401

    async def test_non_uuid_sub_claim_returns_401(self, client):
        token = jwt.encode(
            {
                "sub": "not-a-uuid",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )
        response = await client.get(
            TASKS, headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401

    async def test_token_for_nonexistent_user_returns_401(self, client):
        """A valid, non-expired token whose user_id doesn't exist in DB → 401."""
        token = create_access_token(
            {"user_id": str(uuid4()), "email": "ghost@example.com"}
        )
        response = await client.get(
            TASKS, headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 401

    async def test_valid_token_grants_access(self, client):
        """End-to-end: register → use the token → successfully reach a protected route."""
        reg = await client.post(REGISTER, json=_VALID_USER)
        token = reg.json()["access_token"]
        response = await client.get(
            TASKS, headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
