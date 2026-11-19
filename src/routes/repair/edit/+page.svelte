<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import RepairForm from '#lib/components/RepairForm.svelte';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	const id = $derived(browser ? page.url.searchParams.get('id') : null);
	const repair = $derived(app.repair(id));
</script>

<svelte:head>
	<title>Edit repair details · Rollfix</title>
</svelte:head>

<div class="container page">
	<h1>Edit repair details</h1>
	{#if !app.ready}
		<p aria-busy="true">Loading…</p>
	{:else if repair}
		{#key repair.id}
			<RepairForm {repair} />
		{/key}
	{:else}
		<p>
			We couldn’t find that repair on this device. <a href={paths.home()}>Go to your repair log</a>.
		</p>
	{/if}
</div>
