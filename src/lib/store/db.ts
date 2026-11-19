/**
 * On-device storage in IndexedDB. Repairs are kept one per record; the profile and settings
 * live in a small key-value store. Nothing here talks to a server.
 *
 * When IndexedDB isn't available (some private browsing modes), an in-memory store is used
 * instead and the app warns that the log won't survive closing the tab.
 */
import type { Profile, Repair } from '../engine/model.ts';

export interface Settings {
	textSize: 'normal' | 'large' | 'x-large';
	/** Last time the person downloaded a backup (ISO timestamp). */
	lastBackup?: string;
}

export const DEFAULT_SETTINGS: Settings = { textSize: 'normal' };

export interface Storage {
	readonly persistent: boolean;
	loadRepairs(): Promise<Repair[]>;
	saveRepair(repair: Repair): Promise<void>;
	deleteRepair(id: string): Promise<void>;
	loadMeta<T>(key: string): Promise<T | undefined>;
	saveMeta<T>(key: string, value: T): Promise<void>;
	clear(): Promise<void>;
}

const DB_NAME = 'rollfix';
const DB_VERSION = 1;

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
	});
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('repairs'))
				db.createObjectStore('repairs', { keyPath: 'id' });
			if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
		req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
	});
}

/** Svelte state proxies can't be stored by structured clone; store plain copies. */
function plain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

class IndexedDbStorage implements Storage {
	readonly persistent = true;
	constructor(private readonly db: IDBDatabase) {}

	#store(name: 'repairs' | 'meta', mode: IDBTransactionMode) {
		return this.db.transaction(name, mode).objectStore(name);
	}

	async loadRepairs(): Promise<Repair[]> {
		return request(this.#store('repairs', 'readonly').getAll() as IDBRequest<Repair[]>);
	}

	async saveRepair(repair: Repair): Promise<void> {
		await request(this.#store('repairs', 'readwrite').put(plain(repair)));
	}

	async deleteRepair(id: string): Promise<void> {
		await request(this.#store('repairs', 'readwrite').delete(id));
	}

	async loadMeta<T>(key: string): Promise<T | undefined> {
		return request(this.#store('meta', 'readonly').get(key) as IDBRequest<T | undefined>);
	}

	async saveMeta<T>(key: string, value: T): Promise<void> {
		await request(this.#store('meta', 'readwrite').put(plain(value), key));
	}

	async clear(): Promise<void> {
		const tx = this.db.transaction(['repairs', 'meta'], 'readwrite');
		tx.objectStore('repairs').clear();
		tx.objectStore('meta').clear();
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error('Could not clear IndexedDB'));
		});
	}
}

export class MemoryStorage implements Storage {
	readonly persistent = false;
	#repairs = new Map<string, Repair>();
	#meta = new Map<string, unknown>();

	async loadRepairs() {
		return [...this.#repairs.values()].map(plain);
	}
	async saveRepair(repair: Repair) {
		this.#repairs.set(repair.id, plain(repair));
	}
	async deleteRepair(id: string) {
		this.#repairs.delete(id);
	}
	async loadMeta<T>(key: string) {
		return this.#meta.get(key) as T | undefined;
	}
	async saveMeta<T>(key: string, value: T) {
		this.#meta.set(key, plain(value));
	}
	async clear() {
		this.#repairs.clear();
		this.#meta.clear();
	}
}

export async function openStorage(): Promise<Storage> {
	try {
		if (typeof indexedDB === 'undefined') throw new Error('No IndexedDB');
		return new IndexedDbStorage(await openDatabase());
	} catch {
		return new MemoryStorage();
	}
}

/** Ask the browser not to clear the log when the device is low on space. */
export async function requestPersistence(): Promise<boolean> {
	try {
		if (!navigator.storage?.persist) return false;
		if (await navigator.storage.persisted()) return true;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}

export type { Profile };
