"""Authentication utilities for the Taskflow application."""

import os
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User


load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# In-process token revocation set keyed on JWT ID (jti).
# NOTE: This set is per-process and cleared on restart. For multi-worker or
# production deployments, replace with a shared store (e.g. Redis).
_REVOKED_JTIS: set[str] = set()


def revoke_token(jti: str) -> None:
    """Mark a JWT as revoked by its jti claim."""
    _REVOKED_JTIS.add(jti)


def is_token_revoked(jti: str) -> bool:
    """Return True if the JWT has been revoked."""
    return jti in _REVOKED_JTIS


def hash_password(password: str) -> str:
	# Bcrypt has a 72-byte limit. Truncate to ensure compatibility.
	return pwd_context.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
	# Truncate to match what was hashed.
	return pwd_context.verify(plain[:72], hashed)


def _create_token(data: dict, expires_delta: timedelta, token_type: str) -> str:
	payload = data.copy()
	if "user_id" in payload and "sub" not in payload:
		payload["sub"] = str(payload["user_id"])
	payload["token_type"] = token_type
	payload["jti"] = uuid4().hex  # unique token ID, used for revocation
	expire = datetime.now(timezone.utc) + expires_delta
	payload["exp"] = expire
	return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
	return _create_token(data, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES), "access")


def create_refresh_token(data: dict) -> str:
	return _create_token(data, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS), "refresh")


def decode_token(token: str) -> dict:
	try:
		return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
	except JWTError as exc:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Could not validate credentials",
			headers={"WWW-Authenticate": "Bearer"},
		) from exc


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)) -> User:
	payload = decode_token(token)

	jti = payload.get("jti")
	if jti and is_token_revoked(str(jti)):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Could not validate credentials",
			headers={"WWW-Authenticate": "Bearer"},
		)

	user_id = payload.get("sub") or payload.get("user_id")

	if not user_id:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Could not validate credentials",
			headers={"WWW-Authenticate": "Bearer"},
		)

	try:
		user_uuid = UUID(str(user_id))
	except (TypeError, ValueError) as exc:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Could not validate credentials",
			headers={"WWW-Authenticate": "Bearer"},
		) from exc

	result = await db.execute(select(User).where(User.id == user_uuid))
	user = result.scalar_one_or_none()

	if user is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Could not validate credentials",
			headers={"WWW-Authenticate": "Bearer"},
		)

	return user
