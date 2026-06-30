"""
Shared test fixtures for the TaskFlow backend test suite.

Strategy
--------
- One in-memory SQLite async engine per test (function-scoped) keeps tests
  fully isolated — no row leakage between tests.
- The ``get_db`` FastAPI dependency is overridden to yield the same session
  used by the test body, so route handlers and test assertions share state.
- ``get_current_user`` can be overridden per fixture to inject a known user
  without going through JWT / bcrypt / DB round-trips (used by task tests).
- The slowapi rate limiter is globally disabled to avoid 429s on the ~10
  calls that hit ``/register`` and ``/login`` across the suite.
- The module-level ``_REVOKED_JTIS`` set is cleared before and after every
  test so token-revocation state never leaks.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.auth as auth_module
from app.auth import create_access_token, get_current_user, hash_password
from app.database import Base, get_db
from app.limiter import limiter
from app.main import app
from app.models import User

# ─── In-memory database (function-scoped) ────────────────────────────────────

_TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def engine():
    """Create a fresh in-memory SQLite engine with the full schema for one test."""
    eng = create_async_engine(
        _TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture
async def db_session(engine):
    """Yield an AsyncSession bound to the test engine."""
    factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )
    async with factory() as session:
        yield session


# ─── HTTP client ──────────────────────────────────────────────────────────────


@pytest.fixture
async def client(db_session: AsyncSession):
    """
    Async HTTP client wired to the FastAPI app.

    ``get_db`` is overridden so every request the app makes uses the same
    in-memory session as the test body.  All overrides are cleared on teardown.
    """

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ─── User helpers ─────────────────────────────────────────────────────────────


async def _make_user(
    db: AsyncSession,
    email: str = "test@example.com",
    password: str = "password123",
) -> User:
    """Insert a ``User`` into the DB and return the refreshed ORM object."""
    user = User(email=email, password=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """A persisted user available to fixtures and tests that need one."""
    return await _make_user(db_session)


@pytest.fixture
async def auth_headers(test_user: User) -> dict[str, str]:
    """Bearer token headers for ``test_user`` (real JWT, no route round-trip)."""
    token = create_access_token(
        {"user_id": str(test_user.id), "email": test_user.email}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def authed_client(client: AsyncClient, test_user: User) -> AsyncClient:
    """
    ``client`` with ``get_current_user`` overridden to return ``test_user``.

    Use this for task-route tests that don't need to exercise auth itself —
    it eliminates the JWT/DB round-trip and isolates CRUD behaviour.
    """
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield client
    # .pop instead of del: a test might have replaced the override manually
    app.dependency_overrides.pop(get_current_user, None)


# ─── Global state resets (autouse) ──────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_revoked_jtis():
    """Clear the in-process token revocation set before and after every test."""
    auth_module._REVOKED_JTIS.clear()
    yield
    auth_module._REVOKED_JTIS.clear()


@pytest.fixture(autouse=True)
def _disable_rate_limiter():
    """
    Disable slowapi for the duration of every test.

    ``register`` and ``login`` carry ``@limiter.limit("5/minute")``.  Without
    this fixture, running the full suite in under a minute would trigger 429s.
    The one test that explicitly verifies the 429 path re-enables the limiter
    inside its body.

    Note: the public attribute is ``limiter.enabled``, not ``limiter._enabled``.
    Setting ``_enabled`` (private) is a shadow attribute that has no effect.
    """
    limiter.enabled = False
    yield
    limiter.enabled = True
