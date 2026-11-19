/** Read rules/ and letters/ from disk into a { "rules/states/ct.yaml": "text" } map. Node only. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ContentFiles } from './loader.ts';

export const CONTENT_DIRS = ['rules', 'letters'] as const;

export function readContentFiles(root: string): ContentFiles {
	const files: ContentFiles = {};
	const walk = (current: string) => {
		for (const name of readdirSync(current).sort()) {
			const path = join(current, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (/\.ya?ml$/.test(name))
				files[relative(root, path).split(sep).join('/')] = readFileSync(path, 'utf8');
		}
	};
	for (const dir of CONTENT_DIRS) {
		const path = join(root, dir);
		if (existsSync(path)) walk(path);
	}
	return files;
}
