<script lang="ts">
	let { size = 36 }: { size?: number } = $props();
</script>

<!-- The Rollfix mark: a wheel with a day counter tick. Decorative; the name is always next to it. -->
<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
	<rect width="64" height="64" rx="16" fill="var(--logo-bg, #2a3b9c)" />
	<circle cx="32" cy="32" r="19" fill="none" stroke="#fff" stroke-width="5" />
	<circle cx="32" cy="32" r="5" fill="#ffc46b" />
	<path
		d="M32 13v10M32 41v10M13 32h10M41 32h10"
		stroke="#fff"
		stroke-width="4"
		stroke-linecap="round"
	/>
</svg>
