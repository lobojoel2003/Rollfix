import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readContentFiles } from '../../src/lib/content/files.ts';
import { formatIssue, loadContent, type ContentFiles } from '../../src/lib/content/loader.ts';
import { RECIPIENTS } from '../../src/lib/engine/schema.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const real = readContentFiles(root);

const federal = `schema_version: 1
id: US
name: Medicare
last_checked: 2026-11-19
summary: Federal rules.
`;

const letter = (id: string, recipient: string, body = 'Hello {{my_name}}.') => `schema_version: 1
id: ${id}
recipient: ${recipient}
title: T
description: D
subject: S
body: "${body}"
`;

function files(extra: ContentFiles = {}): ContentFiles {
	return {
		'rules/federal.yaml': federal,
		'rules/holidays/us-federal.yaml': real['rules/holidays/us-federal.yaml']!,
		'letters/supplier.yaml': letter('supplier', 'supplier'),
		'letters/insurer.yaml': letter('insurer', 'insurer'),
		'letters/agency.yaml': letter('agency', 'agency'),
		...extra
	};
}

const state = (body: string) => `schema_version: 1
id: CT
name: Connecticut
last_checked: 2026-11-19
summary: S.
agencies:
  - id: ag
    name: AG
    handles: Complaints.
    url: https://example.org
${body}`;

describe('the real rules and letters', () => {
	it('load without errors or warnings', () => {
		const { content, issues } = loadContent(real);
		expect(issues.map(formatIssue)).toEqual([]);
		expect(content.federal.id).toBe('US');
		for (const recipient of RECIPIENTS)
			expect(content.letters[recipient]?.recipient).toBe(recipient);
		for (const profile of Object.values(content.states)) {
			expect(profile.holidayRules.length).toBeGreaterThan(5);
			expect(profile.agencies.length).toBeGreaterThan(0);
			for (const law of profile.laws) expect(law.url).toMatch(/^https:\/\//);
		}
	});
});

describe('content checks', () => {
	it('accepts a minimal valid set', () => {
		expect(loadContent(files()).issues).toEqual([]);
	});

	it('reports YAML and schema errors with line numbers', () => {
		const { issues } = loadContent(
			files({
				'rules/states/ct.yaml': state('laws:\n  - id: x\n    title: 5\n'),
				'rules/states/zz.yaml': 'schema_version: 1\nid: [unclosed\n'
			})
		);
		const messages = issues.map(formatIssue);
		expect(
			messages.some((m) => m.startsWith('error  rules/states/ct.yaml:13 (laws[0].title)'))
		).toBe(true);
		expect(messages.some((m) => m.startsWith('error  rules/states/zz.yaml:'))).toBe(true);
	});

	it('checks references between files', () => {
		const { issues } = loadContent(
			files({
				'rules/states/ct.yaml': state(`laws:
  - id: act
    title: Act
    bill: HB 1
    citation: C.G.S. § 1
    status: enacted
    url: https://example.org/act
    summary: S.
    applies_to: [supplier]
deadlines:
  - id: d
    law: missing
    title: T
    who: supplier
    description: D.
    starts: { events: [reported], label: you reported it }
    period: { days: 5, count: business }
    met_by: [visit]
    met_label: a visit
    letter: "Due {{due_date}} under {{nonsense}}."
protections:
  - id: d
    law: act
    title: P
    description: D.
    letter: "{{#if x}}"
holidays:
  extends: [nope]
`)
			})
		);
		const messages = issues.map((issue) => issue.message);
		expect(messages).toEqual(
			expect.arrayContaining([
				'An enacted law needs its effective date',
				'Unknown law "missing"',
				expect.stringMatching(/^Unknown name "\{\{nonsense\}\}"/),
				'Duplicate protection id "d"',
				'{{#if}} is never closed',
				'Unknown holiday calendar "nope"',
				'Add the sources you checked the rules against'
			])
		);
	});

	it('checks ids, names and letters', () => {
		const { issues } = loadContent({
			...files({
				'rules/states/co.yaml': state(''),
				'rules/states/xx.yaml': state('').replace('id: CT', 'id: XX'),
				'letters/extra.yaml': letter('other', 'supplier', 'Hi {{unknown_name}}'),
				'letters/agency.yaml': letter('agency', 'agency').replace(
					'title: T',
					'title: T\noptions:\n  - id: my_name\n    label: L'
				)
			}),
			'rules/federal.yaml': federal.replace('id: US', 'id: CT'),
			'letters/insurer.yaml': 'schema_version: 1\n'
		});
		const messages = issues.map((issue) => `${issue.file}: ${issue.message}`);
		expect(messages).toEqual(
			expect.arrayContaining([
				'rules/states/co.yaml: id "CT" must match the file name',
				'rules/states/xx.yaml: "XX" is not a U.S. state or D.C.',
				'rules/federal.yaml: The federal file must have id "US"',
				'letters/extra.yaml: id "other" must match the file name',
				'letters/supplier.yaml: There is already a letter for "supplier"',
				expect.stringMatching(/^letters\/extra.yaml: Unknown name "\{\{unknown_name\}\}"/),
				'letters/agency.yaml: Option id "my_name" is a reserved name',
				'letters/: No letter for "insurer"'
			])
		);
	});

	it('requires the federal file and a complaint office per state', () => {
		const withoutFederal = files({
			'rules/states/ct.yaml': state('').replace(/agencies:[\s\S]*$/, '')
		});
		delete withoutFederal['rules/federal.yaml'];
		const messages = loadContent(withoutFederal).issues.map((issue) => issue.message);
		expect(messages).toContain('The federal rules file is missing');
		expect(messages).toContain('List at least one office people can complain to');
	});
});
