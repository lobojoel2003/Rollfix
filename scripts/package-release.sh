#!/usr/bin/env bash
# Package a release into dist/:
#   rollfix-web-v<version>.zip            the installable web app (static files), ready to host anywhere
#   rollfix-rules-v<version>.zip          state rules, letters and JSON Schemas (CC BY 4.0) for reuse
#   rollfix_api-<version>-py3-none-any.whl / .tar.gz   the stats API as a Python package
#   rollfix-web-sbom-v<version>.cdx.json  software bill of materials for the web app (CycloneDX)
#   rollfix-api-sbom-v<version>.cdx.json  software bill of materials for the API (CycloneDX)
#   SHA256SUMS.txt                        checksums for all of the above
set -euo pipefail

VERSION="${1:?usage: package-release.sh <version>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"

test -f "$ROOT/build/index.html" || { echo "Run npm run build first" >&2; exit 1; }
rm -rf "$DIST"
mkdir -p "$DIST"

# Web app
(cd "$ROOT/build" && zip -qr -X "$DIST/rollfix-web-v$VERSION.zip" .)

# Rules and letters for advocates and other tools
STAGE="$(mktemp -d)"
NAME="rollfix-rules-v$VERSION"
mkdir -p "$STAGE/$NAME"
cp -R "$ROOT/rules" "$ROOT/letters" "$ROOT/schema" "$STAGE/$NAME/"
cp "$ROOT/rules/LICENSE.md" "$STAGE/$NAME/LICENSE.md"
(cd "$STAGE" && zip -qr -X "$DIST/$NAME.zip" "$NAME")
rm -rf "$STAGE"

# Stats API package
(cd "$ROOT/api" && uv build --quiet --out-dir "$DIST")

# Software bills of materials
(cd "$ROOT" && npm sbom --package-lock-only --sbom-format cyclonedx --omit dev > "$DIST/rollfix-web-sbom-v$VERSION.cdx.json")
REQS="$(mktemp)"
(cd "$ROOT/api" && uv export --locked --no-dev --no-hashes --no-emit-project --format requirements-txt > "$REQS")
uvx --quiet --from cyclonedx-bom cyclonedx-py requirements "$REQS" --of JSON -o "$DIST/rollfix-api-sbom-v$VERSION.cdx.json"
rm -f "$REQS"

(cd "$DIST" && sha256sum ./*.zip ./*.whl ./*.tar.gz ./*.cdx.json | sed 's# \./# #' > SHA256SUMS.txt)
ls -l "$DIST"
cat "$DIST/SHA256SUMS.txt"
