/** The validated rules and letters, bundled at build time (see src/lib/content/vite-plugin.ts). */
import { content } from 'virtual:rollfix/content';
import type { ISODate } from './engine/civil-date.ts';
import type { Repair } from './engine/model.ts';
import { rulesFor, type Jurisdiction, type RulesForRepair } from './engine/rules.ts';
import type { LetterDef, Recipient } from './engine/schema.ts';
import { stateName, US_STATES } from './engine/states.ts';

export const STATES: Record<string, Jurisdiction> = content.states;
export const FEDERAL: Jurisdiction = content.federal;
export const LETTERS: Record<Recipient, LetterDef> = content.letters;

/** States with a profile, alphabetically. */
export const STATE_PROFILES: Jurisdiction[] = Object.values(STATES).sort((a, b) =>
	a.name.localeCompare(b.name)
);

export function profileFor(code: string | undefined): Jurisdiction | undefined {
	return code ? STATES[code] : undefined;
}

export function repairRules(repair: Repair, today: ISODate): RulesForRepair {
	return rulesFor(repair, profileFor(repair.state), FEDERAL, today);
}

export { stateName, US_STATES };
