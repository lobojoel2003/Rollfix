import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { renderLetter } from '../../src/lib/engine/letters.ts';
import { rulesFor } from '../../src/lib/engine/rules.ts';
import {
	createLetterPdf,
	createTimelinePdf,
	letterBlocks,
	toPdfSafe,
	wrapText
} from '../../src/lib/pdf/letter-pdf.ts';
import { entry, jurisdiction, repair } from './fixtures.ts';

const date = new Date('2026-11-19T12:00:00Z');

function sampleLetter(entries = 3) {
	const r = repair({
		entries: Array.from({ length: entries }, (_, index) =>
			entry('2026-11-03', 'call', { note: `Call number ${index + 1}. `.repeat(8) })
		)
	});
	return renderLetter({
		letter: {
			schema_version: 1,
			id: 'supplier',
			recipient: 'supplier',
			title: 'Letter',
			description: 'x',
			subject: 'Repair of my chair',
			body: 'Dear {{supplier_name}},\n\nIt broke on {{broke_date}}. “Quotes” — and dashes…\n\n{{state_rules}}',
			closing: 'Sincerely,',
			response_days: 7,
			options: []
		},
		repair: r,
		profile: { name: 'Alex Rivera', address: '12 Elm St', phone: '', email: '', state: 'ZZ' },
		rules: rulesFor(r, jurisdiction(), undefined, '2026-11-19'),
		stateName: 'Testland',
		today: '2026-11-19'
	});
}

describe('PDF letters', () => {
	it('makes a letter with the timeline on its own page', async () => {
		const bytes = await createLetterPdf(sampleLetter(), {
			title: 'Letter to Acme',
			author: 'Alex Rivera',
			date,
			enclosureSubtitle: 'Kept with Rollfix.'
		});
		const pdf = await PDFDocument.load(bytes);
		expect(pdf.getPageCount()).toBe(2);
		expect(pdf.getTitle()).toBe('Letter to Acme');
		expect(pdf.getAuthor()).toBe('Alex Rivera');
		expect(pdf.getCreator()).toBe('Rollfix');
		expect(pdf.getCreationDate()?.toISOString()).toBe(date.toISOString());
		expect(pdf.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
	});

	it('flows a long timeline across pages', async () => {
		const bytes = await createLetterPdf(sampleLetter(60), {
			title: 'Long',
			date,
			enclosureSubtitle: 'x',
			pageLabel: (page, pages) => `${page}/${pages}`
		});
		expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(4);
	});

	it('makes a timeline-only PDF', async () => {
		const letter = sampleLetter(2);
		const bytes = await createTimelinePdf('Repair timeline', 'Day 18', letter.enclosure, {
			title: 'Timeline',
			date
		});
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
	});

	it('lays the letter out as blocks', () => {
		const blocks = letterBlocks(sampleLetter(1), 'sub');
		expect(blocks[0]?.text).toBe('Alex Rivera\n12 Elm St');
		expect(
			blocks.some((block) => block.text.startsWith('Re: Repair of my chair\nAccount number: A-1'))
		).toBe(true);
		expect(blocks.find((block) => block.pageBreak)?.text).toBe('Repair timeline (2 entries)');
	});

	it('replaces characters the built-in fonts cannot draw', async () => {
		const pdf = await PDFDocument.create();
		const font = await pdf.embedFont(StandardFonts.Helvetica);
		expect(toPdfSafe('“Hi” — it’s… ok\nnext', font)).toBe('"Hi" - it\'s... ok\nnext');
		expect(toPdfSafe('数', font)).toBe('?');
	});

	it('wraps text and hard-breaks very long words', async () => {
		const pdf = await PDFDocument.create();
		const font = await pdf.embedFont(StandardFonts.Helvetica);
		const lines = wrapText('a '.repeat(80) + '\n\n' + 'x'.repeat(200), font, 11, 200);
		expect(lines.length).toBeGreaterThan(4);
		expect(lines).toContain('');
		for (const line of lines) expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(200);
	});
});
