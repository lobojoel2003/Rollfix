<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import { daysWithout } from '../engine/clock.ts';
	import { PROBLEM_LABELS, type Repair } from '../engine/model.ts';
	import { paths } from '../paths.ts';
	import { app } from '../store/app.svelte.ts';

	let { repairs }: { repairs: Repair[] } = $props();
</script>

<ul class="repairs">
	{#each repairs as repair (repair.id)}
		{@const days = daysWithout(repair, app.today)}
		<li class="card">
			<a href={paths.repair(repair.id)}>
				<span class="days"><strong>{days}</strong> {days === 1 ? 'day' : 'days'}</span>
				<span>
					{PROBLEM_LABELS[repair.problem]}, {formatDate(repair.brokeOn, 'en-US', 'medium')}
					{repair.fixedOn ? `to ${formatDate(repair.fixedOn, 'en-US', 'medium')}` : '(still open)'}
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.repairs {
		display: grid;
		gap: 0.75rem;
		padding: 0;
		list-style: none;
	}

	.repairs .card {
		padding: 0;
	}

	a {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		align-items: baseline;
		min-height: var(--target);
		padding: 0.9rem 1.1rem;
		color: inherit;
		text-decoration: none;
		border-radius: var(--radius);
	}

	a:hover {
		background: var(--surface-2);
	}

	.days {
		min-width: 6rem;
		color: var(--primary);
	}

	.days strong {
		font-size: 1.5rem;
		font-variant-numeric: tabular-nums;
	}
</style>
