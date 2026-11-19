<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import ShareRepair from '#lib/components/ShareRepair.svelte';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';
	import { STATS_API } from '#lib/stats/client.ts';

	const shareable = $derived(app.all.filter((repair) => !repair.id.startsWith('sample-')));
</script>

<svelte:head>
	<title>Share your delay numbers · Rollfix</title>
</svelte:head>

<div class="container page reading">
	<p><a href={paths.data()}>← Delay data</a></p>
	<h1>Share your delay numbers</h1>
	<p class="lead">
		States are passing repair laws, but nobody is collecting the proof. If you choose to, Rollfix
		can send advocates the numbers from your log, and nothing else.
	</p>
	<ul class="facts-list">
		<li>
			<Icon name="lock" /> No name, address, notes, phone numbers or exact dates. Just counts of days
			and a few categories.
		</li>
		<li><Icon name="check" /> You see exactly what is sent before you send it.</li>
		<li><Icon name="trash" /> You can update or remove your numbers at any time from this page.</li>
		<li><Icon name="chart" /> Groups smaller than 5 people are never shown on the dashboard.</li>
	</ul>

	{#if !STATS_API}
		<div class="notice warning" data-testid="no-stats-api">
			<p>
				<strong>Sharing isn’t switched on in this copy of Rollfix.</strong> It needs a stats server, which
				whoever runs this site hasn’t connected. Everything else works.
			</p>
			<p class="small">
				Running Rollfix yourself? See <a
					href="https://github.com/lobojoel2003/Rollfix#anonymous-stats-api"
					rel="external noopener"
				>
					how to connect the stats API
				</a>.
			</p>
		</div>
	{:else if !app.ready}
		<p aria-busy="true">Loading…</p>
	{:else if shareable.length === 0}
		<div class="notice info">
			<p>You don’t have a repair log to share yet.</p>
			<p><a class="button" href={paths.newRepair()}><Icon name="plus" /> Start a repair log</a></p>
		</div>
	{:else}
		<p class="small muted">Sent to {new URL(STATS_API).host}.</p>
		<div class="stack">
			{#each shareable as repair (repair.id)}
				<ShareRepair {repair} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.facts-list {
		display: grid;
		gap: 0.5rem;
		padding: 0;
		list-style: none;
		margin-block: 1.5rem 2rem;
	}

	.facts-list li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
	}

	.stack {
		display: grid;
		gap: 1.5rem;
	}
</style>
