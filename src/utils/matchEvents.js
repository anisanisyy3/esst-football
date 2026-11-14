// ============================================================================
// MATCH EVENT ENGINE (pure functions)
// One canonical event list per match -> derived score + sorted timeline.
// The same rules are mirrored by the SQL function submit_match_report(); the
// unit tests in scripts/test-football.mjs keep both documented.
// ============================================================================

import { EVENT_TYPES, GOAL_DETAILS } from './positions.js';

/**
 * Chronological sort key of an event minute.
 * "45+2" sorts after "45" and before "46" (minute * 100 + stoppage).
 */
export function minuteKey(minute, extraMinute) {
  return minute * 100 + (extraMinute ?? 0);
}

/** Human minute label: 45 / 45+2. */
export function minuteLabel(minute, extraMinute) {
  return extraMinute ? `${minute}+${extraMinute}` : String(minute);
}

/**
 * Validate a post-match event list against the two participants.
 *
 * Shape of each event:
 *   { event_type, detail?, minute, extra_minute?, team_id, player_id, related_player_id?, sequence? }
 *
 * Options:
 *   homeTeamId / awayTeamId - the two match participants (required);
 *   rosters                 - optional { [team_id]: Set|array of player ids };
 *                             when provided, scorer/assist/card/sub players
 *                             are checked against their team's roster
 *                             (mirrors the SQL submit_match_report checks).
 *   lineups                 - optional { [team_id]: Set|array of player ids
 *                             present in the official lineup }; when provided,
 *                             every event player must belong to that lineup.
 *
 * Rules enforced:
 *  - known event types; goal details; minute in 0..130; stoppage 0..15;
 *  - teams are the match participants;
 *  - goal scorer belongs to the credited team, EXCEPT own goals where the
 *    responsible player belongs to the OPPOSING team (the goal is credited to
 *    the other team via team_id);
 *  - assists only on non-own-goal goals, same team as the goal, != scorer;
 *  - cards: player belongs to the team;
 *  - substitution: outgoing (player_id) and incoming (related_player_id)
 *    belong to the team and are different players;
 *  - no duplicate events.
 *
 * @returns {{ valid: boolean, errors: string[], events: Array, homeScore: number, awayScore: number }}
 */
export function validateMatchEvents(rawEvents, { homeTeamId, awayTeamId, rosters = null, lineups = null } = {}) {
  const errors = [];
  const events = [];
  const seen = new Set();
  const teams = new Set([homeTeamId, awayTeamId]);
  const rosterOf = (teamId) => {
    const r = rosters?.[teamId];
    return r ? new Set(r) : null;
  };
  const lineupOf = (teamId) => {
    const l = lineups?.[teamId];
    return l ? new Set(l) : null;
  };

  if (!Array.isArray(rawEvents)) {
    return { valid: false, errors: ['events.notList'], events: [], homeScore: 0, awayScore: 0 };
  }

  for (const [index, raw] of rawEvents.entries()) {
    const ev = { ...raw };
    const pos = `#${index + 1}`;

    if (!EVENT_TYPES.includes(ev.event_type)) {
      errors.push(`events.badType:${pos}`);
      continue;
    }
    const minute = Number(ev.minute);
    if (!Number.isInteger(minute) || minute < 0 || minute > 130) {
      errors.push(`events.badMinute:${pos}`);
      continue;
    }
    const extra = ev.extra_minute === null || ev.extra_minute === undefined || ev.extra_minute === ''
      ? null
      : Number(ev.extra_minute);
    if (extra !== null && (!Number.isInteger(extra) || extra < 0 || extra > 15)) {
      errors.push(`events.badStoppage:${pos}`);
      continue;
    }
    if (!teams.has(ev.team_id)) {
      errors.push(`events.badTeam:${pos}`);
      continue;
    }
    if (!ev.player_id) {
      errors.push(`events.missingPlayer:${pos}`);
      continue;
    }

    // --- Lineup membership (event players must be in the official lineup) ----
    // Own goals: the responsible player plays for the CONCEDING team, so the
    // opposing team's lineup is the one that must contain him.
    const teamLineup = lineupOf(ev.team_id);
    const isOwnGoal = ev.event_type === 'goal' && ev.detail === 'own_goal';
    const requiredLineup = isOwnGoal
      ? lineupOf(ev.team_id === homeTeamId ? awayTeamId : homeTeamId)
      : teamLineup;
    if (requiredLineup) {
      const involved = [ev.player_id, ev.related_player_id].filter(Boolean);
      if (involved.some((id) => !requiredLineup.has(id))) {
        errors.push(`events.notInLineup:${pos}`);
        continue;
      }
    }

    // --- Roster membership (when the caller provides the squads) -------------
    const ownRoster = rosterOf(ev.team_id);
    const otherTeamId = ev.team_id === homeTeamId ? awayTeamId : homeTeamId;
    const otherRoster = rosterOf(otherTeamId);
    if (ownRoster) {
      if (ev.event_type === 'goal' && ev.detail !== 'own_goal') {
        if (!ownRoster.has(ev.player_id)) {
          errors.push(`events.scorerNotOnTeam:${pos}`);
          continue;
        }
        if (ev.related_player_id && !ownRoster.has(ev.related_player_id)) {
          errors.push(`events.assistNotOnTeam:${pos}`);
          continue;
        }
      }
      if (ev.event_type === 'goal' && ev.detail === 'own_goal') {
        // The responsible player plays for the CONCEDING team.
        if (otherRoster && !otherRoster.has(ev.player_id)) {
          errors.push(`events.ownGoalWrongTeam:${pos}`);
          continue;
        }
      }
      if ((ev.event_type === 'yellow' || ev.event_type === 'red') && !ownRoster.has(ev.player_id)) {
        errors.push(`events.cardNotOnTeam:${pos}`);
        continue;
      }
      if (ev.event_type === 'sub') {
        if (!ownRoster.has(ev.player_id) || !ownRoster.has(ev.related_player_id ?? '')) {
          errors.push(`events.subNotOnTeam:${pos}`);
          continue;
        }
      }
    }

    if (ev.event_type === 'goal') {
      const detail = ev.detail ?? 'normal';
      if (!GOAL_DETAILS.includes(detail)) {
        errors.push(`events.badDetail:${pos}`);
        continue;
      }
      if (detail === 'own_goal') {
        // The responsible player belongs to the CONCEDING team.
        if (ev.player_id === ev.related_player_id) {
          errors.push(`events.ownGoalPlayer:${pos}`);
          continue;
        }
        // own goals never carry an assist
        ev.related_player_id = null;
      } else if (ev.related_player_id) {
        if (ev.related_player_id === ev.player_id) {
          errors.push(`events.selfAssist:${pos}`);
          continue;
        }
      }
      ev.detail = detail;
    }

    if (ev.event_type === 'sub') {
      if (!ev.related_player_id) {
        errors.push(`events.subMissingIn:${pos}`);
        continue;
      }
      if (ev.related_player_id === ev.player_id) {
        errors.push(`events.subSamePlayer:${pos}`);
        continue;
      }
    }

    if (ev.event_type === 'yellow' || ev.event_type === 'red') {
      ev.related_player_id = null;
      ev.detail = null;
    }

    // Duplicate detection on the identifying tuple.
    const key = [
      ev.event_type,
      ev.detail ?? '',
      ev.minute,
      extra ?? '',
      ev.team_id,
      ev.player_id,
      ev.related_player_id ?? '',
    ].join('|');
    if (seen.has(key)) {
      errors.push(`events.duplicate:${pos}`);
      continue;
    }
    seen.add(key);

    events.push({ ...ev, minute, extra_minute: extra });
  }

  // Sequential numbering (timeline order is minute first, then list order).
  events.forEach((ev, i) => {
    ev.sequence = i + 1;
  });
  sortEvents(events);

  let homeScore = 0;
  let awayScore = 0;
  for (const ev of events) {
    if (ev.event_type !== 'goal') continue;
    if (ev.team_id === homeTeamId) homeScore += 1;
    else if (ev.team_id === awayTeamId) awayScore += 1;
  }

  return { valid: errors.length === 0, errors, events, homeScore, awayScore };
}

/** Sort events chronologically: minute (with stoppage), then given order. */
export function sortEvents(events) {
  events.sort((a, b) => {
    const ka = minuteKey(a.minute, a.extra_minute);
    const kb = minuteKey(b.minute, b.extra_minute);
    if (ka !== kb) return ka - kb;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  // Renumber after sorting so "sequence" always follows the timeline.
  events.forEach((ev, i) => {
    ev.sequence = i + 1;
  });
  return events;
}

/** Derived final score from the credited goal events. */
export function deriveScore(events, homeTeamId, awayTeamId) {
  let home = 0;
  let away = 0;
  for (const ev of events) {
    if (ev.event_type !== 'goal') continue;
    if (ev.team_id === homeTeamId) home += 1;
    else if (ev.team_id === awayTeamId) away += 1;
  }
  return { homeScore: home, awayScore: away };
}
