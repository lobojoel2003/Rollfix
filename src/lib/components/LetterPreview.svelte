<script lang="ts">
	import type { RenderedLetter } from '../engine/letters.ts';
	import type { Segment } from '../engine/template.ts';

	let { letter }: { letter: RenderedLetter } = $props();

	/** Split body text into paragraphs, keeping segments. */
	function paragraphs(segments: readonly Segment[]): Segment[][] {
		const out: Segment[][] = [[]];
		for (const segment of segments) {
			const parts = segment.text.split(/\n{2,}/);
			parts.forEach((part, index) => {
				if (index > 0) out.push([]);
				if (part !== '') out.at(-1)?.push({ ...segment, text: part });
			});
		}
		return out.filter((paragraph) => paragraph.length > 0);
	}
</script>

{#snippet segments(list: readonly Segment[])}
	{#each list as segment, index (index)}
		{#if segment.type === 'value'}
			<span class="value" class:missing={segment.missing}>{segment.text}</span>
		{:else}
			{segment.text}
		{/if}
	{/each}
{/snippet}

{#snippet lines(block: readonly Segment[][])}
	{#each block as line, index (index)}
		<span class="line">{@render segments(line)}</span>
	{/each}
{/snippet}

<article class="sheet" aria-label="Letter preview" data-testid="letter-preview">
	<p class="block">{@render lines(letter.sender)}</p>
	<p>{letter.date}</p>
	<p class="block">{@render lines(letter.recipient)}</p>
	<p class="subject">
		<strong>Re: {@render segments(letter.subject)}</strong>
		{#each letter.references as reference (reference)}
			<span class="line">{reference}</span>
		{/each}
	</p>
	{#each paragraphs(letter.body) as paragraph, index (index)}
		<p class="body">{@render segments(paragraph)}</p>
	{/each}
	<p>{letter.closing}</p>
	<p class="signature">{@render segments(letter.signature)}</p>
	<p>Enclosure: {letter.enclosureLabel}</p>

	<section class="enclosure" aria-label="Enclosure: {letter.enclosureLabel}">
		<h2>{letter.enclosureLabel}</h2>
		<ol>
			{#each letter.enclosure as line, index (index)}
				<li><strong>{line.heading}</strong><br />{line.text}</li>
			{/each}
		</ol>
	</section>
</article>

<style>
	.sheet {
		background: #fff;
		color: #141414;
		font-family: var(--font-letter);
		font-size: 1.05rem;
		line-height: 1.55;
		padding: clamp(1.25rem, 4vw, 3rem);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow);
		max-width: 46rem;
	}

	.line {
		display: block;
	}

	.body {
		white-space: pre-line;
	}

	.subject {
		margin-block: 1.5rem;
	}

	.signature {
		margin-top: 2.5rem;
	}

	.value {
		background: #eef1ff;
		border-bottom: 2px solid #8b97d8;
		border-radius: 2px;
	}

	.value.missing {
		background: #fde8e6;
		border-bottom: 2px dashed #a3241a;
		color: #8a1c13;
		font-style: italic;
	}

	.enclosure {
		margin-top: 2.5rem;
		padding-top: 1.5rem;
		border-top: 2px dashed #bbb;
	}

	.enclosure h2 {
		font-family: var(--font);
		font-size: 1.15rem;
	}

	.enclosure ol {
		padding-inline-start: 1.25rem;
	}

	.enclosure li + li {
		margin-top: 0.6rem;
	}

	@media print {
		.sheet {
			border: 0;
			box-shadow: none;
			padding: 0;
			font-size: 11pt;
		}

		.value,
		.value.missing {
			background: none;
			border: 0;
			color: inherit;
			font-style: normal;
		}

		.enclosure {
			break-before: page;
			border: 0;
		}
	}
</style>
