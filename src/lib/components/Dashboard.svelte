<script lang="ts">
	import {
		PAYER_LABELS,
		PROBLEM_LABELS,
		type PayerKind,
		type ProblemKind
	} from '../engine/model.ts';
	import { stateName } from '../engine/states.ts';
	import type { Bucket, Group, Stats } from '../stats/client.ts';
	import { SUPPLIER_LABELS, type SupplierKey } from '../stats/payload.ts';
	import { downloadBlob } from '../download.ts';
	import Icon from './Icon.svelte';

	let { stats }: { stats: Stats } = $props();

	const o = $derived(stats.overall);
	const number = new Intl.NumberFormat('en-US');
	const percent = (part: number, whole: number) =>
		whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–';
	const days = (value: number | null) =>
		value === null ? '–' : `${number.format(Math.round(value))}`;

	const groups = $derived([
		{
			id: 'state',
			title: 'By state',
			rows: stats.by_state,
			label: (key: string) => stateName(key)
		},
		{
			id: 'payer',
			title: 'By insurance',
			rows: stats.by_payer,
			label: (key: string) => PAYER_LABELS[key as PayerKind] ?? key
		},
		{
			id: 'supplier',
			title: 'By supplier',
			rows: stats.by_supplier,
			label: (key: string) => SUPPLIER_LABELS[key as SupplierKey] ?? key
		},
		{
			id: 'problem',
			title: 'By problem',
			rows: stats.by_problem,
			label: (key: string) => PROBLEM_LABELS[key as ProblemKind] ?? key
		}
	]);

	// Histogram geometry.
	const W = 640;
	const H = 260;
	const pad = { top: 16, right: 12, bottom: 44, left: 44 };
	const innerW = W - pad.left - pad.right;
	const innerH = H - pad.top - pad.bottom;
	const maxCount = $derived(Math.max(1, ...stats.histogram.map((bucket) => bucket.reports)));
	const ticks = $derived.by(() => {
		const step = niceStep(maxCount / 4);
		const top = Math.ceil(maxCount / step) * step;
		return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
	});
	const yMax = $derived(ticks.at(-1) ?? maxCount);
	const band = $derived(innerW / Math.max(1, stats.histogram.length));
	const barWidth = $derived(Math.min(24, band * 0.6));
	const tallest = $derived(
		stats.histogram.reduce(
			(best, bucket) => (bucket.reports > best.reports ? bucket : best),
			stats.histogram[0] ?? { reports: 0, label: '', min: 0, max: null }
		)
	);

	function niceStep(raw: number): number {
		const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
		const unit = raw / power;
		return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
	}

	function barPath(x: number, y: number, width: number, height: number): string {
		const r = Math.min(4, height, width / 2);
		if (height <= 0) return '';
		return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
	}

	let hover = $state<{ bucket: Bucket; x: number; y: number } | null>(null);

	function csv(): string {
		const rows = [['group', 'key', 'label', 'reports', 'median_days', 'p90_days', 'resolved']];
		for (const group of groups) {
			for (const row of group.rows) {
				rows.push([
					group.id,
					row.key,
					group.label(row.key),
					String(row.reports),
					String(row.median_days),
					String(row.p90_days),
					String(row.resolved)
				]);
			}
		}
		for (const bucket of stats.histogram) {
			rows.push([
				'days_without_chair',
				`${bucket.min}-${bucket.max ?? ''}`,
				bucket.label,
				String(bucket.reports),
				'',
				'',
				''
			]);
		}
		return (
			rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n') +
			'\n'
		);
	}

	function download() {
		downloadBlob(
			new Blob([csv()], { type: 'text/csv;charset=utf-8' }),
			`rollfix-delay-data-${stats.generated_at.slice(0, 10)}.csv`
		);
	}

	const maxMedian = (rows: Group[]) => Math.max(1, ...rows.map((row) => row.median_days));
</script>

<section aria-labelledby="headline-heading" class="headline">
	<h2 id="headline-heading" class="visually-hidden">Headline numbers</h2>
	<div class="hero">
		<p class="hero-label">Median days without a chair</p>
		<p class="hero-value" data-testid="median-days">{days(o.median_days)}</p>
		<p class="muted">Half of the repairs shared took longer than this.</p>
	</div>
	<ul class="tiles">
		<li class="card tile">
			<span class="tile-label">Repairs shared</span>
			<span class="tile-value">{number.format(o.reports)}</span>
			<span class="small muted">{number.format(o.ongoing)} still waiting</span>
		</li>
		<li class="card tile">
			<span class="tile-label">Took more than 30 days</span>
			<span class="tile-value">{percent(o.over_30_days, o.reports)}</span>
			<span class="small muted">1 in 10 took {days(o.p90_days)}+ days</span>
		</li>
		<li class="card tile">
			<span class="tile-label">Waiting for insurance</span>
			<span class="tile-value">{days(o.median_days_waiting_approval)}</span>
			<span class="small muted">median days, where logged</span>
		</li>
		<li class="card tile">
			<span class="tile-label">Missed a state deadline</span>
			<span class="tile-value">{percent(o.state_deadline_missed, o.state_deadline_checked)}</span>
			<span class="small muted">
				of {number.format(o.state_deadline_checked)} repairs a state law covered
			</span>
		</li>
	</ul>
</section>

{#if stats.histogram.length > 0}
	<section aria-labelledby="histogram-heading" class="card chart-card">
		<h2 id="histogram-heading">How long people were without their chair</h2>
		<p class="muted small">Number of repairs, by days without the chair</p>
		<div class="chart" role="presentation">
			<svg
				viewBox="0 0 {W} {H}"
				role="img"
				aria-label="Column chart of repairs by days without the chair. The most common range is {tallest.label}, with {tallest.reports} repairs. The same numbers are in the table below."
				onpointerleave={() => (hover = null)}
			>
				{#each ticks as tick (tick)}
					{@const y = pad.top + innerH - (tick / yMax) * innerH}
					<line class="grid" x1={pad.left} x2={W - pad.right} y1={y} y2={y} />
					<text class="tick" x={pad.left - 8} {y} dy="0.32em" text-anchor="end">
						{number.format(tick)}
					</text>
				{/each}
				{#each stats.histogram as bucket, index (bucket.label)}
					{@const height = (bucket.reports / yMax) * innerH}
					{@const cx = pad.left + band * index + band / 2}
					{@const y = pad.top + innerH - height}
					<g
						class="bar"
						class:active={hover?.bucket === bucket}
						onpointermove={() => (hover = { bucket, x: cx, y })}
						role="presentation"
					>
						<rect
							class="hit"
							x={pad.left + band * index}
							y={pad.top}
							width={band}
							height={innerH}
						/>
						<path class="mark" d={barPath(cx - barWidth / 2, y, barWidth, height)} />
					</g>
					{#if bucket === tallest}
						<text class="value" x={cx} y={y - 6} text-anchor="middle">
							{number.format(bucket.reports)}
						</text>
					{/if}
					<text class="tick" x={cx} y={H - pad.bottom + 18} text-anchor="middle">
						{bucket.label}
					</text>
				{/each}
				<line
					class="axis"
					x1={pad.left}
					x2={W - pad.right}
					y1={pad.top + innerH}
					y2={pad.top + innerH}
				/>
				<text class="tick" x={pad.left + innerW / 2} y={H - 6} text-anchor="middle">
					Days without the chair
				</text>
			</svg>
			{#if hover}
				<div
					class="tooltip"
					style="left: {(hover.x / W) * 100}%; top: {(hover.y / H) * 100}%"
					aria-hidden="true"
				>
					<strong>{number.format(hover.bucket.reports)} repairs</strong>
					<span>{hover.bucket.label} days</span>
				</div>
			{/if}
		</div>
		<details>
			<summary>Show as a table</summary>
			<table>
				<caption class="visually-hidden">Repairs by days without the chair</caption>
				<thead>
					<tr>
						<th scope="col">Days without the chair</th><th scope="col" class="number">Repairs</th>
					</tr>
				</thead>
				<tbody>
					{#each stats.histogram as bucket (bucket.label)}
						<tr><td>{bucket.label}</td><td class="number">{number.format(bucket.reports)}</td></tr>
					{/each}
				</tbody>
			</table>
		</details>
	</section>
{/if}

<div class="groups">
	{#each groups as group (group.id)}
		<section class="card" aria-labelledby="group-{group.id}">
			<h2 id="group-{group.id}">{group.title}</h2>
			{#if group.rows.length === 0}
				<p class="muted">Not enough reports yet to show this safely.</p>
			{:else}
				{@const max = maxMedian(group.rows)}
				<!-- A scrollable region must be focusable so keyboard users can scroll it (WCAG 2.1.1). -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class="table-scroll"
					tabindex="0"
					role="region"
					aria-label="{group.title}, scrollable table"
				>
					<table data-testid="group-{group.id}">
						<caption class="visually-hidden">
							Median days without a chair, {group.title.toLowerCase()}
						</caption>
						<thead>
							<tr>
								<th scope="col">
									{group.title.replace('By ', '').replace(/^./, (c) => c.toUpperCase())}
								</th>
								<th scope="col" class="number">Repairs</th>
								<th scope="col">Median days without the chair</th>
							</tr>
						</thead>
						<tbody>
							{#each group.rows as row (row.key)}
								<tr>
									<th scope="row">{group.label(row.key)}</th>
									<td class="number">{number.format(row.reports)}</td>
									<td>
										<span class="meter">
											<span class="meter-bar" style="width: {(row.median_days / max) * 100}%"
											></span>
										</span>
										<span class="meter-value">{days(row.median_days)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/each}
</div>

<p class="small muted">
	Updated {new Date(stats.generated_at).toLocaleString('en-US', {
		dateStyle: 'long',
		timeStyle: 'short'
	})}. Groups with fewer than {stats.min_group_size} repairs are hidden to protect privacy{#if stats.suppressed_groups > 0}
		({stats.suppressed_groups} hidden){/if}. These are repairs people chose to share, not a random
	sample.
</p>
<p>
	<button class="button secondary" type="button" onclick={download}>
		<Icon name="download" /> Download the numbers (CSV)
	</button>
</p>

<style>
	.headline {
		display: grid;
		gap: 1.5rem;
		align-items: end;
		margin-top: 1rem;
	}

	@media (min-width: 60rem) {
		.headline {
			grid-template-columns: minmax(16rem, 1fr) 2fr;
		}
	}

	.hero-label {
		margin: 0;
		font-weight: 650;
	}

	.hero-value {
		margin: 0;
		font-size: clamp(4rem, 3rem + 5vw, 6.5rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--text);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		gap: 0.75rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	@media (min-width: 60rem) {
		.tiles {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.tile {
		display: grid;
		gap: 0.15rem;
		padding: 1rem;
	}

	.tile-label {
		font-weight: 650;
		font-size: 0.95rem;
	}

	.tile-value {
		font-size: 2rem;
		font-weight: 650;
		line-height: 1.1;
	}

	.chart-card {
		margin-top: 2rem;
	}

	.chart {
		position: relative;
		max-width: 46rem;
	}

	svg {
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.grid,
	.axis {
		stroke: var(--border);
		stroke-width: 1;
	}

	.axis {
		stroke: var(--border-strong);
	}

	.tick {
		fill: var(--muted);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.value {
		fill: var(--text);
		font-size: 13px;
		font-weight: 650;
	}

	.mark {
		fill: var(--chart-1);
	}

	.hit {
		fill: transparent;
	}

	.bar.active .mark {
		fill: var(--chart-1-hover);
	}

	.tooltip {
		position: absolute;
		transform: translate(-50%, calc(-100% - 10px));
		display: grid;
		padding: 0.4rem 0.65rem;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow);
		font-size: 0.9rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.tooltip span {
		color: var(--muted);
	}

	.groups {
		display: grid;
		gap: 1.25rem;
		margin-block: 2rem;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
	}

	.groups section {
		margin: 0;
	}

	tbody th {
		font-weight: 500;
	}

	td:last-child {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 10rem;
	}

	.meter {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		background: var(--chart-track);
		overflow: hidden;
	}

	.meter-bar {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--chart-1);
	}

	.meter-value {
		min-width: 2.5rem;
		text-align: end;
		font-variant-numeric: tabular-nums;
		font-weight: 650;
	}

	@media (forced-colors: active) {
		.mark,
		.meter-bar {
			fill: CanvasText;
			background: CanvasText;
		}
	}
</style>
