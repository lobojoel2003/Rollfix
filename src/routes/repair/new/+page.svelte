<script lang="ts">
	import RepairForm from '#lib/components/RepairForm.svelte';
	import { app } from '#lib/store/app.svelte.ts';
</script>

<svelte:head>
	<title>Start a repair log · Rollfix</title>
</svelte:head>

<div class="container page">
	<h1>Start a repair log</h1>
	<p class="lead reading">
		Only the date it broke is required. Add the rest now or later: the more you fill in, the more
		complete your letters will be.
	</p>
	{#if app.ready}
		<RepairForm />
	{:else}
		<p aria-busy="true">Loading…</p>
	{/if}
</div>
