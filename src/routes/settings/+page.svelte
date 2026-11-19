<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { formatDate } from '#lib/engine/civil-date.ts';
	import { US_STATES } from '#lib/engine/states.ts';
	import { downloadBlob } from '#lib/download.ts';
	import {
		backupToJson,
		BackupError,
		createBackup,
		parseBackup,
		type Backup
	} from '#lib/store/backup.ts';
	import { app } from '#lib/store/app.svelte.ts';
	import type { Settings } from '#lib/store/db.ts';

	let me = $state({ ...app.profile });
	let profileStatus = $state('');
	let backupStatus = $state('');
	let importError = $state('');
	let pending = $state<Backup | null>(null);
	let confirmClear = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		// Pick up the stored profile once it has loaded.
		if (app.ready && !me.name && app.profile.name) me = { ...app.profile };
	});

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		await app.saveProfile(me);
		profileStatus = 'Saved. These details go at the top of your letters.';
	}

	async function setTextSize(size: Settings['textSize']) {
		await app.saveSettings({ textSize: size });
	}

	async function exportBackup() {
		const backup = createBackup(app.profile, app.repairs);
		downloadBlob(
			new Blob([backupToJson(backup)], { type: 'application/json' }),
			`rollfix-backup-${app.today}.json`
		);
		await app.saveSettings({ lastBackup: new Date().toISOString() });
		backupStatus = `Backup downloaded with ${app.repairs.length} ${app.repairs.length === 1 ? 'repair' : 'repairs'}. Keep it somewhere safe.`;
	}

	async function chooseFile(event: Event) {
		importError = '';
		pending = null;
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (file.size > 5_000_000) {
			importError = 'That file is too big to be a Rollfix backup.';
			return;
		}
		try {
			pending = parseBackup(await file.text());
		} catch (error) {
			importError = error instanceof BackupError ? error.message : 'Could not read that file.';
		}
	}

	async function runImport(mode: 'merge' | 'replace') {
		if (!pending) return;
		const count = pending.repairs.length;
		await app.importBackup(pending, mode);
		me = { ...app.profile };
		pending = null;
		if (fileInput) fileInput.value = '';
		backupStatus = `Imported ${count} ${count === 1 ? 'repair' : 'repairs'}.`;
	}

	async function clearAll() {
		await app.clearAll();
		me = { ...app.profile };
		confirmClear = false;
		backupStatus = 'Everything was deleted from this device.';
	}
</script>

<svelte:head>
	<title>Settings · Rollfix</title>
</svelte:head>

<div class="container page reading">
	<h1>Settings</h1>

	<section aria-labelledby="me-heading">
		<h2 id="me-heading">Your details</h2>
		<p>Used at the top of your letters. They stay on this device.</p>
		<form onsubmit={saveProfile}>
			<div class="field">
				<label for="profile-name">Your name</label>
				<input id="profile-name" bind:value={me.name} autocomplete="name" />
			</div>
			<div class="field">
				<label for="profile-address">Your address</label>
				<span class="help" id="profile-address-help">
					One line per line, as it should appear on a letter.
				</span>
				<textarea
					id="profile-address"
					bind:value={me.address}
					rows="3"
					autocomplete="street-address"
					aria-describedby="profile-address-help"></textarea>
			</div>
			<div class="field">
				<label for="profile-phone">Phone</label>
				<input id="profile-phone" type="tel" bind:value={me.phone} autocomplete="tel" />
			</div>
			<div class="field">
				<label for="profile-email">Email</label>
				<input id="profile-email" type="email" bind:value={me.email} autocomplete="email" />
			</div>
			<div class="field">
				<label for="profile-state">State</label>
				<select id="profile-state" bind:value={me.state}>
					<option value="">Choose a state</option>
					{#each US_STATES as state (state.code)}<option value={state.code}>
							{state.name}
						</option>{/each}
				</select>
			</div>
			<p class="submit">
				<button class="button" type="submit"><Icon name="check" /> Save my details</button>
			</p>
			<p class="status" role="status" aria-live="polite">{profileStatus}</p>
		</form>
	</section>

	<section aria-labelledby="text-heading">
		<h2 id="text-heading">Text size</h2>
		<fieldset>
			<legend class="visually-hidden">Text size</legend>
			<div class="choices" style="--min: 10rem">
				{#each [['normal', 'Normal'], ['large', 'Large'], ['x-large', 'Extra large']] as [value, label] (value)}
					<label class="choice">
						<input
							type="radio"
							name="text-size"
							{value}
							checked={app.settings.textSize === value}
							onchange={() => setTextSize(value as Settings['textSize'])}
						/>
						<span>{label}</span>
					</label>
				{/each}
			</div>
		</fieldset>
		<p class="help">Your browser’s zoom works too, up to 400%.</p>
	</section>

	<section aria-labelledby="backup-heading">
		<h2 id="backup-heading">Backup</h2>
		<p>
			Your log lives only in this browser. If you clear your browsing data or lose this device, it’s
			gone. Download a backup now and then, or move your log to another device.
		</p>
		{#if app.settings.lastBackup}
			<p class="small muted">
				Last backup: {formatDate(app.settings.lastBackup.slice(0, 10), 'en-US', 'long')}.
			</p>
		{/if}
		<p class="button-row">
			<button class="button" type="button" onclick={exportBackup} disabled={!app.ready}>
				<Icon name="download" /> Download a backup
			</button>
		</p>
		<div class="field">
			<label for="import-file">Restore from a backup file</label>
			<span class="help" id="import-help">Choose a file named like rollfix-backup-….json.</span>
			<input
				id="import-file"
				type="file"
				accept="application/json,.json"
				bind:this={fileInput}
				onchange={chooseFile}
				aria-describedby="import-help{importError ? ' import-error' : ''}"
			/>
			{#if importError}<p class="error-text" id="import-error" role="alert">{importError}</p>{/if}
		</div>
		{#if pending}
			<div class="notice info" role="region" aria-label="Restore backup">
				<p>
					This backup has {pending.repairs.length}
					{pending.repairs.length === 1 ? 'repair' : 'repairs'}, made
					{formatDate(pending.exported.slice(0, 10), 'en-US', 'long')}.
				</p>
				<div class="button-row">
					<button class="button" type="button" onclick={() => runImport('merge')}>
						Add to my log
					</button>
					<button class="button secondary" type="button" onclick={() => runImport('replace')}>
						Replace my log with it
					</button>
					<button class="button quiet" type="button" onclick={() => (pending = null)}>
						Cancel
					</button>
				</div>
			</div>
		{/if}
		<p class="status" role="status" aria-live="polite">{backupStatus}</p>
	</section>

	<section aria-labelledby="delete-heading">
		<h2 id="delete-heading">Delete everything</h2>
		<p>Removes every repair, your details and your settings from this device.</p>
		{#if confirmClear}
			<div class="notice danger" role="alert">
				<p>
					<strong>Delete your whole log from this device?</strong> Download a backup first if you might
					need it.
				</p>
				<div class="button-row">
					<button class="button danger" type="button" onclick={clearAll}>
						<Icon name="trash" /> Yes, delete everything
					</button>
					<button class="button secondary" type="button" onclick={() => (confirmClear = false)}>
						No, keep it
					</button>
				</div>
			</div>
		{:else}
			<button
				class="button danger"
				type="button"
				onclick={() => (confirmClear = true)}
				disabled={!app.ready}
			>
				<Icon name="trash" /> Delete everything
			</button>
		{/if}
	</section>
</div>

<style>
	.submit {
		margin-top: 1.5rem;
	}

	.status {
		min-height: 1.6em;
		color: var(--success);
		font-weight: 650;
	}

	input[type='file'] {
		padding: 0.5rem;
	}
</style>
