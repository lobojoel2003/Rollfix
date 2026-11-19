/**
 * Printable US-Letter PDFs made in the browser with pdf-lib: the letter itself, followed by
 * the repair timeline as an enclosure. Nothing leaves the device.
 *
 * Adapted from Tenantkit (https://github.com/lobojoel2003/Tenantkit, AGPL-3.0-only).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { EnclosureLine, RenderedLetter } from '../engine/letters.ts';
import { segmentsToText, type Segment } from '../engine/template.ts';

export interface PdfOptions {
	title: string;
	author?: string;
	/** Language tag stored in the PDF, e.g. "en-US". */
	language?: string;
	/** Fixed creation date (used by tests for reproducible output). */
	date?: Date;
	/** Footer text such as "Page 1 of 3". */
	pageLabel?: (page: number, pages: number) => string;
}

const PAGE = { width: 612, height: 792 };
const MARGIN = { top: 72, bottom: 72, left: 72, right: 72 };
const SIZE = 11;
const LEADING = 15.5;
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.35, 0.35, 0.35);

/** Typographic characters mapped to ones the built-in PDF fonts can draw (WinAnsi). */
const REPLACEMENTS: Record<string, string> = {
	'‘': "'",
	'’': "'",
	'‚': "'",
	'“': '"',
	'”': '"',
	'„': '"',
	'–': '-',
	'—': '-',
	'…': '...',
	' ': ' ',
	' ': ' ',
	' ': ' ',
	'•': '-',
	'‑': '-'
};

export function toPdfSafe(text: string, font: PDFFont): string {
	let out = '';
	for (const char of text.normalize('NFC')) {
		const replaced = REPLACEMENTS[char] ?? char;
		for (const piece of replaced) {
			if (piece === '\n') {
				out += piece;
				continue;
			}
			try {
				font.encodeText(piece);
				out += piece;
			} catch {
				out += '?';
			}
		}
	}
	return out;
}

/** Break text into lines that fit `width`, keeping existing line breaks. */
export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
	const out: string[] = [];
	for (const paragraph of text.split('\n')) {
		if (paragraph.trim() === '') {
			out.push('');
			continue;
		}
		let current = '';
		for (const word of paragraph.split(/(\s+)/)) {
			if (word === '') continue;
			const candidate = current + word;
			if (font.widthOfTextAtSize(candidate.trimEnd(), size) <= width) {
				current = candidate;
				continue;
			}
			if (current.trim() !== '') {
				out.push(current.trimEnd());
				current = word.trimStart();
			} else {
				current = candidate.trimStart();
			}
			// A single word wider than the line: hard-break it.
			while (current.length > 1 && font.widthOfTextAtSize(current, size) > width) {
				let cut = current.length - 1;
				while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > width) cut--;
				out.push(current.slice(0, cut));
				current = current.slice(cut);
			}
		}
		out.push(current.trimEnd());
	}
	return out;
}

export interface Block {
	text: string;
	bold?: boolean;
	size?: number;
	/** Left indent in points. */
	indent?: number;
	muted?: boolean;
	/** Blank space after the block, in lines. */
	after: number;
	/** Keep together on one page when possible. */
	keep?: boolean;
	/** Start a new page before this block. */
	pageBreak?: boolean;
	/** Keep this block on the same page as the next one (for headings). */
	keepWithNext?: boolean;
}

const text = (segments: readonly Segment[]) => segmentsToText(segments);
const joinLines = (block: readonly Segment[][]) => block.map((line) => text(line)).join('\n');

export function enclosureBlocks(title: string, subtitle: string, lines: EnclosureLine[]): Block[] {
	const blocks: Block[] = [
		{ text: title, bold: true, size: 14, after: 0.3, pageBreak: true },
		{ text: subtitle, muted: true, after: 1 }
	];
	for (const line of lines) {
		blocks.push({ text: line.heading, bold: true, after: 0, keepWithNext: true });
		blocks.push({ text: line.text, indent: 14, after: 0.7 });
	}
	return blocks;
}

export function letterBlocks(letter: RenderedLetter, enclosureSubtitle: string): Block[] {
	const blocks: Block[] = [
		{ text: joinLines(letter.sender), after: 1, keep: true },
		{ text: letter.date, after: 1 },
		{ text: joinLines(letter.recipient), after: 1, keep: true },
		{
			text: [`Re: ${text(letter.subject)}`, ...letter.references].join('\n'),
			bold: true,
			after: 1,
			keep: true
		}
	];
	for (const paragraph of text(letter.body).split(/\n{2,}/)) {
		blocks.push({ text: paragraph, after: 1 });
	}
	blocks.push({ text: `${letter.closing}\n\n\n${text(letter.signature)}`, after: 1, keep: true });
	blocks.push({ text: `Enclosure: ${letter.enclosureLabel}`, after: 0 });
	blocks.push(...enclosureBlocks(letter.enclosureLabel, enclosureSubtitle, letter.enclosure));
	return blocks;
}

export async function renderBlocksToPdf(blocks: Block[], options: PdfOptions): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const regular = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const date = options.date ?? new Date();

	pdf.setTitle(toPdfSafe(options.title, regular), { showInWindowTitleBar: true });
	if (options.author) pdf.setAuthor(toPdfSafe(options.author, regular));
	pdf.setCreator('Rollfix');
	pdf.setProducer('Rollfix (pdf-lib)');
	pdf.setLanguage(options.language ?? 'en-US');
	pdf.setCreationDate(date);
	pdf.setModificationDate(date);

	const fullWidth = PAGE.width - MARGIN.left - MARGIN.right;
	const usable = PAGE.height - MARGIN.top - MARGIN.bottom;
	let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
	let y = PAGE.height - MARGIN.top;
	let fresh = true;
	const newPage = () => {
		page = pdf.addPage([PAGE.width, PAGE.height]);
		y = PAGE.height - MARGIN.top;
		fresh = true;
	};

	const layout = (block: Block) => {
		const font = block.bold ? bold : regular;
		const size = block.size ?? SIZE;
		const leading = LEADING * (size / SIZE);
		const width = fullWidth - (block.indent ?? 0);
		const wrapped = wrapText(toPdfSafe(block.text, font), font, size, width);
		return { font, size, leading, wrapped, height: wrapped.length * leading };
	};

	blocks.forEach((block, index) => {
		if (block.pageBreak && !fresh) newPage();
		const { font, size, leading, wrapped, height } = layout(block);
		let needed = block.keep && height < usable ? height : leading;
		const next = blocks[index + 1];
		if (block.keepWithNext && next) needed = height + Math.min(layout(next).height, leading * 2);
		if (y - needed < MARGIN.bottom) newPage();
		for (const line of wrapped) {
			if (y - leading < MARGIN.bottom) newPage();
			y -= leading;
			if (line !== '') {
				page.drawText(line, {
					x: MARGIN.left + (block.indent ?? 0),
					y,
					size,
					font,
					color: block.muted ? MUTED : INK
				});
				fresh = false;
			}
		}
		y -= block.after * LEADING;
	});

	const pages = pdf.getPages();
	const label = options.pageLabel ?? ((n: number, total: number) => `Page ${n} of ${total}`);
	pages.forEach((current, index) => {
		const footer = toPdfSafe(label(index + 1, pages.length), regular);
		const footerWidth = regular.widthOfTextAtSize(footer, 8);
		current.drawText(footer, {
			x: (PAGE.width - footerWidth) / 2,
			y: MARGIN.bottom / 2,
			size: 8,
			font: regular,
			color: MUTED
		});
	});

	return pdf.save({ useObjectStreams: true });
}

export function createLetterPdf(
	letter: RenderedLetter,
	options: PdfOptions & { enclosureSubtitle: string }
): Promise<Uint8Array> {
	return renderBlocksToPdf(letterBlocks(letter, options.enclosureSubtitle), options);
}

/** Just the timeline, for doctors, advocates or your own records. */
export function createTimelinePdf(
	title: string,
	subtitle: string,
	lines: EnclosureLine[],
	options: PdfOptions
): Promise<Uint8Array> {
	const blocks = enclosureBlocks(title, subtitle, lines);
	const first = blocks[0];
	if (first) first.pageBreak = false;
	return renderBlocksToPdf(blocks, options);
}
