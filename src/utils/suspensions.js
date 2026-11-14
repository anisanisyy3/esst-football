// ============================================================================
// SUSPENSIONS (pure functions)
// Official rule: a red card = automatic ONE-match suspension. The player
// misses their team's NEXT official tournament match (not cancelled), and
// the suspension is served once that match has been played without them.
// Yellow cards never create suspensions (documented in the rules).
// The SQL report function enforces the same logic in the database.
// ============================================================================

/**
 * Suspended player ids for ONE upcoming match.
 *
 * @param {object} match  the match the lineup is being saved for
 *   { id, kickoff_at, status }
 * @param {Map}   redCardsByPlayer   player_id -> [{ match_id, kickoff_at }]
 *   red-card events of this team's players, from previous official matches.
 * @param {Array} teamMatches   ALL official matches of this team (any order):
 *   [{ id, kickoff_at, status }]
 * @param {Map}   appearancesByPlayer player_id -> Set(match_id appeared in)
 * @returns {Set<string>} player ids not selectable for this match
 */
export function suspendedPlayerIdsForMatch(match, redCardsByPlayer, teamMatches, appearancesByPlayer) {
  const suspended = new Set();

  const official = [...(teamMatches ?? [])]
    .filter((m) => m.status !== 'cancelled')
    .sort(
      (a, b) =>
        String(a.kickoff_at).localeCompare(String(b.kickoff_at)) ||
        String(a.id).localeCompare(String(b.id))
    );

  for (const [playerId, cards] of redCardsByPlayer ?? []) {
    for (const card of cards ?? []) {
      // The team's first official match strictly after the red-card match.
      const target = official.find(
        (m) =>
          String(m.kickoff_at) > String(card.kickoff_at) ||
          (String(m.kickoff_at) === String(card.kickoff_at) && String(m.id) > String(card.match_id))
      );
      if (!target) continue; // no upcoming match to serve against yet

      if (target.id !== match.id) {
        // Served already if the target was played without the player.
        if (target.status === 'finished' && !appearancesByPlayer?.get(playerId)?.has(target.id)) {
          continue; // served -> eligible again
        }
        if (target.status === 'finished') continue; // target played (they were selected): lenient
        continue; // target is a different future match: only THAT match blocks
      }

      // This match IS the suspension target: blocked until it is finished.
      suspended.add(playerId);
    }
  }

  return suspended;
}

/**
 * Suspension records for a player's career page (pending / served history).
 *
 * @returns Array<{ red_card_match_id, target_match_id, status: 'pending'|'served' }>
 */
export function computePlayerSuspensions(playerId, redCards, teamMatches, appearedSet) {
  const official = [...(teamMatches ?? [])]
    .filter((m) => m.status !== 'cancelled')
    .sort(
      (a, b) =>
        String(a.kickoff_at).localeCompare(String(b.kickoff_at)) ||
        String(a.id).localeCompare(String(b.id))
    );

  const records = [];
  for (const card of [...(redCards ?? [])].sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)))) {
    const target = official.find(
      (m) =>
        String(m.kickoff_at) > String(card.kickoff_at) ||
        (String(m.kickoff_at) === String(card.kickoff_at) && String(m.id) > String(card.match_id))
    );
    if (!target) {
      records.push({ red_card_match_id: card.match_id, target_match_id: null, status: 'pending' });
      continue;
    }
    const served =
      target.status === 'finished' && !(appearedSet ?? new Set()).has(target.id);
    records.push({
      red_card_match_id: card.match_id,
      target_match_id: target.id,
      status: served ? 'served' : 'pending',
    });
  }
  return records;
}
