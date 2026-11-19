# Contributing to Rollfix

Thank you for helping. Rollfix is for people whose power wheelchair has broken and who are
waiting, sometimes for weeks, for it to be fixed. Every change should make that wait a little
more bearable or a little shorter.

## Ways to help

- **Add or fix a state's rules.** This is the most valuable contribution and needs no code. See
  the [rules guide](rules/README.md), or open a **Rules correction or new law** issue with a
  link to the law.
- **Report an accessibility barrier.** If something is hard with a keyboard, switch, screen
  reader, magnifier or voice control, it's a bug. Use the **Accessibility barrier** form.
- **Improve the letters.** Plain, polite, firm wording that gets answers. Advocates who send these
  letters for a living are especially welcome.
- **Code**, for the app (SvelteKit) or the stats API (FastAPI).

## Getting set up

Requirements: [Node.js](https://nodejs.org/) 22+, and for the API [uv](https://docs.astral.sh/uv/)
and PostgreSQL 16 (or Docker).

```bash
npm install
```

```bash
npm run dev
```

The stats API is optional. To work on it:

```bash
docker compose up --build
```

```bash
PUBLIC_STATS_API=http://localhost:8000 npm run dev
```

## Before you open a pull request

```bash
npm run verify
```

This runs formatting and lint, type checks, the rules validator, the version check, unit tests
and a production build. For end-to-end and accessibility tests (Playwright and axe):

```bash
npm run build && npm run test:e2e
```

For the API:

```bash
cd api && uv run ruff check . && uv run mypy rollfix_api tests && uv run pytest
```

API tests need PostgreSQL; set `ROLLFIX_TEST_DATABASE_URL` if yours isn't on
`localhost:5433` (e.g. `postgresql://rollfix:rollfix@localhost:5432/rollfix_test`).

## Accessibility is not optional

Changes to the interface must:

- work with the keyboard alone, in a sensible order, with a visible focus ring;
- use real buttons, links and form controls with visible labels (no icon-only controls);
- keep targets at least 48 pixels tall;
- announce results (saved, downloaded, errors) to screen readers;
- reflow at 320 pixels wide and 400% zoom;
- pass the axe checks in `tests/e2e/accessibility.spec.ts`.

## Privacy is not optional either

The log never leaves the device unless the person shares numbers, and then only the fields in
`src/lib/stats/payload.ts`. Don't add analytics, third-party scripts, fonts or requests. Adding a
field to the shared numbers needs a change to the API schema, a migration, and a note in the
changelog explaining why.

## Commit messages and changelog

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `rules:`,
`docs:`, `ci:`…). Add user-facing changes to `CHANGELOG.md` under `Unreleased`. Releases are
described in [docs/RELEASING.md](docs/RELEASING.md).

By contributing you agree that code is licensed AGPL-3.0-only and rules and letters CC BY 4.0,
and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
