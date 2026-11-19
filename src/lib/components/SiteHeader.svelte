<script lang="ts">
	import { page } from '$app/state';
	import { paths } from '../paths.ts';
	import Icon, { type IconName } from './Icon.svelte';
	import Logo from './Logo.svelte';

	const links: { href: string; label: string; icon: IconName; match: (path: string) => boolean }[] =
		$derived([
			{
				href: paths.home(),
				label: 'My repair',
				icon: 'home',
				match: (path) => path === paths.home() || /\/(repair|entry)\//.test(path)
			},
			{
				href: paths.letters(),
				label: 'Letters',
				icon: 'letter',
				match: (p) => p.includes('/letters/')
			},
			{
				href: paths.rules(),
				label: 'State rules',
				icon: 'law',
				match: (p) => p.includes('/rules/')
			},
			{
				href: paths.data(),
				label: 'Delay data',
				icon: 'chart',
				match: (p) => p.includes('/data/') || p.includes('/share/')
			},
			{
				href: paths.settings(),
				label: 'Settings',
				icon: 'gear',
				match: (p) => p.includes('/settings/')
			}
		]);
	const current = $derived(page.url.pathname);
</script>

<header class="site">
	<div class="container bar">
		<a class="brand" href={paths.home()}>
			<Logo />
			<span>Rollfix</span>
		</a>
		<nav aria-label="Main">
			<ul>
				{#each links as link (link.href)}
					<li>
						<a href={link.href} aria-current={link.match(current) ? 'page' : undefined}>
							<Icon name={link.icon} />
							<span>{link.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
</header>

<style>
	header {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		padding-block: 0.6rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		min-height: var(--target);
		color: var(--text);
		font-weight: 800;
		font-size: 1.3rem;
		letter-spacing: -0.02em;
		text-decoration: none;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	nav a {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: var(--target);
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
		border: 2px solid transparent;
	}

	nav a:hover {
		background: var(--surface-2);
	}

	nav a[aria-current='page'] {
		background: var(--primary-soft);
		color: var(--primary);
		border-color: var(--primary);
	}
</style>
