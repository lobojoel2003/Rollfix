# Security policy

## Supported versions

Security fixes are released for the latest minor version. The live app always runs the latest
`main`; the stats API image is published for every release.

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## How Rollfix protects people

**The app**

- The repair log lives only in the browser (IndexedDB). There is no account system and no
  server copy. Letters, PDFs and backups are made on the device.
- Every page sets a strict Content Security Policy that blocks scripts, styles, fonts, images and
  connections from any other origin. The only exception is the stats API, and only when a site
  owner configures one.
- Letter templates can only produce text; they can't run code. Backups are validated field by
  field on import and anything unknown is dropped.

**The optional stats API**

- It accepts only counts of days and a few fixed categories, validated strictly (unknown fields
  are rejected). No names, notes, contact details or exact dates.
- It stores no IP addresses and writes no access logs. Rate limiting keeps hashed client
  addresses in memory for at most an hour.
- Each shared report has a random token that only the person's device holds. The server stores
  only its SHA-256 hash and compares in constant time.
- Aggregates are never published for groups smaller than 5 reports.
- The container runs as an unprivileged user.

**The project**

- Dependencies are audited in CI (`npm audit`, `pip-audit`), updated weekly by Dependabot, and
  the code is scanned by CodeQL (TypeScript, Python and workflows).
- Releases include checksums, SBOMs and signed build provenance attestations for every file and
  the container image.

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it and the impact you expect. We aim to acknowledge
reports within 5 days and to fix confirmed issues as quickly as we can, and we'll credit you in
the release notes unless you'd rather stay anonymous.

Mistakes in the rules (a wrong deadline or citation) aren't security issues, but they matter just
as much: please report them with the **Rules correction** issue form.
