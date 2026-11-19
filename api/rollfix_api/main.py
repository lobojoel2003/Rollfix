"""The Rollfix stats API.

People who log a wheelchair repair in Rollfix can choose to share the anonymous numbers
(days without the chair, days waiting for approval or parts, and a few categories). This
service stores them and publishes aggregates for advocates. Nothing else is collected.
"""

import hashlib
import hmac
import secrets
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from . import __version__
from .config import Settings, get_settings
from .db import create_pool, migrate
from .ratelimit import RateLimiter
from .schemas import Receipt, Report, Stats, Version
from .stats import compute_stats

MAX_BODY_BYTES = 4096

COLUMNS = (
    "schema_version, state, payer, supplier, problem, severity, broke_month, resolved, "
    "days_without_chair, days_to_first_visit, days_waiting_approval, days_waiting_parts, "
    "promises_made, promises_broken, had_loaner, state_deadline_missed"
)


def _values(report: Report) -> tuple[object, ...]:
    return (
        report.schema_,
        report.state,
        report.payer,
        report.supplier,
        report.problem,
        report.severity,
        report.month_start(),
        report.resolved,
        report.days_without_chair,
        report.days_to_first_visit,
        report.days_waiting_approval,
        report.days_waiting_parts,
        report.promises_made,
        report.promises_broken,
        report.had_loaner,
        report.state_deadline_missed,
    )


def _hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    limiter = RateLimiter(settings.write_limit_per_hour)
    cache: dict[str, tuple[float, Stats]] = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        pool = create_pool(settings.database_url)
        await pool.open(wait=True, timeout=30)
        async with pool.connection() as conn:
            await migrate(conn)
        app.state.pool = pool
        try:
            yield
        finally:
            await pool.close()

    app = FastAPI(
        title="Rollfix stats API",
        version=__version__,
        description=(
            "Opt-in, anonymous power wheelchair repair delay numbers shared from the Rollfix app, "
            "and the aggregates behind its public dashboard. Groups smaller than "
            f"{settings.min_group_size} are never published."
        ),
        lifespan=lifespan,
        license_info={"name": "AGPL-3.0-only", "identifier": "AGPL-3.0-only"},
    )
    app.state.limiter = limiter
    app.state.stats_cache = cache

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["content-type", "authorization"],
        allow_credentials=False,
        max_age=600,
    )

    @app.middleware("http")
    async def guard(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        length = request.headers.get("content-length")
        if length is not None and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            return JSONResponse({"detail": "Request body too large."}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    async def connection(request: Request) -> AsyncIterator[AsyncConnection]:
        pool: AsyncConnectionPool = request.app.state.pool
        async with pool.connection() as conn:
            yield conn

    Conn = Annotated[AsyncConnection, Depends(connection)]

    def client_address(request: Request) -> str:
        if settings.trust_proxy:
            forwarded = request.headers.get("x-forwarded-for", "")
            if forwarded:
                return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def limit_writes(request: Request) -> None:
        if not limiter.allow(client_address(request)):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests.")

    def bearer(authorization: Annotated[str | None, Header()] = None) -> str:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token.")
        return authorization[7:].strip()

    Token = Annotated[str, Depends(bearer)]

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"name": "rollfix-api", "version": __version__, "docs": "/docs"}

    @app.get("/healthz", tags=["health"])
    async def healthz() -> dict[str, str]:
        """Liveness: the process is up."""
        return {"status": "ok"}

    @app.get("/readyz", tags=["health"])
    async def readyz(conn: Conn) -> dict[str, str]:
        """Readiness: the database answers."""
        await conn.execute("SELECT 1")
        return {"status": "ok"}

    @app.get("/v1/version", tags=["health"])
    async def version() -> Version:
        return Version(
            name="rollfix-api",
            version=__version__,
            build=settings.build_number,
            commit=settings.commit,
        )

    @app.post(
        "/v1/reports",
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(limit_writes)],
        tags=["reports"],
    )
    async def create_report(report: Report, conn: Conn) -> Receipt:
        """Share one repair's numbers. Keep the token: it is needed to update or remove them."""
        report_id = uuid4()
        token = secrets.token_urlsafe(32)
        placeholders = ", ".join(["%s"] * 16)
        await conn.execute(
            f"INSERT INTO reports (id, token_hash, {COLUMNS}) VALUES (%s, %s, {placeholders})",  # noqa: S608
            (report_id, _hash(token), *_values(report)),
        )
        cache.clear()
        return Receipt(id=report_id, token=token)

    async def _check_token(conn: AsyncConnection, report_id: UUID, token: str) -> None:
        cursor = await conn.execute("SELECT token_hash FROM reports WHERE id = %s", (report_id,))
        row = await cursor.fetchone()
        # Same answer whether the report doesn't exist or the token is wrong.
        if row is None or not hmac.compare_digest(bytes(row[0]), _hash(token)):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found.")

    @app.put(
        "/v1/reports/{report_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(limit_writes)],
        tags=["reports"],
    )
    async def update_report(report_id: UUID, report: Report, token: Token, conn: Conn) -> None:
        """Replace a shared report, for example when the chair is finally fixed."""
        await _check_token(conn, report_id, token)
        assignments = ", ".join(f"{column.strip()} = %s" for column in COLUMNS.split(","))
        await conn.execute(
            f"UPDATE reports SET {assignments}, updated_on = current_date WHERE id = %s",  # noqa: S608
            (*_values(report), report_id),
        )
        cache.clear()

    @app.delete(
        "/v1/reports/{report_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(limit_writes)],
        tags=["reports"],
    )
    async def delete_report(report_id: UUID, token: Token, conn: Conn) -> None:
        """Remove a shared report for good."""
        await _check_token(conn, report_id, token)
        await conn.execute("DELETE FROM reports WHERE id = %s", (report_id,))
        cache.clear()

    async def cached_stats(conn: AsyncConnection) -> Stats:
        hit = cache.get("stats")
        now = time.monotonic()
        if hit and now - hit[0] < settings.stats_cache_seconds:
            return hit[1]
        stats = await compute_stats(conn, settings.min_group_size)
        cache["stats"] = (now, stats)
        return stats

    @app.get("/v1/stats", tags=["stats"])
    async def stats(conn: Conn, response: Response) -> Stats:
        """Aggregates for the public dashboard. Small groups are left out."""
        response.headers["Cache-Control"] = f"public, max-age={settings.stats_cache_seconds}"
        return await cached_stats(conn)

    @app.get("/v1/stats.csv", tags=["stats"], response_class=PlainTextResponse)
    async def stats_csv(conn: Conn) -> PlainTextResponse:
        """The same aggregates as CSV, for spreadsheets."""
        data = await cached_stats(conn)
        lines = ["group,key,reports,median_days,p90_days,resolved"]
        for name in ("by_state", "by_payer", "by_supplier", "by_problem", "by_month"):
            for group in getattr(data, name):
                lines.append(
                    f"{name},{group.key},{group.reports},{group.median_days},"
                    f"{group.p90_days},{group.resolved}"
                )
        return PlainTextResponse(
            "\n".join(lines) + "\n",
            media_type="text/csv; charset=utf-8",
            headers={
                "Cache-Control": f"public, max-age={settings.stats_cache_seconds}",
                "Content-Disposition": 'attachment; filename="rollfix-stats.csv"',
            },
        )

    return app


app = create_app()
