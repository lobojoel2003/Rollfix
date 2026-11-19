<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import LetterBuilder from '#lib/components/LetterBuilder.svelte';
	import { RECIPIENTS, type Recipient } from '#lib/engine/schema.ts';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	const params = $derived(browser ? page.url.searchParams : null);
	const repair = $derived(app.repair(params?.get('repair')) ?? app.current ?? app.all[0]);
	const to = $derived.by(() => {
		const value = params?.get('to');
		return value && (RECIPIENTS as readonly string[]).includes(value)
			? (value as Recipient)
			: undefined;
	});
</script>

<svelte:head>
	<title>Write a letter · Rollfix</title>
</svelte:head>

<div class="container page">
	<div class="reading no-print">
		<h1>Write a letter</h1>
		<p class="lead">
			Rollfix turns your timeline into a dated, polite and firm letter, with your state’s rules and
			the full timeline attached. Pick who it’s for, check it, and send it.
		</p>
	</div>
	{#if !app.ready}
		<p aria-busy="true">Loading…</p>
	{:else if repair}
		{#if app.all.length > 1}
			<nav class="no-print" aria-label="Choose a repair">
				<p class="small muted">
					Writing about the repair that started {repair.brokeOn}.
					{#if repair.id !== app.current?.id && app.current}
						<a href={paths.letters(app.current.id)}>Switch to the current repair</a>
					{/if}
				</p>
			</nav>
		{/if}
		{#key `${repair.id}:${to}`}
			<LetterBuilder {repair} {to} />
		{/key}
	{:else}
		<div class="notice info reading">
			<p>Start a repair log first. Your letters are built from it.</p>
			<p><a class="button" href={paths.newRepair()}><Icon name="plus" /> Start a repair log</a></p>
		</div>
	{/if}
</div>
