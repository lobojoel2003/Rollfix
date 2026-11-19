<script lang="ts">
	import { page } from '$app/state';
	import { paths } from '#lib/paths.ts';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · Rollfix</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="container page reading error">
	<p class="code">{page.status}</p>
	<h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
	<p class="lead">
		{notFound
			? 'That page doesn’t exist. Your repair log is safe on this device.'
			: 'Sorry, something broke. Your repair log is safe on this device. Try reloading the page.'}
	</p>
	<p><a class="button" href={paths.home()}>Go to my repair log</a></p>
</div>

<style>
	.error {
		padding-block: 4rem;
	}

	.code {
		font-size: 3rem;
		font-weight: 800;
		color: var(--muted);
		margin: 0;
	}
</style>
