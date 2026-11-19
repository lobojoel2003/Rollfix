from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from rollfix_api.config import Settings
from rollfix_api.main import create_app

from .conftest import DATABASE_URL, ORIGIN, make_settings, report


def stored() -> list[dict[str, Any]]:
    with psycopg.connect(DATABASE_URL, row_factory=psycopg.rows.dict_row) as conn:
        return conn.execute("SELECT * FROM reports").fetchall()


def test_health_and_version(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"status": "ok"}
    assert client.get("/v1/version").json() == {
        "name": "rollfix-api",
        "version": "1.0.0",
        "build": "42",
        "commit": "abc1234",
    }
    assert client.get("/").json()["docs"] == "/docs"


def test_create_report_stores_only_the_numbers(client: TestClient) -> None:
    response = client.post("/v1/reports", json=report())
    assert response.status_code == 201
    receipt = response.json()
    assert len(receipt["token"]) >= 40

    rows = stored()
    assert len(rows) == 1
    row = rows[0]
    assert str(row["id"]) == receipt["id"]
    # The token is stored only as a hash.
    assert receipt["token"].encode() not in bytes(row["token_hash"])
    assert row["state"] == "CT"
    assert row["broke_month"].isoformat() == "2026-10-01"
    assert row["days_without_chair"] == 23
    assert set(row) == {
        "id",
        "token_hash",
        "schema_version",
        "state",
        "payer",
        "supplier",
        "problem",
        "severity",
        "broke_month",
        "resolved",
        "days_without_chair",
        "days_to_first_visit",
        "days_waiting_approval",
        "days_waiting_parts",
        "promises_made",
        "promises_broken",
        "had_loaner",
        "state_deadline_missed",
        "created_on",
        "updated_on",
    }


@pytest.mark.parametrize(
    ("override", "reason"),
    [
        ({"state": "XX"}, "unknown state"),
        ({"payer": "cash"}, "unknown payer"),
        ({"broke_month": "2026-13"}, "bad month"),
        ({"broke_month": "2999-01"}, "future month"),
        ({"days_without_chair": -1}, "negative days"),
        ({"days_without_chair": 5000}, "too many days"),
        ({"days_without_chair": "23"}, "string instead of number"),
        ({"promises_broken": 4}, "more broken than made"),
        ({"schema": 2}, "unknown schema"),
        ({"name": "Alex"}, "extra field"),
        ({"notes": "anything"}, "extra field"),
    ],
)
def test_rejects_invalid_reports(client: TestClient, override: dict[str, Any], reason: str) -> None:
    response = client.post("/v1/reports", json=report(**override))
    assert response.status_code == 422, reason
    assert stored() == []


def test_rejects_large_bodies(client: TestClient) -> None:
    response = client.post(
        "/v1/reports",
        content=b"{" + b" " * 5000 + b"}",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413


def test_update_and_delete_need_the_token(client: TestClient) -> None:
    receipt = client.post("/v1/reports", json=report()).json()
    url = f"/v1/reports/{receipt['id']}"
    good = {"authorization": f"Bearer {receipt['token']}"}
    bad = {"authorization": "Bearer not-the-token"}

    assert client.put(url, json=report(resolved=True)).status_code == 401
    assert client.put(url, json=report(resolved=True), headers=bad).status_code == 404
    assert client.delete(url, headers=bad).status_code == 404
    assert stored()[0]["resolved"] is False

    updated = report(resolved=True, days_without_chair=40)
    assert client.put(url, json=updated, headers=good).status_code == 204
    row = stored()[0]
    assert row["resolved"] is True
    assert row["days_without_chair"] == 40

    assert client.delete(url, headers=good).status_code == 204
    assert stored() == []
    assert client.delete(url, headers=good).status_code == 404


def test_unknown_report_is_404(client: TestClient) -> None:
    headers = {"authorization": "Bearer whatever"}
    response = client.delete("/v1/reports/00000000-0000-0000-0000-000000000000", headers=headers)
    assert response.status_code == 404
    assert client.delete("/v1/reports/not-a-uuid", headers=headers).status_code == 422


def test_cors_allows_only_the_configured_origin(client: TestClient) -> None:
    preflight = client.options(
        "/v1/reports",
        headers={
            "origin": ORIGIN,
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == ORIGIN

    other = client.get("/v1/stats", headers={"origin": "https://evil.example"})
    assert "access-control-allow-origin" not in other.headers


def test_security_headers(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "no-store"


def test_rate_limits_writes() -> None:
    with TestClient(create_app(make_settings(write_limit_per_hour=2))) as limited:
        assert limited.post("/v1/reports", json=report()).status_code == 201
        assert limited.post("/v1/reports", json=report()).status_code == 201
        assert limited.post("/v1/reports", json=report()).status_code == 429
        # Reads are never limited.
        assert limited.get("/v1/stats").status_code == 200


def test_rate_limit_uses_forwarded_address_behind_a_proxy() -> None:
    settings = make_settings(write_limit_per_hour=1, trust_proxy=True)
    with TestClient(create_app(settings)) as proxied:
        first = {"x-forwarded-for": "203.0.113.1, 10.0.0.1"}
        second = {"x-forwarded-for": "203.0.113.2"}
        assert proxied.post("/v1/reports", json=report(), headers=first).status_code == 201
        assert proxied.post("/v1/reports", json=report(), headers=first).status_code == 429
        assert proxied.post("/v1/reports", json=report(), headers=second).status_code == 201


def test_settings_split_origins_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROLLFIX_ALLOWED_ORIGINS", "https://a.example/, https://b.example")
    assert Settings().allowed_origins == ["https://a.example", "https://b.example"]


def test_migrations_run_once(client: TestClient) -> None:
    with psycopg.connect(DATABASE_URL) as conn:
        versions = conn.execute("SELECT version FROM schema_migrations").fetchall()
    assert versions == [(1,)]
    # Starting a second instance doesn't re-run them.
    with TestClient(create_app(make_settings())) as again:
        assert again.get("/readyz").status_code == 200
