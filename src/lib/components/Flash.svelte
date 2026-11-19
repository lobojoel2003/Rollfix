<script lang="ts">
	import { app } from '../store/app.svelte.ts';
	import Icon from './Icon.svelte';
</script>

<!-- Confirmation after saving. A live region, so screen readers announce it too. -->
<div class="flash-region" role="status" aria-live="polite">
	{#if app.flash}
		<div class="notice {app.flash.tone} flash">
			<p>
				<Icon name={app.flash.tone === 'warning' ? 'alert' : 'check'} />
				<span>{app.flash.message}</span>
			</p>
			<button class="button quiet" type="button" onclick={() => (app.flash = null)}>
				Dismiss
			</button>
		</div>
	{/if}
</div>

<style>
	.flash {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin-top: 1rem;
		padding-block: 0.35rem;
	}

	.flash p {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		margin: 0;
		font-weight: 600;
	}
</style>
