/**
 * Write JSON Schemas for the rules and letter files to schema/. Editors such as VS Code (with
 * the YAML extension) use them for autocompletion and inline errors.
 *
 *   npm run rules:schema            write the files
 *   npm run rules:schema -- --check fail if they are out of date (used in CI)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { HolidayCalendarFile, JurisdictionFile, LetterFile } from '../src/lib/engine/schema.ts';

const outDir = fileURLToPath(new URL('../schema/', import.meta.url));
const schemas = {
	'jurisdiction.schema.json': [
		JurisdictionFile,
		'Rollfix state or federal rules',
		'rules/states/*.yaml and rules/federal.yaml'
	],
	'letter.schema.json': [LetterFile, 'Rollfix letter', 'letters/*.yaml'],
	'holidays.schema.json': [HolidayCalendarFile, 'Rollfix holiday calendar', 'rules/holidays/*.yaml']
} as const;

const check = process.argv.includes('--check');
let stale = 0;
mkdirSync(outDir, { recursive: true });
for (const [file, [schema, title, applies]] of Object.entries(schemas)) {
	const json = {
		$id: `https://lobojoel2003.github.io/Rollfix/schema/${file}`,
		title,
		description: `Schema for ${applies}. Generated from src/lib/engine/schema.ts; do not edit by hand.`,
		...z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' })
	};
	const text = JSON.stringify(json, null, '\t') + '\n';
	const path = outDir + file;
	if (check) {
		let current = '';
		try {
			current = readFileSync(path, 'utf8');
		} catch {
			// a missing file counts as stale
		}
		if (current !== text) {
			console.error(`schema/${file} is out of date. Run: npm run rules:schema`);
			stale++;
		}
	} else {
		writeFileSync(path, text);
		console.log(`wrote schema/${file}`);
	}
}
if (stale > 0) process.exit(1);
