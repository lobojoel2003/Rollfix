/**
 * Check every rules and letter file. Run with:  npm run rules:validate
 * Problems are printed with file and line; in GitHub Actions they also show up on the PR.
 */
import { fileURLToPath } from 'node:url';
import { readContentFiles } from '../src/lib/content/files.ts';
import { formatIssue, loadContent } from '../src/lib/content/loader.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = readContentFiles(root);
const { content, issues } = loadContent(files);

const inActions = process.env.GITHUB_ACTIONS === 'true';
for (const issue of issues) {
	console.log(formatIssue(issue));
	if (inActions) {
		const line = issue.line !== undefined ? `,line=${issue.line}` : '';
		const message = `${issue.path ? `${issue.path}: ` : ''}${issue.message}`.replace(/\r?\n/g, ' ');
		console.log(`::${issue.level} file=${issue.file}${line},title=Rules check::${message}`);
	}
}

const errors = issues.filter((issue) => issue.level === 'error').length;
console.log('');
for (const state of [...Object.values(content.states), content.federal]) {
	console.log(
		`  ${state.id.padEnd(3)} ${state.name.padEnd(22)} ${String(state.laws.length).padStart(2)} laws  ${String(state.deadlines.length).padStart(2)} deadlines  ${String(state.agencies.length).padStart(2)} offices  checked ${state.last_checked}`
	);
}
console.log(
	`\n${Object.keys(files).length} files checked: ${errors} error(s), ${issues.length - errors} warning(s)`
);
if (errors > 0) process.exit(1);
