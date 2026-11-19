/**
 * Print the CHANGELOG.md section for a version (used as GitHub release notes).
 *   npm run --silent release:notes -- 1.0.0 [build number]
 */
import { readFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
const build = process.argv[3];
if (!version) {
	console.error('usage: release-notes <version> [build]');
	process.exit(2);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = changelog.split('\n');
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) {
	console.error(`CHANGELOG.md has no "## [${version}]" section`);
	process.exit(1);
}
const end = lines.findIndex((line, index) => index > start && /^## \[/.test(line));
const body = lines
	.slice(start + 1, end === -1 ? undefined : end)
	.filter((line) => !/^\[[^\]]+\]: /.test(line))
	.join('\n')
	.trim();

const repo = 'https://github.com/lobojoel2003/Rollfix';
console.log(`${body}

---

**Install**

- **Use it:** open the web app and choose *Install* (or *Add to Home Screen*) in your browser. It works offline.
- **Host it yourself:** unzip \`rollfix-web-v${version}.zip\` onto any static web server.
- **Run the stats API:** \`docker pull ghcr.io/lobojoel2003/rollfix-api:${version}\` (see the README).

**Downloads**

- \`rollfix-web-v${version}.zip\`: the installable web app.
- \`rollfix-rules-v${version}.zip\`: state rules, letter templates and JSON Schemas (CC BY 4.0).
- \`rollfix_api-${version}-py3-none-any.whl\` and \`.tar.gz\`: the stats API as a Python package.
- \`rollfix-web-sbom-v${version}.cdx.json\`, \`rollfix-api-sbom-v${version}.cdx.json\`: software bills of materials (CycloneDX).
- \`SHA256SUMS.txt\`: checksums. Every file and the container image have signed build provenance (\`gh attestation verify <file> --repo lobojoel2003/Rollfix\`).

${build ? `Build ${build}. ` : ''}Code: AGPL-3.0-only. Rules and letters: CC BY 4.0. Full changelog: ${repo}/blob/v${version}/CHANGELOG.md`);
