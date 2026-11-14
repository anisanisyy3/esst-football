// ============================================================================
// LINEUP VALIDATION (pure functions)
// Validates a captain's lineup before it is saved: exactly 11 starters,
// up to 7 substitutes, no duplicate selection, unique jersey numbers,
// one captain armband, no suspended or ineligible player.
// The SQL function save_lineup() enforces the same rules again in the
// database - this module powers the UI preview and the demo mode.
// ============================================================================

import { FORMATIONS, POSITIONS, SLOT_POSITION, STARTERS_REQUIRED, SUBSTITUTES_MAX } from './positions.js';

/**
 * @param {object} input
 *   formation:          key of FORMATIONS (e.g. '4-3-3')
 *   players:            [{ player_id, jersey_number, match_position,
 *                          is_starter, is_captain, is_vice_captain }]
 *   eligiblePlayerIds:  active members of THIS team (roster)
 *   suspendedPlayerIds: players currently suspended for this team
 * @returns {{ valid: boolean, errors: string[], checked: object }}
 *   errors are i18n keys (may carry a suffix like `:count`).
 */
export function validateLineupInput(input) {
  const errors = [];
  const players = Array.isArray(input?.players) ? input.players : [];
  const eligible = new Set(input?.eligiblePlayerIds ?? []);
  const suspended = new Set(input?.suspendedPlayerIds ?? []);

  // Formation must exist (allow custom templates added to FORMATIONS).
  if (!input?.formation || !FORMATIONS[input.formation]) {
    errors.push('lineup.errors.badFormation');
  }

  if (players.length === 0) {
    return { valid: false, errors: ['lineup.errors.empty'], checked: { starters: 0, subs: 0 } };
  }

  // --- No player selected twice ---------------------------------------------
  const seen = new Set();
  const duplicates = new Set();
  for (const p of players) {
    if (seen.has(p.player_id)) duplicates.add(p.player_id);
    seen.add(p.player_id);
  }
  if (duplicates.size > 0) errors.push('lineup.errors.duplicatePlayer');

  // --- Counts ----------------------------------------------------------------
  const starters = players.filter((p) => p.is_starter);
  const subs = players.filter((p) => !p.is_starter);
  if (starters.length !== STARTERS_REQUIRED) {
    errors.push(`lineup.errors.starters:${starters.length}`);
  }
  if (subs.length > SUBSTITUTES_MAX) {
    errors.push(`lineup.errors.subs:${subs.length}`);
  }

  // --- Eligibility (active members of this team only) ------------------------
  const notEligible = players.filter((p) => !eligible.has(p.player_id));
  if (notEligible.length > 0) errors.push('lineup.errors.notEligible');

  // --- Suspensions ------------------------------------------------------------
  const suspendedSelected = players.filter((p) => suspended.has(p.player_id));
  if (suspendedSelected.length > 0) errors.push('lineup.errors.suspended');

  // --- Match positions ---------------------------------------------------------
  const badPosition = players.filter((p) => !POSITIONS.includes(p.match_position));
  if (badPosition.length > 0) errors.push('lineup.errors.badPosition');

  // --- Jersey numbers: 1..99, unique within the lineup -------------------------
  const jerseys = new Set();
  const jerseyDupes = new Set();
  let missingJersey = false;
  for (const p of players) {
    const n = Number(p.jersey_number);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      missingJersey = true;
      continue;
    }
    if (jerseys.has(n)) jerseyDupes.add(n);
    jerseys.add(n);
  }
  if (missingJersey) errors.push('lineup.errors.jerseyMissing');
  if (jerseyDupes.size > 0) errors.push(`lineup.errors.jerseyDupe:${[...jerseyDupes].join(',')}`);

  // --- Captain armband: exactly one captain, at most one different vice -------
  const captains = players.filter((p) => p.is_captain);
  const vices = players.filter((p) => p.is_vice_captain && !p.is_captain);
  if (captains.length !== 1) errors.push(`lineup.errors.captains:${captains.length}`);
  if (vices.length > 1) errors.push('lineup.errors.vice');

  return {
    valid: errors.length === 0,
    errors,
    checked: { starters: starters.length, subs: subs.length, total: players.length },
  };
}

/** Slot template for a formation - used by the pitch editor to place players. */
export function formationSlots(formation) {
  return FORMATIONS[formation] ?? null;
}

/** Default OVR category for a pitch slot (GK->goalkeeper, CB->defender...). */
export function slotDefaultPosition(slot) {
  return SLOT_POSITION[slot] ?? 'midfielder';
}
