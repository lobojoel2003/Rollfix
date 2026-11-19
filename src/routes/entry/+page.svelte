<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import EntryForm from '#lib/components/EntryForm.svelte';
	import { ENTRY_KINDS, type EntryKind } from '#lib/engine/model.ts';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	const params = $derived(browser ? page.url.searchParams : null);
	const repair = $derived(app.repair(params?.get('repair')));
	const entry = $derived(repair?.entries.find((item) => item.id === params?.get('entry')));
	const kind = $derived.by(() => {
		const value = params?.get('kind');
		return value && (ENTRY_KINDS as readonly string[]).includes(value)
			? (value as EntryKind)
			: null;
	});
	const heading = $derived(entry ? 'Edit timeline entry' : 'Add to the timeline');
</script>

<svelte:head>
	<title>{heading} · Rollfix</title>
</svelte:head>

<div class="container page">
	<h1>{heading}</h1>
	{#if !app.ready}
		<p aria-busy="true">Loading…</p>
	{:else if repair && (entry || !params?.get('entry'))}
		{#key `${repair.id}:${entry?.id ?? 'new'}:${kind}`}
			<EntryForm {repair} {entry} {kind} />
		{/key}
	{:else}
		<p>We couldn’t find that on this device. <a href={paths.home()}>Go to your repair log</a>.</p>
	{/if}
</div>
