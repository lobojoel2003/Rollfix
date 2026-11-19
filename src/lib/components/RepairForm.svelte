<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate, isISODate } from '../engine/civil-date.ts';
	import {
		emptyContact,
		newId,
		PAYER_KINDS,
		PAYER_LABELS,
		PROBLEM_KINDS,
		PROBLEM_LABELS,
		SEVERITIES,
		SEVERITY_LABELS,
		type Repair
	} from '../engine/model.ts';
	import { US_STATES } from '../engine/states.ts';
	import { paths } from '../paths.ts';
	import { app } from '../store/app.svelte.ts';
	import ErrorSummary from './ErrorSummary.svelte';
	import Icon from './Icon.svelte';

	let { repair }: { repair?: Repair } = $props();

	const editing = $derived(!!repair);
	const today = $derived(app.today);

	function blank(): Repair {
		const now = new Date().toISOString();
		return {
			id: newId(),
			created: now,
			updated: now,
			state: app.profile.state,
			brokeOn: '',
			severity: 'stranded',
			problem: 'other',
			details: '',
			chair: { make: '', model: '', serial: '' },
			supplier: { ...emptyContact(), account: '' },
			payer: { ...emptyContact(), kind: 'medicare', memberId: '', claim: '' },
			entries: []
		};
	}

	// A working copy; saved only on submit.
	// svelte-ignore state_referenced_locally
	let draft = $state<Repair>(repair ? structuredClone($state.snapshot(repair)) : blank());
	let reportedOn = $state('');
	let errors = $state<Record<string, string>>({});
	let summary: ErrorSummary | undefined = $state();
	let confirmDelete = $state(false);

	const SUPPLIERS = ['Numotion', 'National Seating & Mobility', 'Hoveround', 'Pride Mobility'];

	function validate(): Record<string, string> {
		const found: Record<string, string> = {};
		if (!isISODate(draft.brokeOn)) found['broke-on'] = 'Enter the date your chair stopped working.';
		else if (draft.brokeOn > today)
			found['broke-on'] = 'The date your chair broke can’t be in the future.';
		if (reportedOn) {
			if (!isISODate(reportedOn))
				found['reported-on'] = 'Enter the date you reported it, or leave it blank.';
			else if (reportedOn > today)
				found['reported-on'] = 'The date you reported it can’t be in the future.';
			else if (isISODate(draft.brokeOn) && reportedOn < draft.brokeOn)
				found['reported-on'] = 'You can’t have reported it before it broke.';
		}
		if (draft.fixedOn && isISODate(draft.brokeOn) && draft.fixedOn < draft.brokeOn)
			found['broke-on'] = 'The chair can’t have broken after it was fixed.';
		return found;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errors = validate();
		if (Object.keys(errors).length > 0) {
			await summary?.focus();
			return;
		}
		const next: Repair = $state.snapshot(draft) as Repair;
		if (!editing && reportedOn) {
			next.entries = [
				{
					id: newId(),
					date: reportedOn,
					kind: 'reported',
					party: 'supplier',
					note: 'Reported the problem to the supplier.'
				}
			];
		}
		const saved = await app.saveRepair(next);
		if (!app.profile.state && saved.state)
			await app.saveProfile({ ...app.profile, state: saved.state });
		app.notify(editing ? 'Repair details saved.' : 'Repair log started.', 'success', true);
		app.focusTarget = 'day-counter';
		await goto(editing ? paths.repair(saved.id) : paths.home());
	}

	async function remove() {
		if (!repair) return;
		await app.deleteRepair(repair.id);
		app.notify(
			`Deleted the repair from ${formatDate(repair.brokeOn, 'en-US', 'long')}.`,
			'success',
			true
		);
		await goto(paths.home());
	}
</script>

<form onsubmit={submit} novalidate class="reading">
	<ErrorSummary {errors} bind:this={summary} />

	<fieldset>
		<legend><h2>What happened</h2></legend>
		<div class="field">
			<label for="broke-on">Date your chair stopped working</label>
			<span class="help" id="broke-on-help">
				This is Day 1. If you’re not sure, pick your best guess.
			</span>
			<input
				id="broke-on"
				class="input-short"
				type="date"
				bind:value={draft.brokeOn}
				max={today}
				required
				aria-describedby="broke-on-help{errors['broke-on'] ? ' broke-on-error' : ''}"
				aria-invalid={errors['broke-on'] ? true : undefined}
			/>
			{#if errors['broke-on']}<p class="error-text" id="broke-on-error">
					{errors['broke-on']}
				</p>{/if}
		</div>

		<fieldset class="field">
			<legend>How bad is it?</legend>
			<div class="choices" style="--min: 100%">
				{#each SEVERITIES as severity (severity)}
					<label class="choice">
						<input type="radio" name="severity" value={severity} bind:group={draft.severity} />
						<span>{SEVERITY_LABELS[severity]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="field">
			<legend>What is wrong?</legend>
			<div class="choices">
				{#each PROBLEM_KINDS as problem (problem)}
					<label class="choice">
						<input type="radio" name="problem" value={problem} bind:group={draft.problem} />
						<span>{PROBLEM_LABELS[problem]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="field">
			<label for="details">Details <span class="muted">(optional)</span></label>
			<span class="help" id="details-help">Error codes, noises, what it does or doesn’t do.</span>
			<textarea id="details" bind:value={draft.details} aria-describedby="details-help" rows="3"
			></textarea>
		</div>

		{#if !editing}
			<div class="field">
				<label for="reported-on">
					Date you first reported it to the supplier <span class="muted">(optional)</span>
				</label>
				<span class="help" id="reported-on-help">
					State repair deadlines often start from this day. Leave it blank if you haven’t called
					yet.
				</span>
				<input
					id="reported-on"
					class="input-short"
					type="date"
					bind:value={reportedOn}
					max={today}
					aria-describedby="reported-on-help{errors['reported-on'] ? ' reported-on-error' : ''}"
					aria-invalid={errors['reported-on'] ? true : undefined}
				/>
				{#if errors['reported-on']}<p class="error-text" id="reported-on-error">
						{errors['reported-on']}
					</p>{/if}
			</div>
		{/if}
	</fieldset>

	<fieldset>
		<legend><h2>Your state</h2></legend>
		<div class="field">
			<label for="state">State where you live</label>
			<span class="help" id="state-help">
				Rollfix uses this to find the repair rules that protect you.
			</span>
			<select id="state" bind:value={draft.state} aria-describedby="state-help">
				<option value="">Choose a state</option>
				{#each US_STATES as state (state.code)}
					<option value={state.code}>{state.name}</option>
				{/each}
			</select>
		</div>
	</fieldset>

	<fieldset>
		<legend><h2>Your chair</h2></legend>
		<div class="row">
			<div class="field">
				<label for="chair-make">Make</label>
				<input
					id="chair-make"
					bind:value={draft.chair.make}
					autocomplete="off"
					placeholder="e.g. Permobil"
				/>
			</div>
			<div class="field">
				<label for="chair-model">Model</label>
				<input
					id="chair-model"
					bind:value={draft.chair.model}
					autocomplete="off"
					placeholder="e.g. M3 Corpus"
				/>
			</div>
		</div>
		<div class="field">
			<label for="chair-serial">Serial number <span class="muted">(optional)</span></label>
			<span class="help" id="serial-help">Usually on a sticker on the frame, under the seat.</span>
			<input
				id="chair-serial"
				class="input-short"
				bind:value={draft.chair.serial}
				autocomplete="off"
				aria-describedby="serial-help"
			/>
		</div>
	</fieldset>

	<fieldset>
		<legend><h2>Supplier</h2></legend>
		<p class="help">The company that provided the chair and does the repairs.</p>
		<div class="field">
			<label for="supplier-name">Company name</label>
			<input
				id="supplier-name"
				bind:value={draft.supplier.name}
				list="supplier-names"
				autocomplete="organization"
			/>
			<datalist id="supplier-names">
				{#each SUPPLIERS as name (name)}<option value={name}></option>{/each}
			</datalist>
		</div>
		<div class="row">
			<div class="field">
				<label for="supplier-phone">Phone</label>
				<input
					id="supplier-phone"
					type="tel"
					bind:value={draft.supplier.phone}
					autocomplete="off"
				/>
			</div>
			<div class="field">
				<label for="supplier-email">Email</label>
				<input
					id="supplier-email"
					type="email"
					bind:value={draft.supplier.email}
					autocomplete="off"
				/>
			</div>
		</div>
		<div class="field">
			<label for="supplier-address">Mailing address</label>
			<span class="help" id="supplier-address-help">Used on letters. One line per line.</span>
			<textarea
				id="supplier-address"
				bind:value={draft.supplier.address}
				rows="3"
				aria-describedby="supplier-address-help"></textarea>
		</div>
		<div class="field">
			<label for="supplier-account">Your account or work order number</label>
			<input
				id="supplier-account"
				class="input-short"
				bind:value={draft.supplier.account}
				autocomplete="off"
			/>
		</div>
	</fieldset>

	<fieldset>
		<legend><h2>Insurance</h2></legend>
		<div class="field">
			<label for="payer-kind">Who pays for repairs?</label>
			<select id="payer-kind" bind:value={draft.payer.kind}>
				{#each PAYER_KINDS as kind (kind)}<option value={kind}>{PAYER_LABELS[kind]}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="payer-name">Plan name <span class="muted">(optional)</span></label>
			<span class="help" id="payer-name-help">
				For example your Medicaid plan or Medicare Advantage plan.
			</span>
			<input
				id="payer-name"
				bind:value={draft.payer.name}
				aria-describedby="payer-name-help"
				autocomplete="off"
			/>
		</div>
		<div class="row">
			<div class="field">
				<label for="payer-member">Member ID</label>
				<input id="payer-member" bind:value={draft.payer.memberId} autocomplete="off" />
			</div>
			<div class="field">
				<label for="payer-claim">Claim or authorization number</label>
				<input id="payer-claim" bind:value={draft.payer.claim} autocomplete="off" />
			</div>
		</div>
		<div class="row">
			<div class="field">
				<label for="payer-phone">Phone</label>
				<input id="payer-phone" type="tel" bind:value={draft.payer.phone} autocomplete="off" />
			</div>
			<div class="field">
				<label for="payer-email">Email</label>
				<input id="payer-email" type="email" bind:value={draft.payer.email} autocomplete="off" />
			</div>
		</div>
		<div class="field">
			<label for="payer-address">Mailing address</label>
			<textarea id="payer-address" bind:value={draft.payer.address} rows="3"></textarea>
		</div>
	</fieldset>

	<div class="button-row submit">
		<button class="button big" type="submit">
			<Icon name="check" />
			{editing ? 'Save changes' : 'Start the log'}
		</button>
		<a class="button big secondary" href={repair ? paths.repair(repair.id) : paths.home()}>
			Cancel
		</a>
	</div>
</form>

{#if repair}
	<section aria-labelledby="delete-heading" class="reading danger-zone">
		<h2 id="delete-heading">Delete this repair</h2>
		<p>This removes the repair and its whole timeline from this device. It can’t be undone.</p>
		{#if confirmDelete}
			<div class="notice danger" role="alert">
				<p><strong>Delete the whole repair log?</strong></p>
				<div class="button-row">
					<button class="button danger" type="button" onclick={remove}>
						<Icon name="trash" /> Yes, delete it
					</button>
					<button class="button secondary" type="button" onclick={() => (confirmDelete = false)}>
						No, keep it
					</button>
				</div>
			</div>
		{:else}
			<button class="button danger" type="button" onclick={() => (confirmDelete = true)}>
				<Icon name="trash" /> Delete repair
			</button>
		{/if}
	</section>
{/if}

<style>
	fieldset {
		margin-block: 2rem;
	}

	fieldset fieldset {
		margin-block: 1.5rem 0;
	}

	legend h2 {
		margin-bottom: 0.75rem;
	}

	.row {
		display: grid;
		gap: 0 1rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
	}

	.row .field + .field {
		margin-top: 0;
	}

	.row + .field,
	.field + .row {
		margin-top: 1.5rem;
	}

	.submit {
		margin-top: 2rem;
	}

	.danger-zone {
		margin-top: 4rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}
</style>
