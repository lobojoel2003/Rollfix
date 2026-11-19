import os
from collections.abc import Iterator
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from rollfix_api.config import Settings
from rollfix_api.main import create_app

DATABASE_URL = os.environ.get(
    "ROLLFIX_TEST_DATABASE_URL", "postgresql://rollfix:rollfix@localhost:5433/rollfix_test"
)
ORIGIN = "https://rollfix.example"


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "database_url": DATABASE_URL,
        "allowed_origins": [ORIGIN],
        "min_group_size": 5,
        "write_limit_per_hour": 1000,
        "stats_cache_seconds": 0,
        "build_number": "42",
        "commit": "abc1234",
    }
    values.update(overrides)
    return Settings(**values)


@pytest.fixture(autouse=True)
def clean_database() -> None:
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        conn.execute("DROP TABLE IF EXISTS reports, schema_migrations")


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app(make_settings())) as test_client:
        yield test_client


def report(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "schema": 1,
        "state": "CT",
        "payer": "medicaid",
        "supplier": "numotion",
        "problem": "motor",
        "severity": "stranded",
        "broke_month": "2026-10",
        "resolved": False,
        "days_without_chair": 23,
        "days_to_first_visit": 7,
        "days_waiting_approval": None,
        "days_waiting_parts": None,
        "promises_made": 3,
        "promises_broken": 2,
        "had_loaner": False,
        "state_deadline_missed": True,
    }
    body.update(overrides)
    return body
