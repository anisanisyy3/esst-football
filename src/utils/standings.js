// ============================================================================
// STANDINGS ENGINE (pure function - no DOM, testable from Node)
// Always recalculated from FINISHED matches only. Nothing is stored in the DB.
// Ranking: points > goal difference > goals scored > team name (A→Z).
// ============================================================================

/**
 * @param {Array} teams     [{ id, name, short_name, logo_url }]
 * @param {Array} matches   [{ home_team_id, away_team_id, home_score, away_score, status }]
 * @param {Object} settings { points_for_win, points_for_draw, points_for_loss }
 * @returns {Array} rows sorted by the ranking rules, each with .position
 */
export function calculateStandings(teams = [], matches = [], settings = {}) {
  const pointsForWin = Number(settings.points_for_win ?? 3);
  const pointsForDraw = Number(settings.points_for_draw ?? 1);
  const pointsForLoss = Number(settings.points_for_loss ?? 0);

  // Start every team at zero, including teams without any match yet.
  const rows = new Map(
    (teams ?? []).map((team) => [
      team.id,
      {
        team_id: team.id,
        name: team.name,
        short_name: team.short_name,
        logo_url: team.logo_url,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_diff: 0,
        points: 0,
      },
    ])
  );

  for (const match of matches ?? []) {
    // Only finished matches count. Scheduled / live / postponed / cancelled
    // matches must never influence the table.
    if (match.status !== 'finished') continue;

    const home = rows.get(match.home_team_id);
    const away = rows.get(match.away_team_id);
    if (!home || !away) continue;

    const homeScore = match.home_score;
    const awayScore = match.away_score;
    // Defensive guard: invalid or missing scores are ignored.
    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      continue;
    }

    home.played += 1;
    away.played += 1;
    home.goals_for += homeScore;
    home.goals_against += awayScore;
    away.goals_for += awayScore;
    away.goals_against += homeScore;

    if (homeScore > awayScore) {
      home.won += 1;
      home.points += pointsForWin;
      away.lost += 1;
      away.points += pointsForLoss;
    } else if (homeScore < awayScore) {
      away.won += 1;
      away.points += pointsForWin;
      home.lost += 1;
      home.points += pointsForLoss;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += pointsForDraw;
      away.points += pointsForDraw;
    }
  }

  const list = [...rows.values()];
  for (const row of list) {
    row.goal_diff = row.goals_for - row.goals_against;
  }

  // 1. points, 2. goal difference, 3. goals scored, 4. name (A→Z).
  list.sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_diff - a.goal_diff ||
      b.goals_for - a.goals_for ||
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );

  list.forEach((row, index) => {
    row.position = index + 1;
  });

  return list;
}
