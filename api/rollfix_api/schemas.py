"""Request and response models. Reports are validated strictly: unknown fields are rejected."""

from datetime import date
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

StateCode = Literal[
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
    "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
    "VT", "VA", "WA", "WV", "WI", "WY",
]  # fmt: skip
Payer = Literal[
    "medicare",
    "medicaid",
    "dual",
    "medicare_advantage",
    "medicaid_managed_care",
    "private",
    "va",
    "workers_comp",
    "self_pay",
    "other",
]
Supplier = Literal["numotion", "nsm", "hoveround", "independent", "not_shared"]
Problem = Literal[
    "batteries", "motor", "controller", "seating", "wheels", "brakes", "charger", "frame", "other"
]
Severity = Literal["stranded", "unsafe", "limited"]
Days = Annotated[int, Field(ge=0, le=3650)]
Month = Annotated[str, StringConstraints(pattern=r"^(20\d{2})-(0[1-9]|1[0-2])$")]


class Report(BaseModel):
    """The anonymous numbers from one repair. Mirrors src/lib/stats/payload.ts in the app."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    schema_: Literal[1] = Field(alias="schema")
    state: StateCode
    payer: Payer
    supplier: Supplier
    problem: Problem
    severity: Severity
    broke_month: Month
    resolved: bool
    days_without_chair: Days
    days_to_first_visit: Days | None
    days_waiting_approval: Days | None
    days_waiting_parts: Days | None
    promises_made: Annotated[int, Field(ge=0, le=1000)]
    promises_broken: Annotated[int, Field(ge=0, le=1000)]
    had_loaner: bool
    state_deadline_missed: bool | None

    @model_validator(mode="after")
    def check(self) -> Self:
        if self.promises_broken > self.promises_made:
            raise ValueError("promises_broken can't be more than promises_made")
        month = date.fromisoformat(f"{self.broke_month}-01")
        if month > date.today().replace(day=1):
            raise ValueError("broke_month can't be in the future")
        return self

    def month_start(self) -> date:
        return date.fromisoformat(f"{self.broke_month}-01")


class Receipt(BaseModel):
    """Returned once when a report is created. The token is never stored in plain text."""

    id: UUID
    token: str


class Group(BaseModel):
    key: str
    reports: int
    median_days: float
    p90_days: float
    resolved: int


class Bucket(BaseModel):
    label: str
    min: int
    max: int | None
    reports: int


class Overall(BaseModel):
    reports: int
    resolved: int
    ongoing: int
    median_days: float | None
    p75_days: float | None
    p90_days: float | None
    over_30_days: int
    median_days_to_first_visit: float | None
    median_days_waiting_approval: float | None
    median_days_waiting_parts: float | None
    promises_broken: int
    state_deadline_missed: int
    state_deadline_checked: int


class Stats(BaseModel):
    generated_at: str
    min_group_size: int
    overall: Overall
    histogram: list[Bucket]
    by_state: list[Group]
    by_payer: list[Group]
    by_supplier: list[Group]
    by_problem: list[Group]
    by_month: list[Group]
    suppressed_groups: int


class Version(BaseModel):
    name: str
    version: str
    build: str
    commit: str
