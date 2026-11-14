// ============================================================================
// SETTINGS CACHE - tournament settings fetched once and reused everywhere
// (name, season, timezone, points rules). Pages call loadSettings() before
// rendering; components read getCachedSettings()/getTz() synchronously.
// ============================================================================

import { dataService } from '../services/dataService.js';

export const DEFAULT_SETTINGS = {
  id: 1,
  tournament_name: 'ESST Football Tournament',
  season_label: '',
  timezone: 'Africa/Algiers',
  points_for_win: 3,
  points_for_draw: 1,
  points_for_loss: 0,
};

let cache = null;

/** Fetch and cache settings (returns them even if the fetch fails). */
export async function loadSettings() {
  if (cache) return cache;
  try {
    cache = (await dataService.getSettings()) ?? DEFAULT_SETTINGS;
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

export function getCachedSettings() {
  return cache ?? DEFAULT_SETTINGS;
}

/** Tournament timezone for date display. */
export function getTz() {
  return cache?.timezone || 'Africa/Algiers';
}

/** Clear the cache (after the admin edits the settings). */
export function invalidateSettings() {
  cache = null;
}
