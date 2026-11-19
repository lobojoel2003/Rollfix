/**
 * Vite plugin: validates rules/ and letters/ at build time and exposes them to the app as
 * the virtual module "virtual:rollfix/content". A broken file fails the build with its file
 * name and line number; in dev, editing a file reloads the page.
 */
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { readContentFiles, CONTENT_DIRS } from './files.ts';
import { formatIssue, loadContent } from './loader.ts';

const ID = 'virtual:rollfix/content';
const RESOLVED = `\0${ID}`;

export function rollfixContent(root: string): Plugin {
	return {
		name: 'rollfix-content',
		resolveId(id) {
			return id === ID ? RESOLVED : undefined;
		},
		load(id) {
			if (id !== RESOLVED) return undefined;
			const files = readContentFiles(root);
			for (const file of Object.keys(files)) this.addWatchFile(join(root, file));
			const { content, issues } = loadContent(files);
			const errors = issues.filter((issue) => issue.level === 'error');
			for (const issue of issues.filter((item) => item.level === 'warning')) {
				this.warn(formatIssue(issue));
			}
			if (errors.length > 0) {
				this.error(`Rules or letters have problems:\n${errors.map(formatIssue).join('\n')}`);
			}
			return `export const content = ${JSON.stringify(content)};\nexport default content;\n`;
		},
		configureServer(server) {
			for (const dir of CONTENT_DIRS) server.watcher.add(join(root, dir));
			server.watcher.on('change', (file) => {
				if (!CONTENT_DIRS.some((dir) => file.startsWith(join(root, dir)))) return;
				const module = server.moduleGraph.getModuleById(RESOLVED);
				if (module) server.moduleGraph.invalidateModule(module);
				server.ws.send({ type: 'full-reload' });
			});
		}
	};
}
