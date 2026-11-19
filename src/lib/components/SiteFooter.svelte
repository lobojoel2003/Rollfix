<script lang="ts">
	import { ISSUES, paths, REPOSITORY } from '../paths.ts';
	import Icon from './Icon.svelte';

	const build = __ROLLFIX_BUILD__;
</script>

<footer class="site">
	<div class="container">
		<p><Icon name="lock" /> Your log stays on this device. No account, no tracking, no cookies.</p>
		<p>
			<Icon name="law" /> Rollfix helps you write things down and explains the rules in plain language.
			It is not legal advice.
		</p>
		<ul class="links">
			<li><a href={paths.about()}>About, privacy and accessibility</a></li>
			<li><a href={REPOSITORY} rel="external noopener">Source code</a></li>
			<li><a href={ISSUES} rel="external noopener">Report a problem</a></li>
		</ul>
		<p class="meta" data-testid="build-info">
			Rollfix {build.version} · build {build.buildNumber} · {build.commit}. Code AGPL-3.0, rules CC
			BY 4.0.
		</p>
	</div>
</footer>

<style>
	footer {
		margin-top: 4rem;
		padding-block: 2rem 2.5rem;
		background: var(--surface);
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
	}

	p {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		max-width: var(--reading);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.5rem;
		padding: 0;
		list-style: none;
		font-weight: 600;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		min-height: var(--target);
	}

	.meta {
		display: block;
		color: var(--muted);
		font-size: 0.88rem;
		margin: 0;
	}
</style>
