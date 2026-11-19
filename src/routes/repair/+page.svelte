<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import RepairView from '#lib/components/RepairView.svelte';
	import { headline } from '#lib/engine/clock.ts';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	const id = $derived(browser ? page.url.searchParams.get('id') : null);
	const repair = $derived(app.repair(id));
</script>

<svelte:head>
	<title>{repair ? `${headline(repair, app.today).text} · ` : ''}Repair · Rollfix</title>
</svelte:head>

<div class="container page">
	<p class="no-print"><a href={paths.home()}>← Back to my repair log</a></p>
	{#if !app.ready}
		<p aria-busy="true">Loading…</p>
	{:else if repair}
		<RepairView {repair} />
	{:else}
		<h1>Repair not found</h1>
		<p>
			We couldn’t find that repair on this device. <a href={paths.home()}>Go to your repair log</a>.
		</p>
	{/if}
</div>
