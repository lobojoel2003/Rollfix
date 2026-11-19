/**
 * The web app (package.json), the stats API (api/pyproject.toml and its __init__.py) and
 * CHANGELOG.md must agree on the version. Run with:  npm run version:check [-- vX.Y.Z]
 * With a tag argument, also checks that the tag matches.
 */
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const versions: Record<string, string | undefined> = {
	'package.json': (JSON.parse(read('package.json')) as { version: string }).version,
	'package-lock.json': (JSON.parse(read('package-lock.json')) as { version: string }).version,
	'api/pyproject.toml': /^version\s*=\s*"([^"]+)"/m.exec(read('api/pyproject.toml'))?.[1],
	'api/rollfix_api/__init__.py': /__version__\s*=\s*"([^"]+)"/.exec(
		read('api/rollfix_api/__init__.py')
	)?.[1]
};

const expected = versions['package.json'];
let ok = true;
for (const [file, version] of Object.entries(versions)) {
	if (version !== expected) {
		console.error(`${file} has version ${version ?? '(none)'}, expected ${expected}`);
		ok = false;
	}
}

const changelog = read('CHANGELOG.md');
if (!changelog.includes(`## [${expected}]`)) {
	console.error(`CHANGELOG.md has no "## [${expected}]" section`);
	ok = false;
}

const tag = process.argv[2];
if (tag && tag !== `v${expected}`) {
	console.error(`Tag ${tag} does not match version ${expected}`);
	ok = false;
}

if (!ok) process.exit(1);
console.log(`Version ${expected} is consistent${tag ? ` with tag ${tag}` : ''}.`);
