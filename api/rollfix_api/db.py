"""Database access: a connection pool and a tiny forward-only migration runner."""

from importlib import resources

from psycopg import AsyncConnection, sql
from psycopg_pool import AsyncConnectionPool

MIGRATIONS = "rollfix_api.migrations"
# Any constant works; it only has to be the same for every instance of the API.
LOCK_ID = 7_265_310


def migration_files() -> list[tuple[int, str, str]]:
    """(version, name, SQL) for every migration, in order."""
    found = []
    for entry in resources.files(MIGRATIONS).iterdir():
        name = entry.name
        if name.endswith(".sql"):
            found.append((int(name.split("_", 1)[0]), name, entry.read_text(encoding="utf-8")))
    return sorted(found)


async def migrate(conn: AsyncConnection) -> list[str]:
    """Apply migrations that haven't run yet. Safe to call from several instances at once."""
    applied: list[str] = []
    async with conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_ID,))
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version integer PRIMARY KEY,
                name text NOT NULL,
                applied_on date NOT NULL DEFAULT current_date
            )
            """
        )
        cursor = await conn.execute("SELECT version FROM schema_migrations")
        done = {row[0] for row in await cursor.fetchall()}
        for version, name, statements in migration_files():
            if version in done:
                continue
            await conn.execute(sql.SQL(statements))
            await conn.execute(
                "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)", (version, name)
            )
            applied.append(name)
    return applied


def create_pool(url: str) -> AsyncConnectionPool:
    return AsyncConnectionPool(
        url, min_size=1, max_size=10, open=False, kwargs={"autocommit": True}
    )
