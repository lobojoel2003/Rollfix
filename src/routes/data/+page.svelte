<script lang="ts">
	import { onMount } from 'svelte';
	import Dashboard from '#lib/components/Dashboard.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { paths } from '#lib/paths.ts';
	import { fetchStats, STATS_API, StatsError, type Stats } from '#lib/stats/client.ts';

	let stats = $state<Stats | null>(null);
	let failure = $state('');
	let loading = $state(!!STATS_API);

	async function load() {
		loading = true;
		failure = '';
		try {
			stats = await fetchStats();
		} catch (error) {
			failure = error instanceof StatsError ? error.message : 'Could not load the numbers.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (STATS_API) void load();
	});
</script>

<svelte:head>
	<title>Wheelchair repair delay data · Rollfix</title>
	<meta
		name="description"
		content="How long power wheelchair users wait for repairs, from anonymous numbers shared with Rollfix."
	/>
</svelte:head>

<div class="container page">
	<div class="reading">
		<h1>Wheelchair repair delays</h1>
		<p class="lead">
			Anonymous numbers from people who log their repairs with Rollfix and chose to share them. For
			advocates, journalists and lawmakers.
		</p>
		<p class="button-row">
			<a class="button" href={paths.share()}><Icon name="share" /> Share your numbers</a>
		</p>
	</div>

	{#if !STATS_API}
		<div class="notice warning reading" data-testid="no-stats-api">
			<p>
				<strong>The public dashboard isn’t connected in this copy of Rollfix.</strong> It needs the Rollfix
				stats server, which whoever runs this site hasn’t set up.
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
	{:else if loading && !stats}
		<p aria-busy="true">Loading the latest numbers…</p>
	{:else if failure}
		<div class="notice danger reading" role="alert">
			<p>{failure}</p>
			<p><button class="button secondary" type="button" onclick={load}>Try again</button></p>
		</div>
	{:else if stats && stats.overall.reports < stats.min_group_size}
		<div class="notice info reading">
			<p>
				Fewer than {stats.min_group_size} repairs have been shared so far, so there is nothing to show
				yet without risking anyone’s privacy. Be one of the first.
			</p>
		</div>
	{:else if stats}
		<Dashboard {stats} />
	{/if}

	<section class="reading" aria-labelledby="method-heading">
		<h2 id="method-heading">How these numbers are made</h2>
		<ul>
			<li>
				Each repair counts once. People can update their numbers when the chair is fixed, or remove
				them.
			</li>
			<li>
				“Days without a chair” runs from the day the chair stopped working to the day it was fixed,
				or to today if it is still waiting.
			</li>
			<li>
				No names, notes, addresses or exact dates are collected; the month the chair broke is the
				finest date kept. The server does not store IP addresses.
			</li>
			<li>Any group with fewer than 5 repairs is left out.</li>
			<li>
				People who chose to share are not a random sample, so treat the numbers as evidence of a
				problem, not a precise rate.
			</li>
		</ul>
	</section>
</div>
