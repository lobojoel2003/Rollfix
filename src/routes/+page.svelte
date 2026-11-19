<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { headline } from '#lib/engine/clock.ts';
	import RepairList from '#lib/components/RepairList.svelte';
	import RepairView from '#lib/components/RepairView.svelte';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	const past = $derived(app.all.filter((repair) => repair.id !== app.current?.id));
	let loadingSample = $state(false);

	async function trySample() {
		loadingSample = true;
		await app.loadSample();
		loadingSample = false;
		app.notify('Sample data loaded. Remove it any time with the button below.');
		app.focusTarget = 'day-counter';
	}
</script>

<svelte:head>
	<title>{app.current ? `${headline(app.current, app.today).text} · ` : ''}Rollfix</title>
	<meta
		name="description"
		content="Rollfix counts the days without your power wheelchair, logs every call and promise, knows your state's repair rules and turns the timeline into a dated letter. Free, private, works offline."
	/>
</svelte:head>

<div class="container page">
	{#if !app.ready}
		<p class="loading" aria-busy="true">Loading your repair log…</p>
	{:else if app.current}
		<RepairView repair={app.current} />
		{#if past.length > 0}
			<section aria-labelledby="past-heading">
				<h2 id="past-heading">Earlier repairs</h2>
				<RepairList repairs={past} />
			</section>
		{/if}
	{:else}
		<section class="welcome" aria-labelledby="welcome-heading">
			{#if app.repairs.length > 0}
				<h1 id="welcome-heading" tabindex="-1">Your chair is working</h1>
				<p class="lead">
					If it breaks again, start a new log the same day. The count starts from the day it stopped
					working.
				</p>
			{:else}
				<h1 id="welcome-heading" tabindex="-1">When your chair breaks, keep the record.</h1>
				<p class="lead">
					Rollfix counts the days without your power wheelchair, keeps a timeline of every call and
					promise, knows your state’s repair rules, and turns it all into a dated letter to your
					supplier, your insurer or the state.
				</p>
			{/if}
			<div class="button-row">
				<a class="button big" href={paths.newRepair()}><Icon name="plus" /> Start a repair log</a>
				{#if app.repairs.length === 0}
					<button
						class="button big secondary"
						type="button"
						onclick={trySample}
						disabled={loadingSample}
					>
						Try it with sample data
					</button>
				{/if}
			</div>
			<ul class="promises">
				<li><Icon name="lock" /> Stays on this device. No account.</li>
				<li><Icon name="law" /> Cites your state’s repair law.</li>
				<li><Icon name="letter" /> Letters as PDF, ready to print or email.</li>
				<li><Icon name="chair" /> Works with keyboard, switch and screen reader.</li>
			</ul>
		</section>
		{#if app.repairs.length > 0}
			<section aria-labelledby="history-heading">
				<h2 id="history-heading">Past repairs</h2>
				<RepairList repairs={app.all} />
			</section>
		{/if}
	{/if}
</div>

<style>
	.loading {
		padding-block: 4rem;
		color: var(--muted);
	}

	.welcome {
		max-width: var(--reading);
		padding-block: 2rem 0;
	}

	.welcome h1 {
		font-size: clamp(2.2rem, 1.5rem + 3vw, 3.4rem);
	}

	.promises {
		display: grid;
		gap: 0.6rem;
		margin-top: 2rem;
		padding: 0;
		list-style: none;
		font-size: 1.05rem;
	}

	.promises li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
	}
</style>
