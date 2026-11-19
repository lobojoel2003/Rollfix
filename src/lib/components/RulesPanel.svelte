<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import type { Repair } from '../engine/model.ts';
	import { STATUS_LABELS, type DeadlineCheck, type RulesForRepair } from '../engine/rules.ts';
	import { stateName } from '../engine/states.ts';
	import { profileFor } from '../content.ts';
	import { paths } from '../paths.ts';
	import Icon from './Icon.svelte';

	let { repair, rules }: { repair: Repair; rules: RulesForRepair } = $props();

	const profile = $derived(profileFor(repair.state));
	const long = (date: string | undefined) => (date ? formatDate(date, 'en-US', 'long') : '');
	const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
	const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

	const TONE: Record<DeadlineCheck['status'], string> = {
		not_started: '',
		running: 'info',
		paused: 'info',
		due_today: 'warning',
		met: 'success',
		met_late: 'warning',
		missed: 'danger',
		not_in_effect: ''
	};

	function explain(check: DeadlineCheck): string {
		const { deadline } = check;
		const period = `${plural(deadline.period.days, deadline.period.count === 'business' ? 'business day' : 'day')}`;
		switch (check.status) {
			case 'not_started':
				return `The clock starts when ${deadline.starts.label}. Log that on your timeline and Rollfix will count ${period} from it.`;
			case 'not_in_effect':
				return `This rule was not in effect yet when the clock would have started.`;
			case 'running':
				return `Started ${long(check.start)}, when ${deadline.starts.label}. ${capitalize(deadline.met_label)} is due by ${long(check.due)}: ${plural(check.daysLeft ?? 0, 'day')} left.`;
			case 'paused':
				return `Started ${long(check.start)}, when ${deadline.starts.label}. The clock stopped on ${long(check.pausedSince)} while ${check.pausedFor ?? 'waiting'}, after ${plural(check.daysUsed ?? 0, deadline.period.count === 'business' ? 'business day' : 'day')} of ${period}. Log when the wait ends and the count picks up again.`;
			case 'due_today':
				return `Started ${long(check.start)}. Today, ${long(check.due)}, is the last day for ${deadline.met_label}.`;
			case 'met':
				return `Started ${long(check.start)}, due ${long(check.due)}. Met on ${long(check.metOn)}.`;
			case 'met_late':
				return `Due ${long(check.due)}, but ${deadline.met_label} only happened on ${long(check.metOn)}: ${plural(check.daysLate ?? 0, 'day')} late.`;
			case 'missed':
				return `Started ${long(check.start)}, when ${deadline.starts.label}. It was due by ${long(check.due)}. It is ${plural(check.daysLate ?? 0, 'day')} overdue.`;
		}
	}
</script>

<section aria-labelledby="rules-heading" class="rules" data-testid="rules-panel">
	<h2 id="rules-heading">
		<Icon name="law" size={24} />
		{repair.state ? `${stateName(repair.state)} rules` : 'Your state’s rules'}
	</h2>
	{#if !repair.state}
		<p>
			<a href={paths.editRepair(repair.id)}>Add your state</a> to see the repair rules that apply to you.
		</p>
	{:else if rules.deadlines.length === 0 && rules.protections.length === 0}
		<p>
			{#if profile}
				{profile.summary}
			{:else}
				Rollfix doesn’t know of a law in {stateName(repair.state)} that sets wheelchair repair deadlines
				yet. You can still send letters, and complain to your state’s attorney general.
			{/if}
		</p>
	{:else}
		{#if rules.deadlines.length > 0}
			<ul class="checks">
				{#each rules.deadlines as check (check.deadline.id)}
					<li class="card tone-{TONE[check.status]}" data-status={check.status}>
						<p class="head">
							<strong>{check.deadline.title}</strong>
							<span class="badge {TONE[check.status]}">{STATUS_LABELS[check.status]}</span>
						</p>
						<p>{explain(check)}</p>
						<p class="small muted">
							{check.law.citation}{#if check.jurisdiction.id === 'US'}
								(federal){/if}
						</p>
					</li>
				{/each}
			</ul>
		{/if}
		{#if rules.protections.length > 0}
			<h3>Other protections that apply</h3>
			<ul class="protections">
				{#each rules.protections as { protection, law } (protection.id)}
					<li>
						<strong>{protection.title}.</strong>
						{protection.description}
						<span class="small muted">({law.citation})</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
	<p>
		<a href={repair.state && profile ? paths.state(repair.state) : paths.rules()}>
			{repair.state && profile
				? `Read the ${stateName(repair.state)} rules in full`
				: 'See every state'}
		</a>
	</p>
</section>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.checks {
		display: grid;
		gap: 0.75rem;
		padding: 0;
		list-style: none;
	}

	.checks .card {
		border-inline-start: 6px solid var(--border-strong);
	}

	.tone-danger {
		border-inline-start-color: var(--danger) !important;
	}

	.tone-warning {
		border-inline-start-color: var(--warning) !important;
	}

	.tone-success {
		border-inline-start-color: var(--success) !important;
	}

	.tone-info {
		border-inline-start-color: var(--primary) !important;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.35rem;
	}

	.protections li + li {
		margin-top: 0.5rem;
	}
</style>
