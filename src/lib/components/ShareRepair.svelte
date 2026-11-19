<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import { PAYER_LABELS, PROBLEM_LABELS, SEVERITY_LABELS, type Repair } from '../engine/model.ts';
	import { stateName } from '../engine/states.ts';
	import { repairRules } from '../content.ts';
	import { app } from '../store/app.svelte.ts';
	import { deleteReport, StatsError, submitReport, updateReport } from '../stats/client.ts';
	import {
		buildReport,
		cannotShare,
		detectSupplier,
		SUPPLIER_LABELS,
		type StatsReport,
		type SupplierKey
	} from '../stats/payload.ts';
	import Icon from './Icon.svelte';

	let { repair }: { repair: Repair } = $props();

	const detected = $derived(detectSupplier(repair.supplier.name));
	// svelte-ignore state_referenced_locally
	let supplier = $state<SupplierKey>(
		repair.share
			? ((JSON.parse(repair.share.payload) as StatsReport).supplier ?? detected)
			: detected
	);
	let consent = $state(false);
	let busy = $state(false);
	let message = $state('');
	let failure = $state('');

	const blocked = $derived(cannotShare(repair));
	const report = $derived(buildReport(repair, repairRules(repair, app.today), app.today, supplier));
	const json = $derived(JSON.stringify(report, null, 2));
	const changed = $derived(!!repair.share && repair.share.payload !== JSON.stringify(report));
	const supplierChoices = $derived([
		...new Set<SupplierKey>([detected, 'independent', 'not_shared'])
	]);
	const id = $derived(`share-${repair.id}`);

	const yesNo = (value: boolean | null) =>
		value === null ? 'Doesn’t apply' : value ? 'Yes' : 'No';
	const days = (value: number | null) =>
		value === null ? 'Not logged' : `${value} ${value === 1 ? 'day' : 'days'}`;

	async function share() {
		failure = '';
		message = '';
		busy = true;
		try {
			const receipt = await submitReport(report);
			await app.saveRepair({
				...repair,
				share: { ...receipt, sharedAt: new Date().toISOString(), payload: JSON.stringify(report) }
			});
			message = 'Thank you. Your numbers were shared anonymously.';
		} catch (error) {
			failure =
				error instanceof StatsError ? error.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function update() {
		if (!repair.share) return;
		failure = '';
		busy = true;
		try {
			await updateReport(repair.share, report);
			await app.saveRepair({
				...repair,
				share: {
					...repair.share,
					sharedAt: new Date().toISOString(),
					payload: JSON.stringify(report)
				}
			});
			message = 'Your shared numbers were updated.';
		} catch (error) {
			failure =
				error instanceof StatsError ? error.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!repair.share) return;
		failure = '';
		busy = true;
		try {
			await deleteReport(repair.share);
		} catch (error) {
			// Already gone on the server is fine.
			if (!(error instanceof StatsError && error.status === 404)) {
				failure =
					error instanceof StatsError ? error.message : 'Something went wrong. Please try again.';
				busy = false;
				return;
			}
		}
		const next = { ...repair };
		delete next.share;
		await app.saveRepair(next);
		message = 'Your numbers were removed from the stats server.';
		busy = false;
	}
</script>

<article class="card" aria-labelledby="{id}-title" data-testid="share-card">
	<h2 id="{id}-title">
		{PROBLEM_LABELS[repair.problem]}, from {formatDate(repair.brokeOn, 'en-US', 'long')}
	</h2>

	{#if blocked}
		<p>{blocked}</p>
	{:else}
		{#if !repair.share}
			<fieldset>
				<legend>Include the supplier?</legend>
				<p class="help">
					It helps advocates see which companies are slow. The name you typed is never sent.
				</p>
				<div class="choices" style="--min: 14rem">
					{#each supplierChoices as key (key)}
						<label class="choice">
							<input type="radio" name="{id}-supplier" value={key} bind:group={supplier} />
							<span>
								{key === 'not_shared' ? 'Don’t include the supplier' : SUPPLIER_LABELS[key]}
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<h3>This is everything that would be sent</h3>
		<dl class="facts" data-testid="share-preview">
			<dt>State</dt>
			<dd>{stateName(report.state)}</dd>
			<dt>Insurance type</dt>
			<dd>{PAYER_LABELS[report.payer]}</dd>
			<dt>Supplier</dt>
			<dd>{SUPPLIER_LABELS[report.supplier]}</dd>
			<dt>Problem</dt>
			<dd>{PROBLEM_LABELS[report.problem]}</dd>
			<dt>How bad</dt>
			<dd>{SEVERITY_LABELS[report.severity]}</dd>
			<dt>Month it broke</dt>
			<dd>{report.broke_month}</dd>
			<dt>Fixed yet</dt>
			<dd>{yesNo(report.resolved)}</dd>
			<dt>Days without the chair</dt>
			<dd>{days(report.days_without_chair)}</dd>
			<dt>Days until a technician came</dt>
			<dd>{days(report.days_to_first_visit)}</dd>
			<dt>Days waiting for insurance</dt>
			<dd>{days(report.days_waiting_approval)}</dd>
			<dt>Days waiting for parts</dt>
			<dd>{days(report.days_waiting_parts)}</dd>
			<dt>Promises made / not kept</dt>
			<dd>{report.promises_made} / {report.promises_broken}</dd>
			<dt>Had a loaner chair</dt>
			<dd>{yesNo(report.had_loaner)}</dd>
			<dt>A state deadline was missed</dt>
			<dd>{yesNo(report.state_deadline_missed)}</dd>
		</dl>
		<details>
			<summary>Show the exact data (JSON)</summary>
			<pre><code>{json}</code></pre>
		</details>

		{#if repair.share}
			<p class="notice success">
				<Icon name="check" /> Shared on {formatDate(
					repair.share.sharedAt.slice(0, 10),
					'en-US',
					'long'
				)}.
				{#if changed}Your log has changed since then.{/if}
			</p>
			<div class="button-row">
				{#if changed}
					<button class="button" type="button" onclick={update} disabled={busy}>
						<Icon name="upload" /> Update my shared numbers
					</button>
				{/if}
				<button class="button danger" type="button" onclick={remove} disabled={busy}>
					<Icon name="trash" /> Remove my numbers
				</button>
			</div>
		{:else}
			<label class="choice consent">
				<input type="checkbox" bind:checked={consent} />
				<span>
					I want to share these numbers anonymously. I can remove them later from this page.
				</span>
			</label>
			<p>
				<button
					class="button"
					type="button"
					onclick={share}
					disabled={!consent || busy}
					data-testid="share-button"
				>
					<Icon name="share" /> Share anonymously
				</button>
			</p>
		{/if}
	{/if}
	<p class="status" role="status" aria-live="polite">{message}</p>
	{#if failure}<p class="error-text" role="alert">{failure}</p>{/if}
</article>

<style>
	h2 {
		font-size: 1.3rem;
	}

	h3 {
		margin-top: 1.5rem;
	}

	pre {
		overflow-x: auto;
		padding: 0.75rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
	}

	.consent {
		margin-top: 1.5rem;
	}

	.status {
		min-height: 1.6em;
		margin: 0.5rem 0 0;
		color: var(--success);
		font-weight: 650;
	}
</style>
