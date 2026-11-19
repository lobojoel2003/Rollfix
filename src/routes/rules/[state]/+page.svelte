<script lang="ts">
	import JurisdictionDetails from '#lib/components/JurisdictionDetails.svelte';
	import { profileFor } from '#lib/content.ts';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	let { data } = $props();
	const profile = $derived(profileFor(data.code));
</script>

<svelte:head>
	<title>{data.name} wheelchair repair rules · Rollfix</title>
	<meta
		name="description"
		content="Power wheelchair repair rules in {data.name}: laws, deadlines and where to complain."
	/>
</svelte:head>

<div class="container page reading">
	<p><a href={paths.rules()}>← All states</a></p>
	<h1>{data.name}</h1>
	{#if profile}
		<JurisdictionDetails jurisdiction={profile} today={app.today} />
	{:else}
		<p class="lead">
			Rollfix doesn’t know of a law in {data.name} that is specific to wheelchair repairs yet. You still
			have options.
		</p>
		<ul class="options">
			<li>
				<strong>Keep the log.</strong> A dated record of every call and promise is the strongest thing
				you can bring to a complaint, an appeal or your legislator.
			</li>
			<li>
				<strong>Write to the supplier and your insurer.</strong> Rollfix’s letters work in every state.
			</li>
			<li>
				<strong>Complain to your attorney general.</strong> Every state has a consumer protection
				office.
				<a href="https://www.naag.org/find-my-ag/" rel="external noopener">
					Find your attorney general
				</a>.
			</li>
			<li>
				<strong>Complain to your insurance regulator</strong> if a private or employer plan is slow
				to approve a repair.
				<a href="https://content.naic.org/state-insurance-departments" rel="external noopener">
					Find your state insurance department
				</a>.
			</li>
			<li>
				<strong>Have Medicare?</strong> Federal supplier rules apply everywhere.
				<a href={paths.state('medicare')}>Read the Medicare rules</a>.
			</li>
		</ul>
		<div class="notice">
			<p>
				Know of a {data.name} law or bill about wheelchair repairs?
				<a href="https://github.com/lobojoel2003/Rollfix/issues" rel="external noopener">
					Tell us
				</a>, and we’ll add it.
			</p>
		</div>
	{/if}
</div>

<style>
	.options li + li {
		margin-top: 0.75rem;
	}
</style>
