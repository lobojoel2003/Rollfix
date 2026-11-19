<script lang="ts">
	import { formatDate } from '../engine/civil-date.ts';
	import { lawInForce, type Jurisdiction } from '../engine/rules.ts';
	import { PAYER_LABELS } from '../engine/model.ts';
	import type { ConditionsDef, LawDef } from '../engine/schema.ts';
	import { ISSUES } from '../paths.ts';
	import Icon from './Icon.svelte';

	let { jurisdiction, today }: { jurisdiction: Jurisdiction; today: string } = $props();

	const long = (date: string) => formatDate(date, 'en-US', 'long');
	const ROLE_LABELS: Record<string, string> = {
		supplier: 'suppliers',
		manufacturer: 'manufacturers',
		insurer: 'insurers',
		medicaid: 'Medicaid',
		medicare: 'Medicare'
	};

	function lawStatus(law: LawDef): { label: string; tone: string } {
		if (law.status === 'pending') return { label: 'Bill pending', tone: 'info' };
		if (law.status === 'failed') return { label: 'Did not pass', tone: '' };
		if (lawInForce(law, today))
			return {
				label: law.effective ? `In force since ${long(law.effective)}` : 'In force',
				tone: 'success'
			};
		return {
			label: `Takes effect ${law.effective ? long(law.effective) : 'later'}`,
			tone: 'warning'
		};
	}

	function conditions(value: ConditionsDef | undefined): string {
		if (!value?.payers) return '';
		return `Applies when your insurance is: ${value.payers.map((payer) => PAYER_LABELS[payer]).join(', ')}.`;
	}

	const lawById = (id: string) => jurisdiction.laws.find((law) => law.id === id);
</script>

<p class="lead">{jurisdiction.summary}</p>
<p class="small muted" data-testid="last-checked">
	Last checked against the official sources on {long(jurisdiction.last_checked)}.
</p>

{#if jurisdiction.laws.length > 0}
	<section aria-labelledby="laws-heading">
		<h2 id="laws-heading">Laws</h2>
		<ul class="cards">
			{#each jurisdiction.laws as law (law.id)}
				{@const status = lawStatus(law)}
				<li class="card" id="law-{law.id}">
					<p class="head">
						<strong>{law.title}</strong>
						<span class="badge {status.tone}">{status.label}</span>
					</p>
					<p>{law.summary}</p>
					<dl class="facts small">
						<dt>Citation</dt>
						<dd>{law.citation}</dd>
						<dt>Bill</dt>
						<dd>{law.bill}</dd>
						<dt>Applies to</dt>
						<dd>{law.applies_to.map((role) => ROLE_LABELS[role] ?? role).join(', ')}</dd>
					</dl>
					<p>
						<a href={law.url} rel="external noopener">
							Read the law <Icon name="external" size={16} /><span class="visually-hidden">
								({law.title})
							</span>
						</a>
					</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if jurisdiction.deadlines.length > 0}
	<section aria-labelledby="deadlines-heading">
		<h2 id="deadlines-heading">Deadlines Rollfix checks for you</h2>
		<p>
			Log the events on your timeline and Rollfix counts these for you, then puts the result in your
			letters.
		</p>
		<ul class="cards">
			{#each jurisdiction.deadlines as deadline (deadline.id)}
				{@const law = lawById(deadline.law)}
				<li class="card">
					<h3>{deadline.title}</h3>
					<p class="period">
						<Icon name="clock" />
						<strong>
							{deadline.period.days}
							{deadline.period.count === 'business' ? 'business' : 'calendar'}
							{deadline.period.days === 1 ? 'day' : 'days'}
						</strong>
						after {deadline.starts.label}
					</p>
					<p>{deadline.description}</p>
					{#if deadline.quote}<blockquote>“{deadline.quote}”</blockquote>{/if}
					{#if conditions(deadline.applies_if)}<p class="small">
							{conditions(deadline.applies_if)}
						</p>{/if}
					{#if law}<p class="small muted">{law.citation}</p>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if jurisdiction.protections.length > 0}
	<section aria-labelledby="protections-heading">
		<h2 id="protections-heading">Other protections</h2>
		<ul class="cards">
			{#each jurisdiction.protections as protection (protection.id)}
				{@const law = lawById(protection.law)}
				<li class="card">
					<h3>{protection.title}</h3>
					<p>{protection.description}</p>
					{#if conditions(protection.applies_if)}<p class="small">
							{conditions(protection.applies_if)}
						</p>{/if}
					{#if law}<p class="small muted">{law.citation}</p>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if jurisdiction.agencies.length > 0}
	<section aria-labelledby="complain-heading">
		<h2 id="complain-heading">Where to complain</h2>
		<ul class="cards">
			{#each jurisdiction.agencies as agency (agency.id)}
				<li class="card">
					<h3>{agency.name}</h3>
					<p>{agency.handles}</p>
					{#if conditions(agency.applies_if)}<p class="small">
							{conditions(agency.applies_if)}
						</p>{/if}
					<dl class="facts small">
						{#if agency.phone}<dt>Phone</dt>
							<dd>{agency.phone}</dd>{/if}
						{#if agency.address}<dt>Mail</dt>
							<dd class="address">{agency.address}</dd>{/if}
					</dl>
					<p>
						<a href={agency.url} rel="external noopener">
							File a complaint online <Icon name="external" size={16} /><span
								class="visually-hidden"
							>
								({agency.name})
							</span>
						</a>
					</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if jurisdiction.sources.length > 0}
	<section aria-labelledby="sources-heading">
		<h2 id="sources-heading">Sources</h2>
		<ul>
			{#each jurisdiction.sources as source (source.url)}
				<li><a href={source.url} rel="external noopener">{source.label}</a></li>
			{/each}
		</ul>
	</section>
{/if}

<div class="notice">
	<p>
		<strong>Not legal advice.</strong> These rules were written up from the official sources listed
		above, in plain language. Laws change. Spot a mistake or a new law?
		<a href={ISSUES} rel="external noopener">Tell us on GitHub</a>.
	</p>
</div>

<style>
	.cards {
		display: grid;
		gap: 1rem;
		padding: 0;
		list-style: none;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: space-between;
		align-items: center;
	}

	.period {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		font-size: 1.1rem;
	}

	blockquote {
		margin: 0 0 1rem;
		padding: 0.5rem 1rem;
		border-inline-start: 4px solid var(--border-strong);
		color: var(--muted);
		font-style: italic;
	}

	.address {
		white-space: pre-line;
	}
</style>
