"""Aggregate numbers for the public dashboard.

Privacy rule: no number is published for a group of fewer than `min_group_size` reports.
That covers the whole dataset too: with too few reports, only the count is returned.
"""

from datetime import UTC, datetime

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from .schemas import Bucket, Group, Overall, Stats

BUCKETS: list[tuple[str, int, int | None]] = [
    ("0–7", 0, 7),
    ("8–14", 8, 14),
    ("15–30", 15, 30),
    ("31–60", 31, 60),
    ("61–90", 61, 90),
    ("91+", 91, None),
]

DIMENSIONS = {
    "by_state": "state",
    "by_payer": "payer",
    "by_supplier": "supplier",
    "by_problem": "problem",
    "by_month": "to_char(broke_month, 'YYYY-MM')",
}

OVERALL_SQL = """
SELECT
    count(*) AS reports,
    count(*) FILTER (WHERE resolved) AS resolved,
    count(*) FILTER (WHERE NOT resolved) AS ongoing,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days_without_chair) AS median_days,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY days_without_chair) AS p75_days,
    percentile_cont(0.9) WITHIN GROUP (ORDER BY days_without_chair) AS p90_days,
    count(*) FILTER (WHERE days_without_chair > 30) AS over_30_days,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_first_visit)
        AS median_days_to_first_visit,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days_waiting_approval)
        AS median_days_waiting_approval,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days_waiting_parts)
        AS median_days_waiting_parts,
    coalesce(sum(promises_broken), 0) AS promises_broken,
    count(*) FILTER (WHERE state_deadline_missed) AS state_deadline_missed,
    count(state_deadline_missed) AS state_deadline_checked
FROM reports
"""

# The column expression comes from DIMENSIONS above, never from a request.
GROUP_SQL = """
SELECT
    {column} AS key,
    count(*) AS reports,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days_without_chair) AS median_days,
    percentile_cont(0.9) WITHIN GROUP (ORDER BY days_without_chair) AS p90_days,
    count(*) FILTER (WHERE resolved) AS resolved
FROM reports
GROUP BY 1
ORDER BY {order}
"""


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), 1)


async def compute_stats(conn: AsyncConnection, min_group_size: int) -> Stats:
    async with conn.cursor(row_factory=dict_row) as cursor:
        await cursor.execute(OVERALL_SQL)
        row = await cursor.fetchone()
        assert row is not None
        reports = int(row["reports"])
        enough = reports >= min_group_size

        overall = Overall(
            reports=reports,
            resolved=int(row["resolved"]) if enough else 0,
            ongoing=int(row["ongoing"]) if enough else 0,
            median_days=_round(row["median_days"]) if enough else None,
            p75_days=_round(row["p75_days"]) if enough else None,
            p90_days=_round(row["p90_days"]) if enough else None,
            over_30_days=int(row["over_30_days"]) if enough else 0,
            median_days_to_first_visit=_round(row["median_days_to_first_visit"])
            if enough
            else None,
            median_days_waiting_approval=_round(row["median_days_waiting_approval"])
            if enough
            else None,
            median_days_waiting_parts=_round(row["median_days_waiting_parts"]) if enough else None,
            promises_broken=int(row["promises_broken"]) if enough else 0,
            state_deadline_missed=int(row["state_deadline_missed"]) if enough else 0,
            state_deadline_checked=int(row["state_deadline_checked"]) if enough else 0,
        )

        histogram: list[Bucket] = []
        groups: dict[str, list[Group]] = {name: [] for name in DIMENSIONS}
        suppressed = 0

        if enough:
            for label, low, high in BUCKETS:
                if high is None:
                    await cursor.execute(
                        "SELECT count(*) AS n FROM reports WHERE days_without_chair >= %s", (low,)
                    )
                else:
                    await cursor.execute(
                        "SELECT count(*) AS n FROM reports "
                        "WHERE days_without_chair BETWEEN %s AND %s",
                        (low, high),
                    )
                count = await cursor.fetchone()
                assert count is not None
                histogram.append(Bucket(label=label, min=low, max=high, reports=int(count["n"])))

            for name, column in DIMENSIONS.items():
                order = "key" if name == "by_month" else "median_days DESC, key"
                await cursor.execute(GROUP_SQL.format(column=column, order=order))
                for group in await cursor.fetchall():
                    if int(group["reports"]) < min_group_size:
                        suppressed += 1
                        continue
                    groups[name].append(
                        Group(
                            key=str(group["key"]),
                            reports=int(group["reports"]),
                            median_days=float(_round(group["median_days"]) or 0),
                            p90_days=float(_round(group["p90_days"]) or 0),
                            resolved=int(group["resolved"]),
                        )
                    )

    return Stats(
        generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
        min_group_size=min_group_size,
        overall=overall,
        histogram=histogram,
        suppressed_groups=suppressed,
        **groups,
    )
