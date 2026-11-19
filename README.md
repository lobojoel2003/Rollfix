# Rollfix

![Rollfix: Day 23 without your chair. Log every call and promise. Know your state's repair rules. Turn the timeline into a dated, firm letter.](docs/images/banner.png)

**A repair log for power wheelchair users.** When a chair breaks, Rollfix counts the days
without it, keeps a dated timeline of every call, visit and promise, knows your state's repair
rules, and turns it all into a polite, firm letter to your supplier, your insurer or the state.
It works offline, keeps everything on your device, and is built for keyboards, switches and
screen readers. If you choose, you can share anonymous delay numbers with advocates.

[![CI](https://github.com/lobojoel2003/Rollfix/actions/workflows/ci.yml/badge.svg)](https://github.com/lobojoel2003/Rollfix/actions/workflows/ci.yml)
[![Deploy](https://github.com/lobojoel2003/Rollfix/actions/workflows/deploy.yml/badge.svg)](https://github.com/lobojoel2003/Rollfix/actions/workflows/deploy.yml)
[![CodeQL](https://github.com/lobojoel2003/Rollfix/actions/workflows/codeql.yml/badge.svg)](https://github.com/lobojoel2003/Rollfix/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/lobojoel2003/Rollfix?sort=semver)](https://github.com/lobojoel2003/Rollfix/releases/latest)
[![WCAG 2.2 AA](https://img.shields.io/badge/accessibility-WCAG%202.2%20AA%20tested-2a3b9c)](#accessibility)
[![Code: AGPL-3.0](https://img.shields.io/badge/code-AGPL--3.0-blue)](LICENSE)
[![Rules: CC BY 4.0](https://img.shields.io/badge/rules-CC%20BY%204.0-lightgrey)](rules/LICENSE.md)

**Use it:** https://lobojoel2003.github.io/Rollfix/ (install it from your browser's menu to use it offline)

> **Not legal advice.** Rollfix helps you write things down and explains the rules in plain
> language. Each state page says when its rules were last checked and links to the law itself.

## Contents

- [Why Rollfix](#why-rollfix)
- [What it does](#what-it-does)
- [State coverage](#state-coverage)
- [Privacy](#privacy)
- [Accessibility](#accessibility)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Anonymous stats API](#anonymous-stats-api)
- [Project layout](#project-layout)
- [Versions, builds and releases](#versions-builds-and-releases)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [License and credits](#license-and-credits)

## Why Rollfix

When a power wheelchair breaks, the person who uses it can be stuck at home, or in bed, for
weeks while the supplier waits on insurance and parts.

- **Repairs take weeks.** In Connecticut, in-home wheelchair repairs took more than 49 days on
  average ([CT Mirror](https://ctmirror.org/2024/03/12/ct-wheelchair-repair-delays-bill/)), and in
  November 2023 the state's two main suppliers had 740 and 687 open service orders
  ([Connecticut Wheelchair Repair Task Force](https://www.cga.ct.gov/hs/tfs/20230727_Wheelchair%20Repair%20Task%20Force/Final%20Report/SA%2023-22%20Wheelchair%20Repair%20Task%20Force%20Final%20Report.pdf)).
- **Breakdowns are common, and they strand people.** In a study of 591 wheelchair users with
  spinal cord injury, 64% needed at least one repair in six months. Among people harmed by a
  breakdown, 27% were stranded inside their home and 12% were stuck in bed
  ([Harvard Health](https://www.health.harvard.edu/blog/millions-rely-on-wheelchairs-for-mobility-but-repair-delays-are-hurting-users-202207212785)).
- **The law is changing, but nobody collects the proof.** Colorado passed the first right-to-repair
  law for powered wheelchairs in 2022. Connecticut now sets a 10-business-day repair deadline,
  and Oregon, Washington, Nevada, Maryland and Rhode Island have passed repair laws of their own.
  Advocacy groups such as [PIRG](https://pirg.org/iowa/resources/stranded/) publish reports on the
  problem, but wheelchair users had no tool of their own: a GitHub search for "wheelchair repair"
  found only shop directories and a game.

**The gap Rollfix fills:** a tool _for the person waiting_, that turns their own dated record
into the evidence a supplier, insurer, regulator or legislator can't ignore.

## What it does

|                                                                                                                                                |                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ![The home screen: "Day 23 without your chair", a dated timeline with missed promises, and the state's repair deadlines](docs/images/home.png) | ![A letter to the supplier built from the timeline, with a live preview and a PDF button](docs/images/letter.png) |
| **One number at the top.** Day 23 without your chair, and below it every call and promise.                                                     | **One button, one letter.** Dated, polite and firm, with your state's rules and the timeline attached.            |
| ![A state rules page listing the law, the repair deadlines Rollfix checks and where to complain](docs/images/rules.png)                        | ![The public delay dashboard with the median days without a chair and tables by state](docs/images/dashboard.png) |
| **Knows your state's rules.** Deadlines are counted from your own log, with citations.                                                         | **Proof for advocates.** Opt-in anonymous numbers on a public dashboard (demo data shown).                        |

**The counter and the timeline**

- The day the chair stops working is **Day 1**. The count moves on at midnight and stops the day
  it's fixed.
- Log calls, messages, technician visits, no-shows, insurance requests and decisions, parts,
  loaners, letters, and **how the delay affected you**, in a few taps. Quick-add buttons cover
  the common ones.
- Record **promises** ("a technician will come Tuesday") with a date. Rollfix flags the ones that
  weren't kept, and lets you mark them kept or broken.
- Download the timeline as a PDF for your doctor, an advocate or your records.

**Your state's rules**

- Each state's law is a YAML file with citations. Rollfix finds the events on _your_ timeline
  that start and stop each legal clock (calendar or business days, skipping holidays) and tells
  you whether the deadline is running, met or missed, and by how many days.
- Medicare supplier rules apply everywhere when Medicare pays.
- Every state has a page listing where to complain, even where there's no wheelchair-specific law.

**Letters**

- To the **supplier** (a repair date, a loaner, a written answer), the **insurer** (a fast
  decision, what's missing, appeal rights) or **a state office** (a formal complaint).
- Everything is filled in from the log: dates, the day count, each missed promise, the effects
  you logged, and a paragraph for every rule that applies, citing the law.
- Live preview with highlighted values and warnings for anything missing; **PDF** (made on the
  device with [pdf-lib](https://pdf-lib.js.org/)), print, copy or plain text. Then one tap logs
  that you sent it.

**Sharing, only if you want**

- Share a repair's anonymous numbers (days without the chair, days waiting for a visit, approval
  and parts, promises kept or broken) with the public dashboard. You see exactly what is sent,
  and you can update or remove it later.

|                                                                                  |                                                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ![Rollfix on a phone, showing Day 23 without your chair](docs/images/mobile.png) | ![Adding a phone call to the timeline, with large choices and a promise date](docs/images/entry.png) |

## State coverage

<!-- coverage:start -->

Checked against the official texts on November 19, 2026. **Counted** means Rollfix works out the
deadline from your own timeline and puts the result in your letters.

| State                      | Law (in force)                                                            | What Rollfix does with it                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connecticut**            | Public Act 24-58 (2024), amended 2026: C.G.S. §§ 42-337, 42-338, 17b-278i | **Counted:** repair within 10 business days of the request, pausing while waiting for prior authorization or parts; order parts within 3 business days. **Cited:** an answer within 1 business day, home repair for complex rehab chairs, no prior authorization from Medicaid or (since 2025) private plans, loaner costs under the warranty law |
| **Oregon**                 | SB 549 and SB 550 (2025), in force January 1, 2026                        | **Counted:** Oregon Health Plan and CCO prior-authorization decisions on complex rehab repairs within 72 hours. **Cited:** right to repair electric wheelchairs                                                                                                                                                                                   |
| **Colorado**               | HB22-1031 (C.R.S. § 6-1-1503) and HB22-1290 (C.R.S. § 25.5-5-323(4))      | **Cited:** the first powered-wheelchair right-to-repair law; Medicaid may not require prior authorization for any complex rehab repair                                                                                                                                                                                                            |
| **Rhode Island**           | R.I. Gen. Laws ch. 6-61 (2025)                                            | **Cited:** no prior authorization or paperwork for complex wheelchair repairs (plans from January 1, 2026); suppliers must service what they sell; parts access                                                                                                                                                                                   |
| **Washington**             | SB 5680 (2025), RCW 19.425                                                | **Cited:** right to repair power and manual wheelchairs, enforced by the Attorney General                                                                                                                                                                                                                                                         |
| **Nevada**                 | AB 407 (2025), NRS 597.267 to 597.2697                                    | **Cited:** right to repair mobility devices; violations are deceptive trade practices                                                                                                                                                                                                                                                             |
| **Maryland**               | HB 31 (2025), Com. Law §§ 14-5001 to 14-5004                              | **Cited:** right to repair batteries, chargers, joysticks, wheels and other common parts                                                                                                                                                                                                                                                          |
| **Medicare** (every state) | 42 C.F.R. § 424.57(c) and § 414.210(e)                                    | **Cited:** supplier duties to answer complaints and keep a complaint log, no-charge repairs of rentals and warranty work, Medicare coverage of repairs you own                                                                                                                                                                                    |
| Every other state          | None specific to wheelchair repair yet                                    | Letters still work everywhere; each state page lists where to complain                                                                                                                                                                                                                                                                            |

Every state page lists the office to complain to, with its official online form. **Not included,
on purpose:** New York's and Massachusetts's wheelchair repair bills (not enacted), Minnesota's
Digital Fair Repair Act (it excludes medical devices), and California's SB 1384 (2024), which
couldn't be checked against the official text for this release.

<!-- coverage:end -->

Rules come from statutes and session laws on each legislature's site and are re-checked before
every release. Spot a mistake or a new law? Use the
[rules correction form](https://github.com/lobojoel2003/Rollfix/issues/new?template=rules-correction.yml)
or see the [rules guide](rules/README.md).

## Privacy

- **On your device only.** The log is stored in your browser (IndexedDB). No account, no server
  copy, no analytics, no cookies, no third-party scripts or fonts, enforced by a strict Content
  Security Policy.
- **Letters and PDFs are made on your device.**
- **Sharing is opt-in, per repair**, sends only counts and a few categories (never names, notes,
  contact details or exact dates), and can be undone. The stats server keeps no IP addresses or
  access logs, and never publishes a group of fewer than 5 repairs.
- **Backups** are a JSON file you download and keep; restoring one is validated field by field.

## Accessibility

Rollfix is built for the people who use it. It targets **WCAG 2.2 AA** and goes further where it
matters:

| For                 | Rollfix                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| Keyboard and switch | Real buttons and links in a simple order; radio groups use arrow keys; no drag, hover or time limits      |
| Motor and dexterity | Targets at least 48 px; whole-row choices; quick-add buttons; letters that write themselves               |
| Screen readers      | Landmarks, one `h1` per page, labelled fields, error summaries that link to fields, spoken confirmations  |
| Focus               | Moves to what changed after saving; a high-contrast ring everywhere, even inside date pickers             |
| Low vision          | High contrast in light and dark mode, Windows High Contrast, a text size setting, reflow at 320 px / 400% |
| Voice control       | Visible labels that match accessible names                                                                |
| Charts              | A text summary and a table behind every chart                                                             |

Every page is checked automatically with [axe](https://github.com/dequelabs/axe-core) in CI, in
light and dark mode and with errors showing, and a test completes a whole repair log and letter
with the keyboard alone. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#accessibility).

## How it works

```mermaid
flowchart LR
  subgraph device["On your device"]
    UI[SvelteKit app] <--> IDB[(IndexedDB log)]
    UI --> ENG[Day count, deadlines,<br/>letters, PDF]
    SW[Service worker] -.offline.-> UI
  end
  YAML[rules/*.yaml<br/>letters/*.yaml] -- validated at build --> UI
  UI -- opt-in, counts only --> API[FastAPI]
  API <--> PG[(PostgreSQL)]
  API -- aggregates, groups ≥ 5 --> UI
```

1. **The app** is SvelteKit with Svelte 5, prerendered to static files, installable and offline
   (service worker). The log lives in IndexedDB.
2. **The rules** are YAML files with citations, validated at build time (with file and line
   errors) and bundled as plain JSON.
3. **The engine** (plain TypeScript) counts days and business days, checks each legal deadline
   against the timeline, and renders letters with the template engine from
   [Tenantkit](https://github.com/lobojoel2003/Tenantkit). pdf-lib makes the PDFs in the browser.
4. **The stats API** is a small FastAPI and PostgreSQL service, only for opt-in anonymous numbers
   and the public dashboard. The app works fully without it.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

Requirements: [Node.js](https://nodejs.org/) 22 or newer. For the API:
[uv](https://docs.astral.sh/uv/) and PostgreSQL 16, or Docker.

```bash
git clone https://github.com/lobojoel2003/Rollfix.git
```

```bash
cd Rollfix && npm install
```

```bash
npm run dev
```

Open http://localhost:5173 and press **Try it with sample data**.

| Command                  | What it does                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `npm run dev`            | Development server                                                          |
| `npm run build`          | Static build in `build/` (set `BASE_PATH` and `PUBLIC_STATS_API` as needed) |
| `npm run serve`          | Serve `build/` the way GitHub Pages does                                    |
| `npm run verify`         | Lint, types, rules, version check, unit tests and build                     |
| `npm run test:unit`      | Unit tests (Vitest); `test:coverage` for coverage                           |
| `npm run test:e2e`       | End-to-end and accessibility tests (Playwright + axe) on `build/`           |
| `npm run rules:validate` | Check the rules and letters                                                 |
| `npm run rules:schema`   | Regenerate the JSON Schemas in `schema/`                                    |
| `npm run screenshots`    | Regenerate the images in `docs/images/`                                     |

## Anonymous stats API

The API in [`api/`](api/) stores the numbers people choose to share and serves the dashboard.

**Run it with Docker Compose** (PostgreSQL + API on port 8000):

```bash
docker compose up --build
```

```bash
PUBLIC_STATS_API=http://localhost:8000 npm run dev
```

**Or pull the released image:**

```bash
docker run -p 8000:8000 -e ROLLFIX_DATABASE_URL=postgresql://user:pass@host:5432/rollfix -e ROLLFIX_ALLOWED_ORIGINS=https://your-site.example ghcr.io/lobojoel2003/rollfix-api:1
```

| Setting (environment)          | Default                                               | Meaning                                             |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------------------- |
| `ROLLFIX_DATABASE_URL`         | `postgresql://rollfix:rollfix@localhost:5432/rollfix` | PostgreSQL connection                               |
| `ROLLFIX_ALLOWED_ORIGINS`      | `http://localhost:4173,http://localhost:5173`         | Comma-separated web origins allowed to call it      |
| `ROLLFIX_MIN_GROUP_SIZE`       | `5`                                                   | Smallest group ever published                       |
| `ROLLFIX_WRITE_LIMIT_PER_HOUR` | `30`                                                  | Shares, updates and removals per client per hour    |
| `ROLLFIX_TRUST_PROXY`          | `false`                                               | Rate-limit by `X-Forwarded-For` (behind your proxy) |
| `ROLLFIX_STATS_CACHE_SECONDS`  | `60`                                                  | How long aggregates are cached                      |

Migrations run on start-up. Endpoints: `POST /v1/reports`, `PUT` and `DELETE /v1/reports/{id}`
(with the token returned at creation), `GET /v1/stats` (JSON), `GET /v1/stats.csv`,
`GET /healthz`, `GET /readyz`, `GET /v1/version`, and OpenAPI docs at `/docs`.

**Connect the app to it** by building with `PUBLIC_STATS_API=https://your-api.example`. For the
GitHub Pages deployment, set the repository variable `PUBLIC_STATS_API` (Settings → Secrets and
variables → Actions → Variables). The site's Content Security Policy then allows that origin and
nothing else.

## Project layout

```
src/lib/engine/     day count, deadlines, letters, timeline (pure TypeScript, unit-tested)
src/lib/content/    build-time loader and Vite plugin for rules/ and letters/
src/lib/pdf/        letter and timeline PDFs (pdf-lib)
src/lib/store/      IndexedDB storage, app state, backups, sample data
src/lib/stats/      the anonymous payload and API client
src/lib/components/ Svelte components
src/routes/         pages (prerendered), one per state under /rules/
src/service-worker/ offline support
rules/              state and federal rules, holidays (YAML, CC BY 4.0)
letters/            letter templates (YAML, CC BY 4.0)
schema/             JSON Schemas for editors, generated
api/                FastAPI + PostgreSQL stats API, Dockerfile, tests
tests/unit/         Vitest
tests/e2e/          Playwright + axe
scripts/            validation, schema, release and screenshot scripts
```

## Versions, builds and releases

- **Semantic versioning**, tags `vX.Y.Z`. The app and the API always share one version, checked
  in CI (`npm run version:check`).
- **Build numbers** are the commit count, so a commit always gets the same number. They appear in
  the footer, `/build-info.json`, the API's `/v1/version`, the release title and an image tag.
- **Releases** are built by CI from a tag and include the web app, the rules bundle, the API
  wheel and source, SBOMs for both, checksums, signed build provenance, and the API image on
  GHCR (`X.Y.Z`, `X.Y`, `X`, `latest`, `build-N`).

See [docs/RELEASING.md](docs/RELEASING.md) and the [changelog](CHANGELOG.md).

## CI/CD

| Workflow                                 | When                        | What                                                                                                                                                                                   |
| ---------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CI](.github/workflows/ci.yml)           | Every push and pull request | Lint, types, rules, versions, unit tests; build; API lint, mypy, pytest on PostgreSQL; container build and smoke test; end-to-end and axe tests against the real API; dependency audit |
| [Deploy](.github/workflows/deploy.yml)   | Push to `main`              | Builds and publishes the app to GitHub Pages                                                                                                                                           |
| [Release](.github/workflows/release.yml) | Tag `v*` (or manual)        | Full CI, then packages, attests and publishes the release and the API image                                                                                                            |
| [CodeQL](.github/workflows/codeql.yml)   | Push, pull request, weekly  | Security analysis of TypeScript, Python and workflows                                                                                                                                  |
| [Dependabot](.github/dependabot.yml)     | Weekly                      | npm, uv, Docker and Actions updates                                                                                                                                                    |

GitHub Pages needs to be turned on once: **Settings → Pages → Source: GitHub Actions**.

## Contributing

Adding or correcting a state's rules is the most valuable help, and needs no code: see the
[rules guide](rules/README.md). For everything else, read [CONTRIBUTING.md](CONTRIBUTING.md).
Please follow the [Code of Conduct](CODE_OF_CONDUCT.md), and report security issues privately
as described in [SECURITY.md](SECURITY.md).

## License and credits

- Code: [GNU AGPL-3.0-only](LICENSE).
- Rules, letters and schemas: [CC BY 4.0](rules/LICENSE.md).
- The letter template engine, date math, holiday calendars and PDF layout come from
  [Tenantkit](https://github.com/lobojoel2003/Tenantkit).
- Evidence: [CT Mirror](https://ctmirror.org/2024/03/12/ct-wheelchair-repair-delays-bill/),
  [Harvard Health Publishing](https://www.health.harvard.edu/blog/millions-rely-on-wheelchairs-for-mobility-but-repair-delays-are-hurting-users-202207212785),
  [U.S. PIRG](https://pirg.org/iowa/resources/stranded/).
