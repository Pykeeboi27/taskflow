"""Shared rate-limiter instance used by both the app factory and routers."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
