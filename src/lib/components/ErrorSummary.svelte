<script lang="ts">
	import { tick } from 'svelte';

	let { errors, id = 'error-summary' }: { errors: Record<string, string>; id?: string } = $props();
	const list = $derived(Object.entries(errors));

	/** Call after a failed submit: moves focus to the summary so it is read out. */
	export async function focus() {
		await tick();
		document.getElementById(id)?.focus();
	}
</script>

{#if list.length > 0}
	<div class="notice danger" {id} tabindex="-1" role="group" aria-labelledby="{id}-title">
		<h2 id="{id}-title" class="title">
			{list.length === 1 ? 'There is 1 thing to fix' : `There are ${list.length} things to fix`}
		</h2>
		<ul>
			{#each list as [field, message] (field)}
				<li><a href="#{field}">{message}</a></li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.title {
		font-size: 1.15rem;
	}

	ul {
		margin: 0;
	}

	a {
		color: var(--danger);
		font-weight: 650;
	}
</style>
