"""Alembic environment configuration for async SQLAlchemy."""

import asyncio
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# Load .env so DATABASE_URL is available when running migrations from the CLI.
load_dotenv()

# Alembic Config object for access to values in alembic.ini.
config = context.config

# Override the sqlalchemy.url from the environment variable so the ini
# file never needs to hold real credentials.
database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./tasks.db")
config.set_main_option("sqlalchemy.url", database_url)

# Set up Python loggers from alembic.ini if a logging section is present.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import metadata so Alembic can autogenerate migrations.
# app.models registers User and Task against Base.metadata.
from app.database import Base  # noqa: E402
import app.models  # noqa: E402, F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in offline mode (no live DB connection required)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations via a sync proxy."""
    connectable = create_async_engine(database_url, poolclass=pool.NullPool)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in online mode using asyncio."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
