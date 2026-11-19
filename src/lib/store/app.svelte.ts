/**
 * The app's state: the repair log, the person's details and settings, loaded from the device
 * and saved back on every change. Svelte components read it directly; it is reactive.
 */
import { todayISO, type ISODate } from '../engine/civil-date.ts';
import {
	EMPTY_PROFILE,
	newId,
	type Entry,
	type Profile,
	type PromiseOutcome,
	type Repair
} from '../engine/model.ts';
import { cleanProfile, cleanRepair, mergeRepairs, type Backup } from './backup.ts';
import {
	DEFAULT_SETTINGS,
	openStorage,
	requestPersistence,
	type Settings,
	type Storage
} from './db.ts';
import { sampleData } from './sample.ts';

export type FlashTone = 'success' | 'info' | 'warning';

export interface Flash {
	message: string;
	tone: FlashTone;
	/** Navigations survived so far; the message clears on the one after it was shown. */
	age: number;
}

/** The current time as an ISO timestamp (not reactive state, so a plain Date is right here). */
function nowISO(): string {
	return new Date().toISOString();
}

function byNewest(a: Repair, b: Repair): number {
	return b.brokeOn.localeCompare(a.brokeOn) || b.created.localeCompare(a.created);
}

export class AppState {
	ready = $state(false);
	/** False when the browser won't let us store data (the log disappears with the tab). */
	persistent = $state(true);
	repairs = $state<Repair[]>([]);
	profile = $state<Profile>({ ...EMPTY_PROFILE });
	settings = $state<Settings>({ ...DEFAULT_SETTINGS });
	/** Today's date on this device. Updates at midnight so the day count stays right. */
	today = $state<ISODate>(todayISO());
	flash = $state<Flash | null>(null);
	/** Id of an element to focus after the next page renders (e.g. a newly saved entry). */
	focusTarget = $state<string | null>(null);

	#storage: Storage | undefined;
	#init: Promise<void> | undefined;

	/** The repair being worked on: the most recent one that isn't fixed yet. */
	current = $derived(this.repairs.filter((repair) => !repair.fixedOn).sort(byNewest)[0]);
	/** Every repair, newest first. */
	all = $derived([...this.repairs].sort(byNewest));
	hasSample = $derived(this.repairs.some((repair) => repair.id.startsWith('sample-')));

	init(): Promise<void> {
		this.#init ??= this.#load();
		return this.#init;
	}

	async #load() {
		const storage = await openStorage();
		this.#storage = storage;
		this.persistent = storage.persistent;
		const [repairs, profile, settings] = await Promise.all([
			storage.loadRepairs(),
			storage.loadMeta<Profile>('profile'),
			storage.loadMeta<Settings>('settings')
		]);
		this.repairs = repairs
			.map((repair) => cleanRepair(repair))
			.filter((repair): repair is Repair => repair !== null);
		this.profile = cleanProfile(profile);
		this.settings = { ...DEFAULT_SETTINGS, ...settings };
		this.ready = true;
		this.#tick();
	}

	#tick() {
		if (typeof window === 'undefined') return;
		setInterval(() => {
			const today = todayISO();
			if (today !== this.today) this.today = today;
		}, 30_000);
	}

	get storage(): Storage {
		if (!this.#storage) throw new Error('Storage is not ready yet');
		return this.#storage;
	}

	repair(id: string | null | undefined): Repair | undefined {
		return id ? this.repairs.find((repair) => repair.id === id) : undefined;
	}

	/**
	 * Show a confirmation. Pass `beforeNavigation` when a page change follows, so the message
	 * appears on the next page and clears on the one after.
	 */
	notify(message: string, tone: FlashTone = 'success', beforeNavigation = false) {
		this.flash = { message, tone, age: beforeNavigation ? 0 : 1 };
	}

	navigated() {
		if (!this.flash) return;
		if (this.flash.age >= 1) this.flash = null;
		else this.flash = { ...this.flash, age: this.flash.age + 1 };
	}

	async saveRepair(repair: Repair): Promise<Repair> {
		const saved: Repair = { ...repair, updated: nowISO() };
		const index = this.repairs.findIndex((item) => item.id === saved.id);
		if (index === -1) this.repairs.push(saved);
		else this.repairs[index] = saved;
		await this.storage.saveRepair(saved);
		if (this.repairs.length === 1) void requestPersistence();
		return saved;
	}

	async deleteRepair(id: string) {
		this.repairs = this.repairs.filter((repair) => repair.id !== id);
		await this.storage.deleteRepair(id);
	}

	/** Add or update an entry. Logging "Chair repaired" closes the repair on that date. */
	async saveEntry(repairId: string, entry: Entry): Promise<Repair | undefined> {
		const repair = this.repair(repairId);
		if (!repair) return undefined;
		const entries = repair.entries.some((item) => item.id === entry.id)
			? repair.entries.map((item) => (item.id === entry.id ? entry : item))
			: [...repair.entries, entry];
		const fixedOn = entry.kind === 'repaired' && !repair.fixedOn ? entry.date : repair.fixedOn;
		return this.saveRepair({ ...repair, entries, ...(fixedOn ? { fixedOn } : {}) });
	}

	async deleteEntry(repairId: string, entryId: string) {
		const repair = this.repair(repairId);
		if (!repair) return;
		await this.saveRepair({
			...repair,
			entries: repair.entries.filter((entry) => entry.id !== entryId)
		});
	}

	async setPromiseOutcome(repairId: string, entryId: string, outcome: PromiseOutcome) {
		const repair = this.repair(repairId);
		const entry = repair?.entries.find((item) => item.id === entryId);
		if (!repair || !entry?.promise) return;
		await this.saveEntry(repairId, { ...entry, promise: { ...entry.promise, outcome } });
	}

	/** Mark the chair as fixed (or reopen it with `undefined`). */
	async setFixed(repairId: string, fixedOn: ISODate | undefined) {
		const repair = this.repair(repairId);
		if (!repair) return;
		const next: Repair = { ...repair };
		if (fixedOn) next.fixedOn = fixedOn;
		else delete next.fixedOn;
		await this.saveRepair(next);
	}

	async saveProfile(profile: Profile) {
		this.profile = cleanProfile(profile);
		await this.storage.saveMeta('profile', this.profile);
	}

	async saveSettings(settings: Partial<Settings>) {
		this.settings = { ...this.settings, ...settings };
		await this.storage.saveMeta('settings', this.settings);
	}

	async importBackup(backup: Backup, mode: 'merge' | 'replace') {
		const repairs =
			mode === 'replace' ? backup.repairs : mergeRepairs(this.repairs, backup.repairs);
		if (mode === 'replace') {
			for (const repair of this.repairs) await this.storage.deleteRepair(repair.id);
		}
		for (const repair of repairs) await this.storage.saveRepair(repair);
		this.repairs = repairs;
		const hasProfile = Object.values(backup.profile).some((value) => value.trim() !== '');
		if (mode === 'replace' || (hasProfile && !this.profile.name)) {
			await this.saveProfile(backup.profile);
		}
	}

	async loadSample() {
		const { profile, repairs } = sampleData(this.today);
		for (const repair of repairs) await this.saveRepair(repair);
		if (!this.profile.name) await this.saveProfile(profile);
	}

	async clearSample() {
		for (const repair of this.repairs.filter((item) => item.id.startsWith('sample-'))) {
			await this.deleteRepair(repair.id);
		}
		if (this.profile.name === sampleData(this.today).profile.name) {
			await this.saveProfile({ ...EMPTY_PROFILE });
		}
	}

	async clearAll() {
		await this.storage.clear();
		this.repairs = [];
		this.profile = { ...EMPTY_PROFILE };
		this.settings = { ...DEFAULT_SETTINGS };
	}
}

export const app = new AppState();

export { newId };
