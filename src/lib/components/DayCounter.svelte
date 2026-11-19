<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import { headline } from '../engine/clock.ts';
	import { SEVERITY_LABELS, type Repair } from '../engine/model.ts';

	let {
		repair,
		today,
		id = 'day-counter'
	}: { repair: Repair; today: string; id?: string } = $props();

	const line = $derived(headline(repair, today));
	const broke = $derived(formatDate(repair.brokeOn, 'en-US', 'full'));
	const fixed = $derived(repair.fixedOn ? formatDate(repair.fixedOn, 'en-US', 'full') : '');
</script>

<div class="counter" class:fixed={!!repair.fixedOn} data-testid="day-counter">
	<h1 {id} tabindex="-1">
		<span class="before">{line.before}</span>
		<span class="number" data-testid="day-number">{line.number}</span>
		<span class="after">{line.after}</span>
	</h1>
	<p class="since">
		{#if repair.fixedOn}
			Broke on {broke}. Fixed on {fixed}.
		{:else}
			Since {broke}. {SEVERITY_LABELS[repair.severity]}.
		{/if}
	</p>
</div>

<style>
	.counter {
		padding-block: 1.5rem 0.5rem;
	}

	h1 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.3em;
		margin: 0;
		font-size: clamp(1.8rem, 1.2rem + 2.5vw, 2.8rem);
		font-weight: 750;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}

	.number {
		font-size: clamp(5rem, 3rem + 10vw, 9.5rem);
		font-weight: 850;
		letter-spacing: -0.05em;
		font-variant-numeric: tabular-nums;
		color: var(--primary);
		line-height: 0.9;
	}

	.fixed .number {
		color: var(--success);
	}

	.after {
		flex-basis: 100%;
	}

	@media (min-width: 48rem) {
		.after {
			flex-basis: auto;
		}
	}

	.since {
		margin: 0.75rem 0 0;
		font-size: 1.15rem;
		color: var(--muted);
	}
</style>
