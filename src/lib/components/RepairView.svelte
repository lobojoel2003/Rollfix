<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import { daysWithout, missedPromises } from '../engine/clock.ts';
	import {
		chairDescription,
		PAYER_LABELS,
		PROBLEM_LABELS,
		type EntryKind,
		type Repair
	} from '../engine/model.ts';
	import { buildTimeline, describeItem } from '../engine/timeline.ts';
	import { repairRules } from '../content.ts';
	import { downloadBlob, fileSlug, pdfBlob } from '../download.ts';
	import { paths } from '../paths.ts';
	import { app } from '../store/app.svelte.ts';
	import DayCounter from './DayCounter.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import RulesPanel from './RulesPanel.svelte';
	import Timeline from './Timeline.svelte';

	let { repair }: { repair: Repair } = $props();

	const today = $derived(app.today);
	const rules = $derived(repairRules(repair, today));
	const missed = $derived(missedPromises(repair, today));
	const overdue = $derived(rules.deadlines.filter((check) => check.status === 'missed'));
	const isSample = $derived(repair.id.startsWith('sample-'));
	let fixedOn = $state('');
	let fixError = $state('');
	let working = $state(false);

	const quick: { kind: EntryKind; label: string; icon: IconName }[] = [
		{ kind: 'call', label: 'Phone call', icon: 'phone' },
		{ kind: 'message', label: 'Email or message', icon: 'mail' },
		{ kind: 'visit', label: 'Technician visit', icon: 'wrench' },
		{ kind: 'no_show', label: 'Nobody came', icon: 'no-show' }
	];

	async function downloadTimeline() {
		working = true;
		try {
			const { createTimelinePdf } = await import('../pdf/letter-pdf.ts');
			const lines = buildTimeline(repair, today).map((item) => describeItem(item));
			const title = `Power wheelchair repair timeline${app.profile.name ? `: ${app.profile.name}` : ''}`;
			const subtitle = `${repair.fixedOn ? `Fixed after ${daysWithout(repair, today)} days` : `Day ${daysWithout(repair, today) + 1} without the chair`}. Kept with Rollfix on ${formatDate(today, 'en-US', 'long')}.`;
			const bytes = await createTimelinePdf(title, subtitle, lines, {
				title,
				author: app.profile.name || undefined
			});
			downloadBlob(pdfBlob(bytes), `${fileSlug(`repair-timeline-${repair.brokeOn}`)}.pdf`);
			app.notify('Timeline downloaded as a PDF.');
		} finally {
			working = false;
		}
	}

	async function markFixed(event: SubmitEvent) {
		event.preventDefault();
		fixError = '';
		const date = fixedOn || today;
		if (date < repair.brokeOn) {
			fixError = 'The repair date can’t be before the chair broke.';
			return;
		}
		await app.setFixed(repair.id, date);
		app.notify(`Marked as fixed on ${formatDate(date, 'en-US', 'long')}.`);
		app.focusTarget = 'day-counter';
	}

	async function reopen() {
		await app.setFixed(repair.id, undefined);
		app.notify('Repair reopened. The count continues from the day it broke.');
		app.focusTarget = 'day-counter';
	}

	async function clearSample() {
		await app.clearSample();
		app.notify('Sample data removed.');
	}
</script>

{#if isSample}
	<div class="notice info sample no-print" data-testid="sample-banner">
		<p>
			<strong>This is sample data</strong> so you can see how Rollfix works. Nothing here is real.
		</p>
		<button class="button secondary" type="button" onclick={clearSample}>
			Remove sample data
		</button>
	</div>
{/if}

<DayCounter {repair} {today} />

<ul class="chips" aria-label="Summary">
	{#if missed.length > 0}
		<li class="badge danger" data-testid="missed-promises">
			<Icon name="alert" size={16} />
			<span>{`${missed.length} ${missed.length === 1 ? 'promise' : 'promises'} not kept`}</span>
		</li>
	{/if}
	{#if overdue.length > 0}
		<li class="badge danger" data-testid="missed-deadlines">
			<Icon name="law" size={16} />
			<span>
				{`${overdue.length} state ${overdue.length === 1 ? 'deadline' : 'deadlines'} missed`}
			</span>
		</li>
	{/if}
	{#if repair.supplier.name}<li class="badge">Supplier: {repair.supplier.name}</li>{/if}
	<li class="badge">Insurance: {repair.payer.name || PAYER_LABELS[repair.payer.kind]}</li>
</ul>

<div class="button-row primary-actions no-print">
	<a class="button big" href={paths.entry(repair.id)}><Icon name="plus" /> Add to timeline</a>
	<a class="button big secondary" href={paths.letters(repair.id)}>
		<Icon name="letter" /> Write a letter
	</a>
</div>

{#if !repair.fixedOn}
	<nav class="quick no-print" aria-label="Quick add">
		<p class="small muted">Quick add:</p>
		<ul>
			{#each quick as item (item.kind)}
				<li>
					<a class="button secondary" href={paths.entry(repair.id, { kind: item.kind })}>
						<Icon name={item.icon} />
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<div class="layout">
	<section aria-labelledby="timeline-heading" class="timeline-section">
		<div class="section-head">
			<h2 id="timeline-heading">Timeline</h2>
			<button
				class="button quiet no-print"
				type="button"
				onclick={downloadTimeline}
				disabled={working}
			>
				<Icon name="download" /> Download timeline (PDF)
			</button>
		</div>
		<Timeline {repair} {today} />
	</section>

	<div class="side">
		<RulesPanel {repair} {rules} />

		<section aria-labelledby="details-heading">
			<h2 id="details-heading">Repair details</h2>
			<dl class="facts">
				<dt>Chair</dt>
				<dd>
					{chairDescription(repair) || 'Not added'}{#if repair.chair.serial}, serial {repair.chair
							.serial}{/if}
				</dd>
				<dt>Problem</dt>
				<dd>{PROBLEM_LABELS[repair.problem]}</dd>
				<dt>Supplier</dt>
				<dd>
					{repair.supplier.name || 'Not added'}{#if repair.supplier.phone}<br />{repair.supplier
							.phone}{/if}
				</dd>
				<dt>Insurance</dt>
				<dd>
					{repair.payer.name || PAYER_LABELS[repair.payer.kind]}{#if repair.payer.memberId}<br
						/>Member ID {repair.payer.memberId}{/if}
				</dd>
			</dl>
			<p class="no-print">
				<a class="button secondary" href={paths.editRepair(repair.id)}>
					<Icon name="edit" /> Edit repair details
				</a>
			</p>
		</section>

		<section aria-labelledby="fixed-heading" class="no-print">
			{#if repair.fixedOn}
				<h2 id="fixed-heading">Chair working again?</h2>
				<p>If it broke again, reopen this repair to keep counting.</p>
				<button class="button secondary" type="button" onclick={reopen}>Reopen this repair</button>
			{:else}
				<h2 id="fixed-heading">Chair fixed?</h2>
				<form onsubmit={markFixed} novalidate>
					<div class="field">
						<label for="fixed-on">Date it was fixed</label>
						<span class="help" id="fixed-on-help">Leave blank for today.</span>
						<input
							id="fixed-on"
							class="input-short"
							type="date"
							bind:value={fixedOn}
							min={repair.brokeOn}
							max={today}
							aria-describedby="fixed-on-help{fixError ? ' fixed-on-error' : ''}"
							aria-invalid={fixError ? true : undefined}
						/>
						{#if fixError}<p class="error-text" id="fixed-on-error">{fixError}</p>{/if}
					</div>
					<p><button class="button" type="submit"><Icon name="check" /> Mark as fixed</button></p>
				</form>
			{/if}
		</section>
	</div>
</div>

<style>
	.sample {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	.sample p {
		margin: 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.25rem 0;
		padding: 0;
		list-style: none;
	}

	.chips .badge {
		font-size: 0.95rem;
		padding: 0.25rem 0.8rem;
		white-space: normal;
	}

	.primary-actions {
		margin-block: 1.5rem 1rem;
	}

	.quick {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
	}

	.quick p {
		margin: 0;
	}

	.quick ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.layout {
		display: grid;
		gap: 0 2.5rem;
		margin-top: 1rem;
	}

	@media (min-width: 62rem) {
		.layout {
			grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		}
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.section-head h2 {
		margin: 0;
	}
</style>
