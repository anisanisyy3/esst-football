// ============================================================================
// OFFICIAL ESST OVR ENGINE (pure functions)
// Implements section 11 of the tournament rules EXACTLY. Do not "improve"
// these formulas without an explicit rule change - tests pin them down.
//
// Core ideas:
//  - Every player starts at 60 OVR; displayed value is clamped to 50..99
//    AFTER each finished match.
//  - Points come ONLY from the official match data (lineup + event report):
//    never from player/captain input.
//  - A per-match ledger stores every reason and delta, so each player's last
//    change can be explained (e.g. "win +1, goal +2, yellow -1").
//  - Recomputation walks finished matches in chronological order starting
//    from 60, so a corrected report can never double-apply points.
// ============================================================================

import { OVR_START, OVR_MIN, OVR_MAX } from './positions.js';
import { goalsConcededWhileOnPitch } from './career.js';
import { minuteKey } from './matchEvents.js';

/** Clamp a rating to the official 50..99 band. */
export function clampOvr(value) {
  return Math.min(OVR_MAX, Math.max(OVR_MIN, value));
}

/**
 * Build the OVR ledger rows earned by ONE player in ONE finished match.
 *
 * @param {object} input
 *   player:        { id } - just for clarity / error checks
 *   appearance:    { team_id, match_position, entry_minute, exit_minute } or
 *                  null when the player did NOT appear (unused sub / absent).
 *                  match_position is the position LOCKED in the official
 *                  lineup - it never changes during the match.
 *   match:         { home_team_id, away_team_id, home_score, away_score }
 *   events:        canonical event list of the match.
 * @returns {{ rows: Array<{reason: string, delta: number, meta?: object}>, total: number }}
 *          rows is empty (total 0) when the player did not appear.
 */
export function computeMatchOvrRows({ player, appearance, match, events }) {
  const rows = [];
  if (!appearance) return { rows, total: 0 }; // unused substitute: nothing at all

  const playerId = player?.id ?? appearance.player_id;
  const teamId = appearance.team_id;
  const isHome = teamId === match.home_team_id;
  const myScore = isHome ? match.home_score : match.away_score;
  const oppScore = isHome ? match.away_score : match.home_score;
  const won = myScore > oppScore;
  const lost = myScore < oppScore;

  // --- 1. Match result (every player who appeared) --------------------------
  rows.push({ reason: won ? 'win' : lost ? 'loss' : 'draw', delta: won ? 1 : lost ? -1 : 0 });

  // --- 2. Goals and assists (credited goals only) ---------------------------
  for (const ev of events ?? []) {
    if (ev.event_type !== 'goal') continue;
    if (ev.detail === 'own_goal') continue; // responsible player gets NOTHING
    if (ev.player_id === playerId) {
      rows.push({ reason: 'goal', delta: 2, meta: { event_id: ev.id ?? null } });
    }
    if (ev.related_player_id && ev.related_player_id === playerId) {
      rows.push({ reason: 'assist', delta: 1, meta: { event_id: ev.id ?? null } });
    }
  }

  // --- 3. Cards --------------------------------------------------------------
  for (const ev of events ?? []) {
    if (ev.player_id !== playerId) continue;
    if (ev.event_type === 'yellow') rows.push({ reason: 'yellow', delta: -1, meta: { event_id: ev.id ?? null } });
    if (ev.event_type === 'red') rows.push({ reason: 'red', delta: -2, meta: { event_id: ev.id ?? null } });
  }

  // --- 4. Defender / goalkeeper specifics -----------------------------------
  const position = appearance.match_position;
  if (position === 'defender' || position === 'goalkeeper') {
    rows.push({ reason: 'appearance', delta: 2 });

    const conceded = goalsConcededWhileOnPitch(appearance, events ?? [], teamId);
    for (const ev of conceded) {
      rows.push({ reason: 'conceded', delta: -1, meta: { event_id: ev.id ?? null } });
    }

    if (position === 'goalkeeper' && conceded.length === 0) {
      rows.push({ reason: 'clean_sheet', delta: 1 });
    }
    if (position === 'defender' && won) {
      const margin = myScore - oppScore;
      if (margin >= 4) rows.push({ reason: 'win_margin', delta: 2 });
      else if (margin >= 2) rows.push({ reason: 'win_margin', delta: 1 });
      // 1-goal win: no bonus (documented).
    }
  }
  // Midfielders and forwards get ONLY the general rules above - by design.

  const total = rows.reduce((sum, r) => sum + r.delta, 0);
  return { rows, total };
}

/**
 * Deterministic OVR recompute for ONE player across their whole history.
 *
 * @param {Array} entries finished matches in any input order, each:
 *   { match_id, kickoff_at, rows }  (rows = computeMatchOvrRows output)
 *   - Only matches where the player appeared have rows; pass those only,
 *     or pass empty-row entries (they are transparent: 0 delta).
 *   - Order key: kickoff_at, then match_id (stable when two matches share
 *     the same kickoff timestamp).
 * @returns {{ start, current, perMatch: Array, ledger: Array }}
 *   perMatch: [{ match_id, before, delta, after }] - clamp applied per match.
 *   ledger:   flattened [{ match_id, reason, delta }] in the same order.
 */
export function recomputeOvrHistory(entries) {
  const sorted = [...entries].sort((a, b) => {
    const t = String(a.kickoff_at ?? '').localeCompare(String(b.kickoff_at ?? ''));
    if (t !== 0) return t;
    return String(a.match_id).localeCompare(String(b.match_id));
  });

  let current = OVR_START;
  const perMatch = [];
  const ledger = [];

  for (const entry of sorted) {
    const delta = (entry.rows ?? []).reduce((sum, r) => sum + r.delta, 0);
    const before = current;
    current = clampOvr(before + delta);
    perMatch.push({ match_id: entry.match_id, before, delta, after: current });
    for (const row of entry.rows ?? []) {
      ledger.push({ match_id: entry.match_id, reason: row.reason, delta: row.delta, meta: row.meta });
    }
  }

  return { start: OVR_START, current, perMatch, ledger };
}

/**
 * Convenience helper: rows for every player of one match, given the
 * appearance list built by computeAppearances().
 *
 * @param {object} match { id, home_team_id, away_team_id, home_score, away_score }
 * @param {Array}  appearances all players of the match (see career.js)
 * @param {Array}  events      canonical event list
 * @returns {Map} player_id -> { rows, total } (only players who appeared)
 */
export function computeAllMatchOvr(match, appearances, events) {
  const map = new Map();
  for (const appearance of appearances ?? []) {
    const { rows, total } = computeMatchOvrRows({
      player: { id: appearance.player_id },
      appearance,
      match,
      events,
    });
    map.set(appearance.player_id, { rows, total });
  }
  return map;
}

/** Human-readable reasons list, used by UI tooltips and the profile page. */
export function describeRows(rows, translate) {
  return (rows ?? [])
    .filter((r) => r.delta !== 0 || r.reason === 'draw')
    .map((r) => `${translate(`ovr.reason.${r.reason}`)} ${r.delta > 0 ? '+' : ''}${r.delta}`);
}

/** Re-exported for callers that want the boundary rule helpers together. */
export { minuteKey };
