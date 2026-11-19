# Releasing

Rollfix uses [Semantic Versioning](https://semver.org/) and tags releases `vMAJOR.MINOR.PATCH`.
The web app (`package.json`) and the stats API (`api/pyproject.toml`,
`api/rollfix_api/__init__.py`) always share one version; `npm run version:check` enforces it.

| Change                                                          | Version bump |
| --------------------------------------------------------------- | ------------ |
| Breaking change to the rules format, backup format or stats API | Major        |
| New state, letter, feature or API endpoint                      | Minor        |
| Fixes, corrected rules, wording, dependency updates             | Patch        |

## Build numbers

Every build is stamped with a **build number**: the number of commits on the released branch
(`git rev-list --count HEAD`), so the same commit always gets the same number. It appears in:

- the footer of every page and `/build-info.json` (`version`, `buildNumber`, `commit`, `date`);
- the stats API's `/v1/version` and the image label `org.opencontainers.image.revision`;
- the GitHub release title, e.g. **Rollfix v1.0.0 (build 12)**, and an image tag `build-12`.

## Steps

1. Make sure `main` is green in CI.
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty
   `## [Unreleased]` above it, and update the links at the bottom.
3. Bump the versions:

   ```bash
   npm version X.Y.Z --no-git-tag-version
   ```

   ```bash
   sed -i 's/^version = ".*"/version = "X.Y.Z"/' api/pyproject.toml && sed -i 's/__version__ = ".*"/__version__ = "X.Y.Z"/' api/rollfix_api/__init__.py && (cd api && uv lock)
   ```

   ```bash
   npm run version:check
   ```

4. Commit and push:

   ```bash
   git commit -am "chore(release): vX.Y.Z" && git push origin main
   ```

5. Tag and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "Rollfix vX.Y.Z" && git push origin vX.Y.Z
   ```

The [Release workflow](../.github/workflows/release.yml) then:

1. runs the full CI suite on the tagged commit (web, API, container, end-to-end, audit),
2. checks that the tag matches every version number,
3. builds the web app with the build number,
4. packages `rollfix-web-vX.Y.Z.zip`, `rollfix-rules-vX.Y.Z.zip`, the API wheel and source
   archive, CycloneDX SBOMs for both, and `SHA256SUMS.txt`,
5. builds and pushes the API image to `ghcr.io/lobojoel2003/rollfix-api` tagged `X.Y.Z`, `X.Y`,
   `X`, `latest` and `build-N`,
6. creates signed build provenance attestations for every file and the image, and
7. publishes the GitHub release with the changelog section as notes.

Tags with a suffix, such as `v1.1.0-rc.1`, are published as pre-releases (and don't move
`latest`).

You can also release without pushing a tag: run the **Release** workflow from the Actions tab on
`main` and enter the tag. If it doesn't exist yet, the workflow creates it on the latest commit
when it publishes the release. Running it again for an existing tag re-publishes that release.

## Verifying a download

```bash
sha256sum -c SHA256SUMS.txt
```

```bash
gh attestation verify rollfix-web-vX.Y.Z.zip --repo lobojoel2003/Rollfix
```

```bash
gh attestation verify oci://ghcr.io/lobojoel2003/rollfix-api:X.Y.Z --repo lobojoel2003/Rollfix
```
