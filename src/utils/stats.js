// ============================================================================
// TOURNAMENT STATISTICS (pure function - no DOM, testable from Node)
// Everything is derived from real records. No data is ever invented here.
// ============================================================================

/** A finished match with valid integer scores. */
function isCountedFinished(match) {
  return (
    match.status === 'finished' &&
    Number.isInteger(match.home_score) &&
    Number.isInteger(match.away_score) &&
    match.home_score >= 0 &&
    match.away_score >= 0
  );
}

/**
 * @param {Array} teams   all visible teams
 * @param {Array} matches all matches
 * @returns {Object} counts and derived highlights
 */
export function computeStats(teams = [], matches = []) {
  const list = matches ?? [];
  const finished = list.filter(isCountedFinished);

  const totalGoals = finished.reduce(
    (sum, m) => sum + m.home_score + m.away_score,
    0
  );
  const avgGoals = finished.length
    ? Math.round((totalGoals / finished.length) * 100) / 100
    : null;

  // Per-team attack / defense numbers from finished matches only.
  const perTeam = new Map(
    (teams ?? []).map((team) => [
      team.id,
      { team, played: 0, goals_for: 0, goals_against: 0 },
    ])
  );
  for (const m of finished) {
    const home = perTeam.get(m.home_team_id);
    const away = perTeam.get(m.away_team_id);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goals_for += m.home_score;
    home.goals_against += m.away_score;
    away.goals_for += m.away_score;
    away.goals_against += m.home_score;
  }

  let bestAttack = null;
  let bestDefense = null;
  let bestDiff = null;
  const nameOf = (entry) => entry.team.name ?? '';
  // Ties are broken alphabetically so results are always deterministic.
  for (const entry of perTeam.values()) {
    if (entry.played === 0) continue;
    const diff = entry.goals_for - entry.goals_against;
    if (
      !bestAttack ||
      entry.goals_for > bestAttack.goals ||
      (entry.goals_for === bestAttack.goals && nameOf(entry) < nameOf(bestAttack))
    ) {
      bestAttack = { team: entry.team, goals: entry.goals_for };
    }
    if (
      !bestDefense ||
      entry.goals_against < bestDefense.goalsAgainst ||
      (entry.goals_against === bestDefense.goalsAgainst && nameOf(entry) < nameOf(bestDefense))
    ) {
      bestDefense = { team: entry.team, goalsAgainst: entry.goals_against };
    }
    if (
      !bestDiff ||
      diff > bestDiff.diff ||
      (diff === bestDiff.diff && nameOf(entry) < nameOf(bestDiff))
    ) {
      bestDiff = { team: entry.team, diff };
    }
  }

  return {
    teamCount: (teams ?? []).length,
    totalMatches: list.length,
    finishedCount: finished.length,
    upcomingCount: list.filter((m) => m.status === 'scheduled').length,
    liveCount: list.filter((m) => m.status === 'live').length,
    postponedCount: list.filter((m) => m.status === 'postponed').length,
    cancelledCount: list.filter((m) => m.status === 'cancelled').length,
    totalGoals,
    avgGoals,
    bestAttack,
    bestDefense,
    bestDiff,
    goalsByTeam: [...perTeam.values()]
      .filter((e) => e.played > 0)
      .sort((a, b) => b.goals_for - a.goals_for || a.team.name.localeCompare(b.team.name, 'fr'))
      .slice(0, 8)
      .map((e) => ({ name: e.team.name, short_name: e.team.short_name, goals: e.goals_for })),
  };
}
