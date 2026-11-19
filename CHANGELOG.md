# Changelog

All notable changes to Rollfix are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Rollfix uses
[Semantic Versioning](https://semver.org/). The web app and the stats API share one version.

## [Unreleased]

## [1.0.0] - 2026-11-19

The first release of Rollfix: a repair log for power wheelchair users.

### Added

- **Day counter.** "Day 23 without your chair", counted from the day the chair stopped working,
  moving on at midnight and stopping on the day it's fixed.
- **Timeline** of calls, messages, technician visits, no-shows, insurance requests and decisions,
  parts, loaners, letters and how the delay affected you, with quick-add buttons, editing and
  deletion.
- **Promises** with due dates, flagged when they're past due, and marked kept or broken in one tap.
- **State rules** as YAML files with citations, checked against the official texts on 2026-11-19:
  - Connecticut: the 10-business-day repair deadline (pausing while waiting for prior
    authorization or parts) and the 3-business-day parts deadline, counted from the timeline;
    one-business-day response and home repair; no prior authorization from Medicaid or private
    plans; loaner costs under the assistive device warranty law; Lincoln Day as a state holiday.
  - Oregon: 72-hour prior authorization decisions for complex rehab repairs (counted), and right to
    repair electric wheelchairs.
  - Colorado, Washington, Nevada, Maryland and Rhode Island: right-to-repair and prior
    authorization protections.
  - Medicare: supplier standards on complaints, rented equipment and warranty repairs, and
    coverage of repairs to owned equipment.
  - A page for every state and D.C., with where to complain.
- **Letters** to the supplier, the insurer or a state office, filled in from the log with every
  missed promise, logged effects and a cited paragraph for each rule that applies; live preview,
  PDF made on the device, print, copy, plain text, and "I sent it" to log it.
- **Timeline PDF** for doctors, advocates and your records.
- **Opt-in anonymous sharing** of delay numbers, with a preview of exactly what is sent, and
  update or removal later.
- **Public delay dashboard** with the median days without a chair, a distribution chart and
  tables by state, insurance, supplier and problem; groups under 5 are never shown; CSV download.
- **Stats API** (FastAPI and PostgreSQL) with strict validation, hashed tokens, rate limiting, no
  IP addresses or access logs, migrations, health checks and a container image.
- **Installable and offline**: web app manifest, maskable icons and a service worker.
- **Privacy**: the log stays in the browser; backups to and from a JSON file, validated on import;
  delete everything in one step.
- **Accessibility**: keyboard and switch friendly, 48 px targets, focus moved to what changed,
  spoken confirmations, error summaries, text size setting, dark mode, Windows High Contrast,
  reflow at 320 px; axe checks on every page.
- **Sample data** to try the app.
- **CI/CD**: lint, types, rules validation, unit tests with coverage, API tests on PostgreSQL,
  container smoke test, end-to-end tests against the real API, dependency audits, CodeQL, GitHub
  Pages deployment, and tagged releases with build numbers, SBOMs, checksums, signed provenance
  and a GHCR image.

[Unreleased]: https://github.com/lobojoel2003/Rollfix/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lobojoel2003/Rollfix/releases/tag/v1.0.0
