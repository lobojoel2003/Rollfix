<script lang="ts">
	import { addDays, formatDate } from '../engine/civil-date.ts';
	import { letterToText, missingValues, renderLetter, type Addressee } from '../engine/letters.ts';
	import { newId, PAYER_LABELS, type Repair } from '../engine/model.ts';
	import { RECIPIENTS, type Recipient } from '../engine/schema.ts';
	import { stateName } from '../engine/states.ts';
	import { LETTERS, repairRules } from '../content.ts';
	import { downloadBlob, fileSlug, pdfBlob } from '../download.ts';
	import { paths } from '../paths.ts';
	import { app } from '../store/app.svelte.ts';
	import Icon from './Icon.svelte';
	import LetterPreview from './LetterPreview.svelte';

	let { repair, to }: { repair: Repair; to?: Recipient } = $props();

	const today = $derived(app.today);
	const rules = $derived(repairRules(repair, today));
	// svelte-ignore state_referenced_locally
	let recipient = $state<Recipient>(to ?? 'supplier');
	const letter = $derived(LETTERS[recipient]);

	// Per-recipient choices, kept when switching back and forth.
	let options = $state<Record<string, boolean>>({});
	const resolvedOptions = $derived(
		Object.fromEntries(
			letter.options.map((option) => [
				option.id,
				options[`${recipient}:${option.id}`] ?? option.default
			])
		)
	);
	let responseDays = $state<Record<Recipient, number>>({
		supplier: LETTERS.supplier.response_days,
		insurer: LETTERS.insurer.response_days,
		agency: LETTERS.agency.response_days
	});
	let impact = $state('');

	// Offices for a complaint: the state's (and Medicare's, when it pays), or one you type.
	const offices = $derived(rules.agencies);
	let officeId = $state('');
	let customOffice = $state<Addressee>({ name: '', address: '' });
	/** Addresses typed in for offices Rollfix has no mailing address for. */
	let officeAddresses = $state<Record<string, string>>({});
	const officeKey = (office: (typeof offices)[number]) =>
		`${office.jurisdiction.id}:${office.agency.id}`;
	const chosenOffice = $derived(offices.find((office) => officeKey(office) === officeId));
	$effect(() => {
		if (!officeId) officeId = offices[0] ? officeKey(offices[0]) : 'custom';
	});
	const addressee = $derived<Addressee | undefined>(
		recipient !== 'agency'
			? undefined
			: chosenOffice
				? {
						name: chosenOffice.agency.name,
						address: chosenOffice.agency.address ?? officeAddresses[officeId] ?? ''
					}
				: customOffice
	);

	// Your details, needed for the letterhead. Saved to Settings when you change them here.
	let me = $state({ ...app.profile });
	let savingProfile = $state(false);

	const rendered = $derived(
		renderLetter({
			letter,
			repair,
			profile: me,
			rules,
			stateName: repair.state ? stateName(repair.state) : 'state',
			today,
			options: resolvedOptions,
			impact,
			responseDays: responseDays[recipient],
			addressee
		})
	);
	const missing = $derived(missingValues(rendered));
	let working = $state(false);
	let status = $state('');

	const RECIPIENT_LABELS: Record<Recipient, { title: string; who: string }> = $derived({
		supplier: { title: 'Supplier', who: repair.supplier.name || 'the company doing the repair' },
		insurer: { title: 'Insurance', who: repair.payer.name || PAYER_LABELS[repair.payer.kind] },
		agency: { title: 'The state', who: 'a state office, or Medicare' }
	});

	async function saveProfile() {
		savingProfile = true;
		await app.saveProfile({ ...app.profile, ...me });
		savingProfile = false;
		status = 'Your details are saved for next time.';
	}

	function filename(extension: string) {
		return `${fileSlug(`rollfix-letter-${recipient}-${today}`)}.${extension}`;
	}

	async function downloadPdf() {
		working = true;
		try {
			const { createLetterPdf } = await import('../pdf/letter-pdf.ts');
			const bytes = await createLetterPdf(rendered, {
				title: `Letter to ${RECIPIENT_LABELS[recipient].who}`,
				author: me.name || undefined,
				enclosureSubtitle: `Kept with Rollfix. Printed ${formatDate(today, 'en-US', 'long')}.`
			});
			downloadBlob(pdfBlob(bytes), filename('pdf'));
			status = 'The letter was downloaded as a PDF.';
		} finally {
			working = false;
		}
	}

	function downloadText() {
		downloadBlob(
			new Blob([letterToText(rendered)], { type: 'text/plain;charset=utf-8' }),
			filename('txt')
		);
		status = 'The letter was downloaded as a text file.';
	}

	async function copyText() {
		try {
			await navigator.clipboard.writeText(letterToText(rendered));
			status = 'The letter was copied. Paste it into an email or a web form.';
		} catch {
			status = 'Your browser blocked copying. Use “Download as text” instead.';
		}
	}

	async function logSent() {
		const who =
			recipient === 'agency'
				? addressee?.name || 'a state office'
				: RECIPIENT_LABELS[recipient].who;
		const id = newId();
		await app.saveEntry(repair.id, {
			id,
			date: today,
			kind: 'letter',
			party: recipient === 'supplier' ? 'supplier' : recipient === 'insurer' ? 'insurer' : 'agency',
			note: `Sent a letter to ${who}: “${rendered.subject.map((segment) => segment.text).join('')}”. Asked for a reply by ${formatDate(addDays(today, responseDays[recipient]), 'en-US', 'long')}.`
		});
		status = 'Added to your timeline: letter sent today.';
	}
</script>

<div class="builder">
	<form class="controls no-print" onsubmit={(event) => event.preventDefault()}>
		<fieldset>
			<legend><h2>1. Who is it to?</h2></legend>
			<div class="choices" style="--min: 100%">
				{#each RECIPIENTS as option (option)}
					<label class="choice">
						<input type="radio" name="recipient" value={option} bind:group={recipient} />
						<span>
							<strong>{RECIPIENT_LABELS[option].title}</strong>
							<span class="hint">{LETTERS[option].description}</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		{#if recipient === 'agency'}
			<fieldset>
				<legend><h3>Which office?</h3></legend>
				<div class="choices" style="--min: 100%">
					{#each offices as office (officeKey(office))}
						{@const { agency, jurisdiction } = office}
						<label class="choice">
							<input type="radio" name="office" value={officeKey(office)} bind:group={officeId} />
							<span>
								{agency.name}
								<span class="hint">
									{jurisdiction.id === 'US' ? 'Federal. ' : ''}{agency.handles}
									<a href={agency.url} rel="external noopener" target="_blank">
										Online complaint form<span class="visually-hidden"> (opens in a new tab)</span>
									</a>
								</span>
							</span>
						</label>
					{/each}
					<label class="choice">
						<input type="radio" name="office" value="custom" bind:group={officeId} />
						<span>Another office<span class="hint">Type the name and address yourself.</span></span>
					</label>
				</div>
				{#if chosenOffice && !chosenOffice.agency.address}
					<div class="field">
						<label for="office-mail">Mailing address for {chosenOffice.agency.name}</label>
						<span class="help" id="office-mail-help">
							Rollfix doesn’t have this office’s mailing address. Add it from the office’s website,
							or send the letter through its online complaint form instead.
						</span>
						<textarea
							id="office-mail"
							bind:value={officeAddresses[officeId]}
							rows="3"
							aria-describedby="office-mail-help"></textarea>
					</div>
				{/if}
				{#if officeId === 'custom'}
					<div class="field">
						<label for="office-name">Office name</label>
						<input id="office-name" bind:value={customOffice.name} autocomplete="off" />
					</div>
					<div class="field">
						<label for="office-address">Mailing address</label>
						<textarea id="office-address" bind:value={customOffice.address} rows="3"></textarea>
					</div>
				{/if}
			</fieldset>
		{/if}

		<fieldset>
			<legend><h2>2. What to ask for</h2></legend>
			{#each letter.options as option (`${recipient}:${option.id}`)}
				<label class="choice">
					<input
						type="checkbox"
						checked={resolvedOptions[option.id]}
						onchange={(event) =>
							(options[`${recipient}:${option.id}`] = event.currentTarget.checked)}
					/>
					<span>
						{option.label}{#if option.help}<span class="hint">{option.help}</span>{/if}
					</span>
				</label>
			{/each}
			<div class="field">
				<label for="response-days">Ask for an answer within</label>
				<select id="response-days" class="input-short" bind:value={responseDays[recipient]}>
					{#each [5, 7, 10, 14, 21, 30] as days (days)}
						<option value={days}>{days} days</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="impact">How has this affected you? <span class="muted">(optional)</span></label>
				<span class="help" id="impact-help">
					A sentence or two in your own words. Effects you logged on the timeline are added
					automatically.
				</span>
				<textarea id="impact" bind:value={impact} rows="4" aria-describedby="impact-help"
				></textarea>
			</div>
		</fieldset>

		<fieldset>
			<legend><h2>3. Your details</h2></legend>
			<p class="help">These go at the top of the letter.</p>
			<div class="field">
				<label for="me-name">Your name</label>
				<input id="me-name" bind:value={me.name} autocomplete="name" />
			</div>
			<div class="field">
				<label for="me-address">Your address</label>
				<textarea id="me-address" bind:value={me.address} rows="3" autocomplete="street-address"
				></textarea>
			</div>
			<div class="field">
				<label for="me-phone">Phone <span class="muted">(optional)</span></label>
				<input id="me-phone" type="tel" bind:value={me.phone} autocomplete="tel" />
			</div>
			<div class="field">
				<label for="me-email">Email <span class="muted">(optional)</span></label>
				<input id="me-email" type="email" bind:value={me.email} autocomplete="email" />
			</div>
			<p>
				<button
					class="button secondary"
					type="button"
					onclick={saveProfile}
					disabled={savingProfile}
				>
					Save my details for next time
				</button>
			</p>
		</fieldset>
	</form>

	<section class="output" aria-labelledby="preview-heading">
		<div class="no-print">
			<h2 id="preview-heading">4. Check it and send it</h2>
			{#if missing.length > 0}
				<div class="notice warning" data-testid="missing-values">
					<p>
						Some details are missing. They show in <span class="missing-sample">red</span> in the letter:
					</p>
					<ul>
						{#each missing as item (item)}<li>{item.replace(/^\[|\]$/g, '')}</li>{/each}
					</ul>
					<p class="small">
						Add them above, or <a href={paths.editRepair(repair.id)}>in the repair details</a>.
					</p>
				</div>
			{:else}
				<p class="muted">Highlighted words come from your log. Read it through before sending.</p>
			{/if}
			<div class="button-row actions">
				<button
					class="button big"
					type="button"
					onclick={downloadPdf}
					disabled={working}
					data-testid="download-pdf"
				>
					<Icon name="download" /> Download PDF
				</button>
				<button class="button secondary" type="button" onclick={() => window.print()}>
					<Icon name="print" /> Print
				</button>
				<button class="button secondary" type="button" onclick={copyText}>
					<Icon name="copy" /> Copy text
				</button>
				<button class="button secondary" type="button" onclick={downloadText}>
					<Icon name="download" /> Download as text
				</button>
			</div>
			<p class="status" role="status" aria-live="polite">{status}</p>
			<p>
				<button class="button quiet" type="button" onclick={logSent}>
					<Icon name="send" /> I sent it: add it to my timeline
				</button>
			</p>
		</div>
		<LetterPreview letter={rendered} />
	</section>
</div>

<style>
	.builder {
		display: grid;
		gap: 2rem;
	}

	@media (min-width: 70rem) {
		.builder {
			grid-template-columns: minmax(20rem, 26rem) minmax(0, 1fr);
			align-items: start;
		}

		.output {
			position: sticky;
			top: 1rem;
		}
	}

	fieldset {
		margin-bottom: 2rem;
	}

	fieldset .choice + .choice {
		margin-top: 0.5rem;
	}

	fieldset .choice + .field {
		margin-top: 1.5rem;
	}

	.hint a {
		display: inline-block;
		margin-top: 0.2rem;
	}

	.actions {
		margin-block: 1rem 0.5rem;
	}

	.status {
		min-height: 1.6em;
		font-weight: 600;
		color: var(--success);
	}

	.missing-sample {
		color: var(--danger);
		font-weight: 700;
	}

	@media print {
		.builder {
			display: block;
		}
	}
</style>
