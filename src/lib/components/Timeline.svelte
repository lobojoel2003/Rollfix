<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import type { PromiseState } from '../engine/clock.ts';
	import type { Repair, TimelineKind } from '../engine/model.ts';
	import { buildTimeline, PROMISE_LABELS } from '../engine/timeline.ts';
	import { paths } from '../paths.ts';
	import { app } from '../store/app.svelte.ts';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		repair,
		today,
		readonly = false
	}: { repair: Repair; today: string; readonly?: boolean } = $props();

	const items = $derived(buildTimeline(repair, today));

	const ICON: Record<TimelineKind, IconName> = {
		broke: 'alert',
		reported: 'flag',
		call: 'phone',
		message: 'mail',
		visit: 'wrench',
		no_show: 'no-show',
		auth_requested: 'shield',
		auth_approved: 'shield-check',
		auth_denied: 'shield-x',
		parts_ordered: 'package',
		parts_arrived: 'package-check',
		loaner: 'chair',
		letter: 'send',
		impact: 'heart',
		repaired: 'check',
		note: 'note'
	};

	const TONE: Record<PromiseState, string> = {
		kept: 'success',
		broken: 'danger',
		overdue: 'danger',
		due_today: 'warning',
		pending: 'info'
	};

	function time(value: string): string {
		const [h, m] = value.split(':').map(Number);
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: 'UTC'
		}).format(new Date(Date.UTC(2000, 0, 1, h ?? 0, m ?? 0)));
	}

	async function mark(entryId: string, outcome: 'kept' | 'broken') {
		await app.setPromiseOutcome(repair.id, entryId, outcome);
		app.notify(outcome === 'kept' ? 'Marked as kept.' : 'Marked as broken.');
	}
</script>

<ol class="timeline" data-testid="timeline">
	{#each items as item (item.id)}
		<li id="entry-{item.id}" class="item kind-{item.kind}" data-kind={item.kind} tabindex="-1">
			<div class="marker" aria-hidden="true"><Icon name={ICON[item.kind]} size={22} /></div>
			<article aria-labelledby="entry-{item.id}-title">
				<p class="when">
					<span class="day">Day {item.day}</span>
					<time datetime={item.date}>{formatDate(item.date, 'en-US', 'medium')}</time>
					{#if item.time}<span>{time(item.time)}</span>{/if}
				</p>
				<h3 id="entry-{item.id}-title">
					{item.title}{#if item.who}<span class="who">: {item.who}</span>{/if}
				</h3>
				{#if item.note}<p class="note">{item.note}</p>{/if}
				{#if item.reference}<p class="small muted">Reference: {item.reference}</p>{/if}
				{#if item.promise}
					<div class="promise tone-{TONE[item.promise.state]}">
						<p>
							<strong>Promised:</strong>
							{item.promise.text || 'to follow up'}, by
							<time datetime={item.promise.due}>
								{formatDate(item.promise.due, 'en-US', 'medium')}
							</time>
							<span class="badge {TONE[item.promise.state]}">
								{PROMISE_LABELS[item.promise.state]}
							</span>
						</p>
						{#if !readonly && item.entry && item.promise.state !== 'kept' && item.promise.state !== 'broken'}
							{@const entryId = item.entry.id}
							<div class="button-row">
								<button
									class="button secondary"
									type="button"
									onclick={() => mark(entryId, 'kept')}
								>
									<Icon name="check" /> They kept it
								</button>
								<button
									class="button secondary"
									type="button"
									onclick={() => mark(entryId, 'broken')}
								>
									<Icon name="x" /> It didn't happen
								</button>
							</div>
						{/if}
					</div>
				{/if}
				{#if !readonly}
					<p class="actions">
						{#if item.entry}
							<a class="button quiet" href={paths.entry(repair.id, { entry: item.entry.id })}>
								<Icon name="edit" /> Edit<span class="visually-hidden">
									: {item.title}, {formatDate(item.date, 'en-US', 'medium')}
								</span>
							</a>
						{:else}
							<a class="button quiet" href={paths.editRepair(repair.id)}>
								<Icon name="edit" /> Edit repair details
							</a>
						{/if}
					</p>
				{/if}
			</article>
		</li>
	{/each}
</ol>

<style>
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
		position: relative;
	}

	.item {
		display: grid;
		grid-template-columns: 2.75rem 1fr;
		gap: 0 1rem;
		position: relative;
		padding-bottom: 1.25rem;
		border-radius: var(--radius);
	}

	.item:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 2.75rem;
		bottom: 0;
		inset-inline-start: calc(1.375rem - 1px);
		width: 2px;
		background: var(--border);
	}

	.marker {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--primary-soft);
		color: var(--primary);
		border: 2px solid var(--primary);
	}

	.kind-broke .marker,
	.kind-no_show .marker,
	.kind-auth_denied .marker,
	.kind-impact .marker {
		background: var(--danger-soft);
		color: var(--danger);
		border-color: var(--danger);
	}

	.kind-repaired .marker,
	.kind-auth_approved .marker,
	.kind-parts_arrived .marker {
		background: var(--success-soft);
		color: var(--success);
		border-color: var(--success);
	}

	article {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.85rem 1.1rem;
		box-shadow: var(--shadow);
		min-width: 0;
	}

	.when {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		margin: 0 0 0.2rem;
		color: var(--muted);
		font-size: 0.95rem;
	}

	.day {
		font-weight: 750;
		color: var(--text);
	}

	h3 {
		margin: 0 0 0.3rem;
		font-size: 1.1rem;
	}

	.who {
		font-weight: 500;
	}

	.note {
		margin: 0 0 0.5rem;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

	.promise {
		margin: 0.6rem 0 0.3rem;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		border-inline-start: 5px solid var(--primary);
	}

	.promise p {
		margin: 0 0 0.4rem;
	}

	.promise.tone-danger {
		border-color: var(--danger);
	}

	.promise.tone-success {
		border-color: var(--success);
	}

	.promise.tone-warning {
		border-color: var(--warning);
	}

	.actions {
		margin: 0.25rem 0 0;
	}

	.actions .button {
		margin-inline-start: -0.9rem;
	}
</style>
