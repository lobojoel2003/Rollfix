<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatDate, isISODate } from '../engine/civil-date.ts';
	import {
		ENTRY_KINDS,
		KIND_INFO,
		newId,
		PARTIES,
		PARTY_LABELS,
		type Entry,
		type EntryKind,
		type PromiseOutcome,
		type Repair
	} from '../engine/model.ts';
	import { paths } from '../paths.ts';
	import { app } from '../store/app.svelte.ts';
	import ErrorSummary from './ErrorSummary.svelte';
	import Icon from './Icon.svelte';

	let { repair, entry, kind }: { repair: Repair; entry?: Entry; kind?: EntryKind | null } =
		$props();

	const today = $derived(app.today);
	const editing = $derived(!!entry);
	// svelte-ignore state_referenced_locally
	const initialKind: EntryKind = entry?.kind ?? kind ?? 'call';

	// svelte-ignore state_referenced_locally
	let draft = $state({
		kind: initialKind,
		date: entry?.date ?? app.today,
		time: entry?.time ?? '',
		party: entry?.party ?? KIND_INFO[initialKind].party,
		person: entry?.person ?? '',
		note: entry?.note ?? '',
		reference: entry?.reference ?? '',
		hasPromise: !!entry?.promise,
		promiseText: entry?.promise?.text ?? '',
		promiseDue: entry?.promise?.due ?? '',
		promiseOutcome: (entry?.promise?.outcome ?? 'open') as PromiseOutcome
	});
	// svelte-ignore state_referenced_locally
	let partyTouched = $state(!!entry);
	let errors = $state<Record<string, string>>({});
	let summary: ErrorSummary | undefined = $state();
	let confirmDelete = $state(false);

	const back = $derived(app.current?.id === repair.id ? paths.home() : paths.repair(repair.id));

	const NOTE_LABEL: Partial<Record<EntryKind, string>> = {
		call: 'What was said',
		message: 'What it said',
		visit: 'What the technician found or did',
		no_show: 'What was supposed to happen',
		impact: 'What happened to you',
		auth_denied: 'The reason they gave',
		letter: 'Who you sent it to and how'
	};

	function chooseKind(next: EntryKind) {
		draft.kind = next;
		if (!partyTouched) draft.party = KIND_INFO[next].party;
	}

	function validate(): Record<string, string> {
		const found: Record<string, string> = {};
		if (!isISODate(draft.date)) found['entry-date'] = 'Enter the date this happened.';
		else if (draft.date > today)
			found['entry-date'] = 'The date can’t be in the future. Log plans as a promise instead.';
		else if (draft.date < repair.brokeOn)
			found['entry-date'] =
				`Entries start on the day the chair broke (${formatDate(repair.brokeOn, 'en-US', 'long')}).`;
		if (draft.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))
			found['entry-time'] = 'Enter the time like 2:30 PM, or leave it blank.';
		if (draft.hasPromise) {
			if (!draft.promiseText.trim()) found['promise-text'] = 'Say what they promised to do.';
			if (!isISODate(draft.promiseDue))
				found['promise-due'] = 'Enter the date they promised it by.';
			else if (isISODate(draft.date) && draft.promiseDue < draft.date)
				found['promise-due'] = 'The promised date can’t be before the day they promised it.';
		}
		return found;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		errors = validate();
		if (Object.keys(errors).length > 0) {
			await summary?.focus();
			return;
		}
		const saved: Entry = {
			id: entry?.id ?? newId(),
			date: draft.date,
			kind: draft.kind,
			party: draft.party,
			note: draft.note.trim()
		};
		if (draft.time) saved.time = draft.time;
		if (draft.person.trim()) saved.person = draft.person.trim();
		if (draft.reference.trim()) saved.reference = draft.reference.trim();
		if (draft.hasPromise) {
			saved.promise = {
				text: draft.promiseText.trim(),
				due: draft.promiseDue,
				outcome: draft.promiseOutcome
			};
		}
		const wasOpen = !repair.fixedOn;
		await app.saveEntry(repair.id, saved);
		const label = `${KIND_INFO[saved.kind].label}, ${formatDate(saved.date, 'en-US', 'long')}`;
		const closed = wasOpen && saved.kind === 'repaired';
		app.notify(
			closed
				? `Saved. Your chair is marked as fixed on ${formatDate(saved.date, 'en-US', 'long')}.`
				: `Saved: ${label}.`,
			'success',
			true
		);
		app.focusTarget = closed ? 'day-counter' : `entry-${saved.id}`;
		await goto(closed ? paths.repair(repair.id) : back);
	}

	async function remove() {
		if (!entry) return;
		await app.deleteEntry(repair.id, entry.id);
		app.notify('Entry deleted.', 'success', true);
		app.focusTarget = 'timeline-heading';
		await goto(back);
	}
</script>

<form onsubmit={submit} novalidate class="reading">
	<ErrorSummary {errors} bind:this={summary} />

	<fieldset>
		<legend><h2>What happened?</h2></legend>
		<div class="choices">
			{#each ENTRY_KINDS as option (option)}
				<label class="choice">
					<input
						type="radio"
						name="kind"
						value={option}
						checked={draft.kind === option}
						onchange={() => chooseKind(option)}
					/>
					<span>
						{KIND_INFO[option].label}
						<span class="hint">{KIND_INFO[option].hint}</span>
					</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend><h2>When</h2></legend>
		<div class="row">
			<div class="field">
				<label for="entry-date">Date</label>
				<input
					id="entry-date"
					type="date"
					bind:value={draft.date}
					min={repair.brokeOn}
					max={today}
					required
					aria-invalid={errors['entry-date'] ? true : undefined}
					aria-describedby={errors['entry-date'] ? 'entry-date-error' : undefined}
				/>
				{#if errors['entry-date']}<p class="error-text" id="entry-date-error">
						{errors['entry-date']}
					</p>{/if}
			</div>
			<div class="field">
				<label for="entry-time">Time <span class="muted">(optional)</span></label>
				<input
					id="entry-time"
					type="time"
					bind:value={draft.time}
					aria-invalid={errors['entry-time'] ? true : undefined}
					aria-describedby={errors['entry-time'] ? 'entry-time-error' : undefined}
				/>
				{#if errors['entry-time']}<p class="error-text" id="entry-time-error">
						{errors['entry-time']}
					</p>{/if}
			</div>
		</div>
	</fieldset>

	<fieldset>
		<legend><h2>Details</h2></legend>
		<div class="row">
			<div class="field">
				<label for="entry-party">Who was it with?</label>
				<select id="entry-party" bind:value={draft.party} onchange={() => (partyTouched = true)}>
					{#each PARTIES as party (party)}<option value={party}>
							{PARTY_LABELS[party]}
						</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="entry-person">Name of the person <span class="muted">(optional)</span></label>
				<input id="entry-person" bind:value={draft.person} autocomplete="off" />
			</div>
		</div>
		<div class="field">
			<label for="entry-note">{NOTE_LABEL[draft.kind] ?? 'What happened'}</label>
			<span class="help" id="entry-note-help">
				Write it the way you’d tell a friend. Exact words help.
			</span>
			<textarea id="entry-note" bind:value={draft.note} rows="4" aria-describedby="entry-note-help"
			></textarea>
		</div>
		<div class="field">
			<label for="entry-reference">Reference number <span class="muted">(optional)</span></label>
			<span class="help" id="entry-reference-help">
				Work order, ticket, case or authorization number.
			</span>
			<input
				id="entry-reference"
				class="input-short"
				bind:value={draft.reference}
				autocomplete="off"
				aria-describedby="entry-reference-help"
			/>
		</div>
	</fieldset>

	<fieldset>
		<legend><h2>Promises</h2></legend>
		<label class="choice">
			<input type="checkbox" bind:checked={draft.hasPromise} aria-controls="promise-fields" />
			<span>
				They promised to do something by a date
				<span class="hint">
					Like “a technician will come Tuesday” or “we’ll call you back tomorrow”.
				</span>
			</span>
		</label>
		<div id="promise-fields" hidden={!draft.hasPromise}>
			<div class="field">
				<label for="promise-text">What did they promise?</label>
				<input
					id="promise-text"
					bind:value={draft.promiseText}
					placeholder="e.g. a technician visit"
					autocomplete="off"
					aria-invalid={errors['promise-text'] ? true : undefined}
					aria-describedby={errors['promise-text'] ? 'promise-text-error' : undefined}
				/>
				{#if errors['promise-text']}<p class="error-text" id="promise-text-error">
						{errors['promise-text']}
					</p>{/if}
			</div>
			<div class="field">
				<label for="promise-due">By what date?</label>
				<input
					id="promise-due"
					class="input-short"
					type="date"
					bind:value={draft.promiseDue}
					min={draft.date}
					aria-invalid={errors['promise-due'] ? true : undefined}
					aria-describedby={errors['promise-due'] ? 'promise-due-error' : undefined}
				/>
				{#if errors['promise-due']}<p class="error-text" id="promise-due-error">
						{errors['promise-due']}
					</p>{/if}
			</div>
			<fieldset class="field">
				<legend>Did they keep it?</legend>
				<div class="choices" style="--min: 12rem">
					<label class="choice">
						<input
							type="radio"
							name="outcome"
							value="open"
							bind:group={draft.promiseOutcome}
						/><span>Not yet / not sure</span>
					</label>
					<label class="choice">
						<input
							type="radio"
							name="outcome"
							value="kept"
							bind:group={draft.promiseOutcome}
						/><span>Yes, they kept it</span>
					</label>
					<label class="choice">
						<input
							type="radio"
							name="outcome"
							value="broken"
							bind:group={draft.promiseOutcome}
						/><span>No, it didn’t happen</span>
					</label>
				</div>
			</fieldset>
		</div>
	</fieldset>

	<div class="button-row submit">
		<button class="button big" type="submit">
			<Icon name="check" />
			{editing ? 'Save changes' : 'Save to timeline'}
		</button>
		<a class="button big secondary" href={back}>Cancel</a>
	</div>
</form>

{#if entry}
	<section class="reading danger-zone" aria-labelledby="delete-entry-heading">
		<h2 id="delete-entry-heading">Delete this entry</h2>
		{#if confirmDelete}
			<div class="notice danger" role="alert">
				<p><strong>Delete this entry from the timeline?</strong></p>
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
				<Icon name="trash" /> Delete entry
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
		margin-bottom: 0.5rem;
	}

	.row {
		display: grid;
		gap: 0 1rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
	}

	.row .field + .field {
		margin-top: 0;
	}

	.row + .field {
		margin-top: 1.5rem;
	}

	#promise-fields {
		margin-top: 1rem;
		padding-inline-start: 1rem;
		border-inline-start: 4px solid var(--border);
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
