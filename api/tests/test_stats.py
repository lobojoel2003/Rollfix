from fastapi.testclient import TestClient

from rollfix_api.main import create_app
from rollfix_api.ratelimit import RateLimiter

from .conftest import make_settings, report


def share(client: TestClient, count: int, **overrides: object) -> None:
    for _ in range(count):
        assert client.post("/v1/reports", json=report(**overrides)).status_code == 201


def test_too_few_reports_reveal_nothing(client: TestClient) -> None:
    share(client, 4, days_without_chair=60)
    stats = client.get("/v1/stats").json()
    assert stats["overall"]["reports"] == 4
    assert stats["overall"]["median_days"] is None
    assert stats["overall"]["over_30_days"] == 0
    assert stats["histogram"] == []
    assert stats["by_state"] == []
    assert stats["suppressed_groups"] == 0


def test_aggregates_and_suppresses_small_groups(client: TestClient) -> None:
    share(client, 5, state="CT", days_without_chair=10, resolved=True)
    share(client, 5, state="CT", days_without_chair=50, days_waiting_approval=20)
    share(client, 2, state="CO", days_without_chair=100, payer="medicare", supplier="nsm")

    stats = client.get("/v1/stats").json()
    overall = stats["overall"]
    assert overall["reports"] == 12
    assert overall["resolved"] == 5
    assert overall["ongoing"] == 7
    assert overall["median_days"] == 50
    assert overall["over_30_days"] == 7
    assert overall["median_days_waiting_approval"] == 20
    assert overall["state_deadline_missed"] == 12
    assert overall["state_deadline_checked"] == 12
    assert overall["promises_broken"] == 24

    # Colorado has only 2 reports, so it is hidden everywhere it would be alone.
    assert [group["key"] for group in stats["by_state"]] == ["CT"]
    assert stats["by_state"][0]["reports"] == 10
    assert stats["by_state"][0]["median_days"] == 30
    assert [group["key"] for group in stats["by_payer"]] == ["medicaid"]
    assert [group["key"] for group in stats["by_supplier"]] == ["numotion"]
    assert stats["suppressed_groups"] == 3

    histogram = {bucket["label"]: bucket["reports"] for bucket in stats["histogram"]}
    assert histogram == {"0–7": 0, "8–14": 5, "15–30": 0, "31–60": 5, "61–90": 0, "91+": 2}
    assert stats["by_month"] == [
        {"key": "2026-10", "reports": 12, "median_days": 50.0, "p90_days": 95.0, "resolved": 5}
    ]


def test_stats_csv(client: TestClient) -> None:
    share(client, 5)
    response = client.get("/v1/stats.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.splitlines()
    assert lines[0] == "group,key,reports,median_days,p90_days,resolved"
    assert "by_state,CT,5,23.0,23.0,0" in lines


def test_stats_are_cached_and_cache_clears_on_write() -> None:
    with TestClient(create_app(make_settings(stats_cache_seconds=300))) as client:
        share(client, 5)
        first = client.get("/v1/stats")
        assert first.headers["cache-control"] == "public, max-age=300"
        assert first.json()["overall"]["reports"] == 5
        share(client, 1)
        assert client.get("/v1/stats").json()["overall"]["reports"] == 6


def test_rate_limiter_window() -> None:
    limiter = RateLimiter(limit=2, window_seconds=10)
    assert limiter.allow("a", now=0)
    assert limiter.allow("a", now=1)
    assert not limiter.allow("a", now=2)
    assert limiter.allow("b", now=2)
    assert limiter.allow("a", now=12)
    limiter._sweep(now=100)
    assert limiter._hits == {}
    limiter.reset()
