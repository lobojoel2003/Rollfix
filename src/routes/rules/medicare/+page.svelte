<script lang="ts">
	import JurisdictionDetails from '#lib/components/JurisdictionDetails.svelte';
	import { FEDERAL } from '#lib/content.ts';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';
</script>

<svelte:head>
	<title>Medicare wheelchair repair rules · Rollfix</title>
	<meta
		name="description"
		content="Federal Medicare rules for power wheelchair repairs and where to complain."
	/>
</svelte:head>

<div class="container page reading">
	<p><a href={paths.rules()}>← All states</a></p>
	<h1>Medicare (federal rules)</h1>
	<JurisdictionDetails jurisdiction={FEDERAL} today={app.today} />
</div>
