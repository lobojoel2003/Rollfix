<script lang="ts">
	import '../app.css';
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import Flash from '#lib/components/Flash.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import { app } from '#lib/store/app.svelte.ts';

	let { children } = $props();

	onMount(() => {
		void app.init();
	});

	afterNavigate(() => {
		app.navigated();
		void focusTarget();
	});

	// Larger text, chosen in Settings.
	$effect(() => {
		document.documentElement.dataset.textSize = app.settings.textSize;
	});

	// After saving, move focus to what changed (a new timeline entry, a heading), so keyboard,
	// switch and screen reader users land where they need to be.
	async function focusTarget() {
		const target = app.focusTarget;
		if (!target) return;
		await tick();
		const element = document.getElementById(target);
		if (!element) return;
		app.focusTarget = null;
		if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
		element.focus();
		element.scrollIntoView({ block: 'center' });
	}

	// Same-page changes (no navigation): focus once the page has re-rendered.
	$effect(() => {
		if (app.ready && app.focusTarget) void focusTarget();
	});
</script>

<a class="skip-link" href="#main">Skip to main content</a>
<SiteHeader />
<main id="main" tabindex="-1">
	<div class="container">
		<noscript>
			<div class="notice warning" style="margin-top: 1rem">
				<p>
					Rollfix needs JavaScript to keep your log on this device. Please turn it on, or open
					Rollfix in another browser.
				</p>
			</div>
		</noscript>
		{#if app.ready && !app.persistent}
			<div class="notice warning" style="margin-top: 1rem" data-testid="storage-warning">
				<p>
					This browser won't let Rollfix save your log, so it will be gone when you close this tab.
					Private browsing often does this. Download a backup from Settings before you leave.
				</p>
			</div>
		{/if}
		<Flash />
	</div>
	{@render children()}
</main>
<SiteFooter />
