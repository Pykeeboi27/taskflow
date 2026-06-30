"""Authentication routes for the Taskflow API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    is_token_revoked,
    oauth2_scheme,
    revoke_token,
    verify_password,
)
from app.database import get_db
from app.limiter import limiter
from app.models import User
from app.schemas import (
    LoginRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    TokenResponse,
)


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _auth_error(status_code: int, error: str, message: str, field: str | None = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"error": error, "message": message, "field": field},
    )


def _token_payload(user: User) -> dict:
    return {"sub": str(user.id), "user_id": str(user.id), "email": user.email}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        raise _auth_error(
            status.HTTP_409_CONFLICT,
            "email_exists",
            "A user with this email already exists.",
            "email",
        )

    user = User(email=payload.email, password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token_data = _token_payload(user)
    return TokenResponse(
        user_id=user.id,
        email=user.email,
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password):
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_credentials",
            "Invalid email or password.",
            "email",
        )

    token_data = _token_payload(user)
    return TokenResponse(
        user_id=user.id,
        email=user.email,
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> RefreshResponse:
    token_data = decode_token(payload.refresh_token)
    if token_data.get("token_type") != "refresh":
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "Refresh token is invalid or expired.",
            "refresh_token",
        )

    user_id = token_data.get("sub") or token_data.get("user_id")

    if not user_id:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "Refresh token is invalid or expired.",
            "refresh_token",
        )

    try:
        user_uuid = UUID(str(user_id))
    except (TypeError, ValueError) as exc:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_token",
            "Refresh token is invalid or expired.",
            "refresh_token",
        ) from exc

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "user_not_found",
            "User not found.",
            "refresh_token",
        )

    token_data = _token_payload(user)
    return RefreshResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ = current_user
    try:
        payload = decode_token(token)
        jti = payload.get("jti")
        if jti:
            revoke_token(str(jti))
    except Exception:
        # If decode fails for any reason, the client-side logout still proceeds.
        pass
    return {"message": "Logout successful"}