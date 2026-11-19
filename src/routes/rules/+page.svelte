<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import { FEDERAL, STATE_PROFILES, US_STATES } from '#lib/content.ts';
	import { lawInForce } from '#lib/engine/rules.ts';
	import { paths } from '#lib/paths.ts';
	import { app } from '#lib/store/app.svelte.ts';

	let choice = $state('');
	$effect(() => {
		if (!choice && app.profile.state) choice = app.profile.state;
	});

	function status(code: string): { label: string; tone: string } {
		const profile = STATE_PROFILES.find((item) => item.id === code);
		if (!profile || profile.laws.length === 0) return { label: 'No specific law yet', tone: '' };
		if (
			profile.laws.some(
				(law) => lawInForce(law, app.today) && profile.deadlines.some((d) => d.law === law.id)
			)
		)
			return { label: 'Repair deadlines in force', tone: 'success' };
		if (profile.laws.some((law) => lawInForce(law, app.today)))
			return { label: 'Repair law in force', tone: 'success' };
		if (profile.laws.some((law) => law.status === 'enacted'))
			return { label: 'Law passed, not yet in effect', tone: 'warning' };
		return { label: 'Bill pending', tone: 'info' };
	}

	function go(event: SubmitEvent) {
		event.preventDefault();
		if (choice) void goto(paths.state(choice));
	}
</script>

<svelte:head>
	<title>State repair rules · Rollfix</title>
	<meta
		name="description"
		content="Which U.S. states have power wheelchair repair laws, what they require, and where to complain."
	/>
</svelte:head>

<div class="container page">
	<div class="reading">
		<h1>State repair rules</h1>
		<p class="lead">
			A few states now have laws about power wheelchair repairs: who must supply parts, and in some
			states, how fast repairs must happen. Every rule here links to the law itself.
		</p>
		<form class="picker" onsubmit={go}>
			<label for="state-picker">Find your state</label>
			<div class="row">
				<select id="state-picker" bind:value={choice}>
					<option value="">Choose a state</option>
					{#each US_STATES as state (state.code)}<option value={state.code}>
							{state.name}
						</option>{/each}
				</select>
				<button class="button" type="submit">Show the rules</button>
			</div>
		</form>
	</div>

	<section aria-labelledby="profiles-heading">
		<h2 id="profiles-heading">States with wheelchair repair laws</h2>
		<ul class="grid" style="--min: 18rem">
			{#each STATE_PROFILES as profile (profile.id)}
				{@const s = status(profile.id)}
				<li class="card">
					<h3><a href={paths.state(profile.id)}>{profile.name}</a></h3>
					<p><span class="badge {s.tone}">{s.label}</span></p>
					<p class="small">{profile.summary}</p>
				</li>
			{/each}
			<li class="card">
				<h3><a href={paths.state('medicare')}>Medicare (federal)</a></h3>
				<p><span class="badge info">Everywhere in the U.S.</span></p>
				<p class="small">{FEDERAL.summary}</p>
			</li>
		</ul>
	</section>

	<div class="notice reading">
		<p>
			<Icon name="info" /> Live somewhere else? You can still log your repair and send letters. Pick your
			state above to see where to complain there. Medicare rules apply everywhere.
		</p>
	</div>
</div>

<style>
	.picker {
		margin-block: 1.5rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.row select {
		flex: 1 1 14rem;
		width: auto;
	}

	.grid h3 a {
		text-decoration: none;
	}

	.grid h3 a:hover {
		text-decoration: underline;
	}
</style>
