<script lang="ts">
	import { paths, REPOSITORY, RULES_GUIDE } from '#lib/paths.ts';

	const build = __ROLLFIX_BUILD__;
</script>

<svelte:head>
	<title>About Rollfix</title>
	<meta
		name="description"
		content="Why Rollfix exists, how it protects your privacy, and how it works with keyboards, switches and screen readers."
	/>
</svelte:head>

<div class="container page reading">
	<h1>About Rollfix</h1>
	<p class="lead">
		When a power wheelchair breaks, the person who uses it can be stuck at home, or in bed, for
		weeks while the supplier waits on insurance and parts. Rollfix is a free tool to keep the
		record, know the rules, and push back.
	</p>

	<section aria-labelledby="why-heading">
		<h2 id="why-heading">Why it exists</h2>
		<ul class="evidence">
			<li>
				In Connecticut, in-home wheelchair repairs took more than 49 days on average (<a
					href="https://ctmirror.org/2024/03/12/ct-wheelchair-repair-delays-bill/"
					rel="external noopener"
				>
					CT Mirror, 2024
				</a>), and in November 2023 the state’s two main suppliers had 740 and 687 open service
				orders (<a
					href="https://www.cga.ct.gov/hs/tfs/20230727_Wheelchair%20Repair%20Task%20Force/Final%20Report/SA%2023-22%20Wheelchair%20Repair%20Task%20Force%20Final%20Report.pdf"
					rel="external noopener"
				>
					Connecticut Wheelchair Repair Task Force, 2024
				</a>).
			</li>
			<li>
				In a study of 591 wheelchair users with spinal cord injury, 64% needed at least one repair
				in six months. Among people harmed by a breakdown, 27% were stranded inside their home and
				12% were stuck in bed (<a
					href="https://www.health.harvard.edu/blog/millions-rely-on-wheelchairs-for-mobility-but-repair-delays-are-hurting-users-202207212785"
					rel="external noopener"
				>
					Harvard Health Publishing, 2022
				</a>).
			</li>
			<li>
				Colorado passed the first powered-wheelchair right-to-repair law in 2022, and Connecticut
				now sets a 10-business-day repair deadline. States are passing repair laws, but nobody is
				collecting the proof. Advocacy groups such as
				<a href="https://pirg.org/iowa/resources/stranded/" rel="external noopener">PIRG</a> publish reports
				on the problem; people in wheelchairs had no tool of their own.
			</li>
		</ul>
	</section>

	<section aria-labelledby="privacy-heading">
		<h2 id="privacy-heading">Privacy</h2>
		<ul>
			<li>
				Your log is stored in this browser on this device (IndexedDB). There is no account and no
				server copy.
			</li>
			<li>
				No analytics, no trackers, no cookies, no third-party scripts or fonts. A strict Content
				Security Policy enforces it.
			</li>
			<li>Letters and PDFs are made on your device.</li>
			<li>
				Sharing delay numbers is off until you choose it, per repair. You see exactly what is sent
				first: counts of days and a few categories, never names, notes or exact dates. You can
				remove them at any time. <a href={paths.share()}>Learn more</a>.
			</li>
			<li>
				Because the log is only on this device, <a href={paths.settings()}>download a backup</a> now and
				then.
			</li>
		</ul>
	</section>

	<section aria-labelledby="a11y-heading">
		<h2 id="a11y-heading">Accessibility</h2>
		<p>
			Rollfix is built for the people who use it, so it aims to meet <a
				href="https://www.w3.org/TR/WCAG22/"
				rel="external noopener"
			>
				WCAG 2.2
			</a> level AA and goes further where it matters:
		</p>
		<ul>
			<li>
				<strong>Keyboard and switch access.</strong> Every action is a real button or link in a simple,
				linear order. No drag and drop, no hover-only controls, no time limits. Targets are at least 48
				pixels.
			</li>
			<li>
				<strong>Screen readers.</strong> Proper headings and landmarks, labelled form fields, error summaries
				that link to the field, and spoken confirmations after you save.
			</li>
			<li>
				<strong>Few steps.</strong> Quick-add buttons for the most common entries, and letters that fill
				themselves in from your log.
			</li>
			<li>
				<strong>Seeing.</strong> High contrast, dark mode, a text size setting, and layouts that hold
				up at 400% zoom. Windows High Contrast is supported.
			</li>
			<li><strong>Voice control.</strong> Visible labels match the names voice software uses.</li>
		</ul>
		<p>
			Every page is tested automatically with <a
				href="https://github.com/dequelabs/axe-core"
				rel="external noopener"
			>
				axe
			</a>
			and with keyboard-only runs. If something doesn’t work for you, please
			<a href="{REPOSITORY}/issues" rel="external noopener">tell us</a>.
		</p>
	</section>

	<section aria-labelledby="legal-heading">
		<h2 id="legal-heading">Not legal advice</h2>
		<p>
			Rollfix explains state and federal rules in plain language and does the date math, but it
			can’t know everything about your situation, and laws change. Each state page says when the
			rules were last checked and links to the law itself. For advice about your case, contact your
			state’s Protection and Advocacy organization (<a
				href="https://www.ndrn.org/about/ndrn-member-agencies/"
				rel="external noopener"
			>
				find yours
			</a>) or a lawyer.
		</p>
	</section>

	<section aria-labelledby="open-heading">
		<h2 id="open-heading">Open source</h2>
		<p>
			Rollfix is free software (<a href="{REPOSITORY}/blob/main/LICENSE" rel="external noopener">
				AGPL-3.0
			</a>). The state rules are plain YAML files with citations, licensed CC BY 4.0, so advocates
			and volunteers can add their state: see the
			<a href={RULES_GUIDE} rel="external noopener">rules guide</a>. The letter engine comes from
			<a href="https://github.com/lobojoel2003/Tenantkit" rel="external noopener">Tenantkit</a>.
		</p>
		<p class="small muted">
			Version {build.version}, build {build.buildNumber} ({build.commit}), built {build.date}.
		</p>
	</section>
</div>

<style>
	.evidence li + li,
	ul li + li {
		margin-top: 0.5rem;
	}
</style>
