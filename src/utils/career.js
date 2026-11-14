// ============================================================================
// APPEARANCES + CAREER STATISTICS (pure functions)
// Derived ONLY from official lineups and the match event list - never from
// manual player input. Mirrored by the SQL report functions.
// ============================================================================

import { minuteKey, sortEvents } from './matchEvents.js';

/** End-of-match sort key: never earlier than the 90th minute. */
export function matchEndKey(events) {
  let end = 90 * 100;
  for (const ev of events) end = Math.max(end, minuteKey(ev.minute, ev.extra_minute));
  return end;
}

/**
 * Build the appearance list of one match from both lineups + events.
 *
 * Rules (official ESST):
 *  - the 11 starters appear from minute 0;
 *  - a substitute appears only when a substitution event brings them in;
 *  - a player leaves the pitch when subbed off OR when shown a red card;
 *  - unused substitutes get NO appearance row at all.
 *
 * @param {object} homeLineup { team_id, players: [{player_id, is_starter, match_position}] }
 * @param {object} awayLineup same shape for the other team
 * @param {Array}  events     validated match events (goals/cards/subs)
 * @returns {{ appearances: Array, endKey: number }}
 */
export function computeAppearances(homeLineup, awayLineup, events) {
  const endKey = matchEndKey(events);
  const appearances = [];
  const onPitch = new Map(); // player_id -> { entry, team_id, match_position, is_starter }

  const track = (lineup) => {
    if (!lineup) return;
    for (const p of lineup.players ?? []) {
      if (p.is_starter) {
        onPitch.set(p.player_id, {
          team_id: lineup.team_id,
          match_position: p.match_position,
          is_starter: true,
          entry: 0,
        });
      }
    }
  };
  track(homeLineup);
  track(awayLineup);

  const exitPlayer = (playerId, exit) => {
    const p = onPitch.get(playerId);
    if (!p) return;
    appearances.push({
      player_id: playerId,
      team_id: p.team_id,
      match_position: p.match_position,
      is_starter: p.is_starter,
      entry_minute: p.entry,
      exit_minute: exit,
      minutes_played: Math.round((exit - p.entry) / 100),
    });
    onPitch.delete(playerId);
  };

  const ordered = [...events].sort((a, b) => {
    const ka = minuteKey(a.minute, a.extra_minute);
    const kb = minuteKey(b.minute, b.extra_minute);
    if (ka !== kb) return ka - kb;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });

  for (const ev of ordered) {
    if (ev.event_type === 'sub') {
      // Out first (frees the pitch slot), then in.
      exitPlayer(ev.player_id, minuteKey(ev.minute, ev.extra_minute));
      const incoming = findSubstituteInfo(ev);
      if (incoming) {
        onPitch.set(ev.related_player_id, {
          team_id: incoming.team_id,
          match_position: incoming.match_position,
          is_starter: false,
          entry: minuteKey(ev.minute, ev.extra_minute),
        });
      }
    } else if (ev.event_type === 'red') {
      // A red card sends the player off: their pitch time ends here.
      exitPlayer(ev.player_id, minuteKey(ev.minute, ev.extra_minute));
    }
  }

  // Everyone still on the pitch at full time.
  for (const [playerId, p] of onPitch) {
    appearances.push({
      player_id: playerId,
      team_id: p.team_id,
      match_position: p.match_position,
      is_starter: p.is_starter,
      entry_minute: p.entry,
      exit_minute: endKey,
      minutes_played: Math.round((endKey - p.entry) / 100),
    });
  }

  return { appearances, endKey };

  // --- helpers -------------------------------------------------------------
  function findSubstituteInfo(ev) {
    for (const lineup of [homeLineup, awayLineup]) {
      if (!lineup) continue;
      if (lineup.team_id !== ev.team_id) continue;
      const sub = (lineup.players ?? []).find(
        (p) => p.player_id === ev.related_player_id && !p.is_starter
      );
      if (sub) return { team_id: lineup.team_id, match_position: sub.match_position };
    }
    return null;
  }
  function onPitchHasStarterInfo() {
    return null;
  }
}

/**
 * Goals conceded while a given defender/goalkeeper was on the pitch.
 * A goal is "conceded by team T" when it is credited to the OPPOSING team
 * (this includes own goals scored by T's own players - the event row credits
 * the benefiting team, so the conceding team is the other one).
 *
 * Boundary rule (documented, applied consistently everywhere):
 * a player is considered OFF the pitch for a goal recorded at exactly the
 * minute they were subbed off (exclusive interval [entry, exit)).
 */
export function goalsConcededWhileOnPitch(appearance, events, teamId) {
  // entry/exit are already minuteKeys (minute * 100 + stoppage), see
  // computeAppearances(): entry 0 for starters, exit = matchEndKey at full time.
  const entry = appearance.entry_minute ?? 0;
  const exit = appearance.exit_minute;
  const conceded = [];
  for (const ev of events) {
    if (ev.event_type !== 'goal') continue;
    // The event credits the BENEFITING team; the suffering team is the other one.
    const isAgainstTeam = ev.team_id !== teamId;
    if (!isAgainstTeam) continue;
    const key = minuteKey(ev.minute, ev.extra_minute);
    if (key >= entry && key < exit) conceded.push(ev);
  }
  return conceded;
}

/**
 * Full career statistics for one player from official records.
 *
 * @param {object} player profile row (needs id, main_position...)
 * @param {Array}  entries  per finished match:
 *   { match: {id, kickoff_at, home_team_id, away_team_id, home_score, away_score},
 *     appearances: Array (this match, all players),
 *     events: Array (this match) }
 * The player's own appearance inside each entry is looked up automatically.
 * @returns career object (see README) + per-match history
 */
export function computeCareerStats(playerId, entries) {
  const career = {
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    minutes_played: 0,
    goals_conceded: 0,
    clean_sheets: 0,
    history: [],
  };

  const sorted = [...entries].sort((a, b) =>
    String(a.match.kickoff_at).localeCompare(String(b.match.kickoff_at))
  );

  for (const entry of sorted) {
    const { match, events } = entry;
    const mine = (entry.appearances ?? []).find((a) => a.player_id === playerId);
    const historyItem = {
      match_id: match.id,
      kickoff_at: match.kickoff_at,
      appeared: Boolean(mine),
      match_position: mine?.match_position ?? null,
      minutes_played: mine?.minutes_played ?? 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      goals_conceded: 0,
      clean_sheet: false,
      result: null, // 'W' | 'D' | 'L'
    };

    if (!mine) {
      career.history.push(historyItem);
      continue; // unused substitute or not selected: nothing at all
    }

    const isHome = mine.team_id === match.home_team_id;
    const myScore = isHome ? match.home_score : match.away_score;
    const oppScore = isHome ? match.away_score : match.home_score;
    historyItem.result = myScore > oppScore ? 'W' : myScore === oppScore ? 'D' : 'L';
    historyItem.my_team_goals = myScore;
    historyItem.opponent_goals = oppScore;

    career.matches_played += 1;
    career.minutes_played += mine.minutes_played ?? 0;
    if (historyItem.result === 'W') career.wins += 1;
    else if (historyItem.result === 'D') career.draws += 1;
    else career.losses += 1;

    // Personal events
    for (const ev of events ?? []) {
      if (ev.event_type === 'goal' && ev.detail !== 'own_goal') {
        if (ev.player_id === playerId) {
          career.goals += 1;
          historyItem.goals += 1;
        }
        if (ev.related_player_id === playerId) {
          career.assists += 1;
          historyItem.assists += 1;
        }
      }
      if (ev.event_type === 'yellow' && ev.player_id === playerId) {
        career.yellow_cards += 1;
        historyItem.yellow += 1;
      }
      if (ev.event_type === 'red' && ev.player_id === playerId) {
        career.red_cards += 1;
        historyItem.red += 1;
      }
    }

    // Defensive / goalkeeping numbers (own team perspective)
    const conceded = goalsConcededWhileOnPitch(mine, events ?? [], mine.team_id);
    historyItem.goals_conceded = conceded.length;
    historyItem.clean_sheet = conceded.length === 0;
    career.goals_conceded += conceded.length;
    if (historyItem.clean_sheet) career.clean_sheets += 1;

    career.history.push(historyItem);
  }

  return career;
}

/**
 * Player leaderboards from official records.
 * entries: same shape as computeCareerStats, for ALL players of the league.
 */
export function computeLeaderboards(entries, players) {
  const perPlayer = new Map();
  for (const p of players) {
    perPlayer.set(p.id, {
      player: p,
      appearances: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      clean_sheets: 0,
      goals_conceded: 0,
      ovr: p.ovr ?? null,
    });
  }

  for (const entry of entries) {
    const { events, appearances, match } = entry;
    void match;
    for (const app of appearances ?? []) {
      const agg = perPlayer.get(app.player_id);
      if (!agg) continue;
      agg.appearances += 1;
      agg.minutes += app.minutes_played ?? 0;
      const conceded = goalsConcededWhileOnPitch(app, events ?? [], app.team_id);
      agg.goals_conceded += conceded.length;
      if (conceded.length === 0 && (app.match_position === 'goalkeeper' || app.match_position === 'defender')) {
        agg.clean_sheets += 1;
      }
    }
    for (const ev of events ?? []) {
      if (ev.event_type === 'goal' && ev.detail !== 'own_goal') {
        const scorer = perPlayer.get(ev.player_id);
        if (scorer) scorer.goals += 1;
        const assister = ev.related_player_id ? perPlayer.get(ev.related_player_id) : null;
        if (assister) assister.assists += 1;
      }
      if (ev.event_type === 'yellow') {
        const p = perPlayer.get(ev.player_id);
        if (p) p.yellow += 1;
      }
      if (ev.event_type === 'red') {
        const p = perPlayer.get(ev.player_id);
        if (p) p.red += 1;
      }
    }
  }

  const all = [...perPlayer.values()];
  // Deterministic tie-breaks: value desc, then fewer goals conceded, then name.
  const byName = (a, b) =>
    String(a.player.display_name ?? '').localeCompare(String(b.player.display_name ?? ''), 'fr');
  return {
    goals: sortBoard(all, (x) => -x.goals, byName),
    assists: sortBoard(all, (x) => -x.assists, byName),
    yellowCards: sortBoard(all.filter((x) => x.yellow > 0), (x) => -x.yellow, byName),
    redCards: sortBoard(all.filter((x) => x.red > 0), (x) => -x.red, byName),
    cleanSheets: sortBoard(
      all.filter((x) => (x.player.main_position ?? '') === 'goalkeeper'),
      (x) => -x.clean_sheets,
      (a, b) => a.goals_conceded - b.goals_conceded || byName(a, b)
    ),
    fewestConceded: sortBoard(
      all.filter((x) => (x.player.main_position ?? '') === 'goalkeeper' && x.appearances > 0),
      (x) => x.goals_conceded,
      (a, b) => b.appearances - a.appearances || byName(a, b)
    ),
    appearances: sortBoard(all.filter((x) => x.appearances > 0), (x) => -x.appearances, (a, b) => b.minutes - a.minutes || byName(a, b)),
    ovr: sortBoard(all.filter((x) => x.ovr !== null), (x) => -x.ovr, byName),
  };
}

function sortBoard(list, primary, tiebreak) {
  return [...list].sort((a, b) => primary(a) - primary(b) || tiebreak(a, b));
}

/** Re-export for callers that need sorting inside components. */
export { sortEvents };
