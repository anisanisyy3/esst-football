// ============================================================================
// UNIT TESTS - run with:  npm test
// Tests calculateStandings(), validateMatch(), validateTeam(), computeStats().
// Pure functions only: runs in Node, no browser needed.
// ============================================================================

import { calculateStandings } from '../src/utils/standings.js';
import { validateMatch, validateTeam } from '../src/utils/validation.js';
import { computeStats } from '../src/utils/stats.js';

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✘ ${name}`);
  }
}

function team(id, name, short) {
  return { id, name: name ?? id, short_name: short ?? id, logo_url: null };
}

function match(home, away, hs, as_, status = 'finished') {
  return { home_team_id: home, away_team_id: away, home_score: hs, away_score: as_, status };
}

const S = { points_for_win: 3, points_for_draw: 1, points_for_loss: 0 };

// ---------------------------------------------------------------------------
console.log('\n1) Win / draw / loss points');
{
  const teams = [team('A'), team('B'), team('C'), team('D')];
  const matches = [match('A', 'B', 2, 0), match('C', 'D', 1, 1)];
  const rows = calculateStandings(teams, matches, S);
  const byId = Object.fromEntries(rows.map((r) => [r.team_id, r]));
  check('winner has 3 points', byId.A.points === 3);
  check('winner counted as won', byId.A.won === 1 && byId.A.played === 1);
  check('loser has 0 point', byId.B.points === 0 && byId.B.lost === 1);
  check('draw gives 1 point each', byId.C.points === 1 && byId.D.points === 1);
  check('draw counted for both', byId.C.drawn === 1 && byId.D.drawn === 1);
}

console.log('\n2) Goal difference tiebreak (same points)');
{
  const teams = [team('E'), team('F'), team('G'), team('H')];
  // E wins 1-0 (3 pts, GD +1); F wins 2-0 (3 pts, GD +2) -> F first.
  const matches = [match('E', 'G', 1, 0), match('F', 'H', 2, 0)];
  const rows = calculateStandings(teams, matches, S);
  check('better GD ranks first', rows[0].team_id === 'F' && rows[1].team_id === 'E');
}

console.log('\n3) Goals scored tiebreak (same points, same GD)');
{
  const teams = [team('E'), team('F'), team('G'), team('H')];
  // E: 3pts, GD +1, GF 2 ; F: 3pts, GD +1, GF 1 -> E first.
  const matches = [match('E', 'G', 2, 1), match('F', 'H', 1, 0)];
  const rows = calculateStandings(teams, matches, S);
  check('more goals scored ranks first', rows[0].team_id === 'E');
}

console.log('\n4) Name tiebreak (identical records)');
{
  const teams = [team('Zeta'), team('Alpha')];
  const matches = [match('Zeta', 'Alpha', 1, 1)];
  const rows = calculateStandings(teams, matches, S);
  check('alphabetical order when identical', rows[0].name === 'Alpha' && rows[1].name === 'Zeta');
}

console.log('\n5) Teams with no matches appear with zeros');
{
  const teams = [team('A'), team('B'), team('Lonely')];
  // 0-0 draw keeps B and "Lonely" level on points AND goal difference,
  // so the name tiebreak decides: A, B, Lonely.
  const rows = calculateStandings(teams, [match('A', 'B', 0, 0)], S);
  const lonely = rows.find((r) => r.team_id === 'Lonely');
  check('no-match team present', Boolean(lonely));
  check('no-match team all zeros', lonely.played === 0 && lonely.points === 0 && lonely.goal_diff === 0);
  check('no-match team ranked last (name tiebreak)', rows[rows.length - 1].team_id === 'Lonely');
}

console.log('\n6) Non-finished statuses never count');
{
  const teams = [team('A'), team('B')];
  const matches = [
    match('A', 'B', 5, 0, 'scheduled'),
    match('A', 'B', 5, 0, 'live'),
    match('A', 'B', 5, 0, 'postponed'),
    match('A', 'B', 5, 0, 'cancelled'),
  ];
  const rows = calculateStandings(teams, matches, S);
  check('nothing counted', rows.every((r) => r.played === 0 && r.points === 0));
}

console.log('\n7) Status change finished -> postponed removes the result');
{
  const teams = [team('A'), team('B')];
  const before = calculateStandings(teams, [match('A', 'B', 2, 0)], S);
  const after = calculateStandings(
    teams,
    [{ ...match('A', 'B', 2, 0), status: 'postponed' }],
    S
  );
  check('match counted when finished', before[0].played === 1 && before[0].points === 3);
  check('match ignored once postponed', after[0].played === 0 && after[0].points === 0);
}

console.log('\n8) Defensive guard: invalid scores ignored');
{
  const teams = [team('A'), team('B')];
  const rows = calculateStandings(
    teams,
    [match('A', 'B', null, 0), match('A', 'B', -1, 0), match('A', 'B', 1.5, 0)],
    S
  );
  check('null / negative / decimal scores ignored', rows.every((r) => r.played === 0));
}

console.log('\n9) Empty inputs');
{
  check('no teams -> empty table', calculateStandings([], [match('A', 'B', 1, 0)], S).length === 0);
  check('no matches -> zero rows', calculateStandings([team('A'), team('B')], [], S)[0].points === 0);
}

// ---------------------------------------------------------------------------
console.log('\n10) validateMatch');
{
  const base = {
    home_team_id: 'A',
    away_team_id: 'B',
    kickoff_at: '2026-03-14T16:00:00.000Z',
    status: 'scheduled',
    home_score: null,
    away_score: null,
  };
  check('valid scheduled match passes', validateMatch(base).valid);
  check('team vs itself rejected', validateMatch({ ...base, away_team_id: 'A' }).errors.teams === 'validation.sameTeams');
  check('missing teams rejected', validateMatch({ ...base, home_team_id: '', away_team_id: '' }).errors.teams === 'validation.selectTeams');
  check('invalid date rejected', validateMatch({ ...base, kickoff_at: 'not-a-date' }).errors.kickoff_at === 'validation.invalidDate');
  check('negative score rejected', validateMatch({ ...base, status: 'finished', home_score: -1, away_score: 0 }).errors.scores === 'validation.invalidScore');
  check('decimal score rejected', validateMatch({ ...base, status: 'finished', home_score: 1.5, away_score: 0 }).errors.scores === 'validation.invalidScore');
  check('finished without scores rejected', validateMatch({ ...base, status: 'finished' }).errors.scores === 'validation.scoresRequired');
  check('live requires scores', validateMatch({ ...base, status: 'live' }).errors.scores === 'validation.scoresRequired');
  check('one score only rejected', validateMatch({ ...base, status: 'scheduled', home_score: 2 }).errors.scores === 'validation.scoresBoth');
  check('valid finished match passes', validateMatch({ ...base, status: 'finished', home_score: 2, away_score: 3 }).valid);
  check('zero scores allowed', validateMatch({ ...base, status: 'finished', home_score: 0, away_score: 0 }).valid);
}

console.log('\n11) validateTeam');
{
  check('valid team passes', validateTeam({ name: 'Génie Électrique', short_name: 'GEL', logo_url: '' }).valid);
  check('name too short rejected', validateTeam({ name: 'A', short_name: 'GEL' }).errors.name === 'validation.teamName');
  check('short name too long rejected', validateTeam({ name: 'Team X', short_name: 'TOOLONG' }).errors.short_name === 'validation.shortName');
  check('bad logo url rejected', validateTeam({ name: 'Team X', short_name: 'TX', logo_url: 'ftp://x' }).errors.logo_url === 'validation.logoUrl');
}

// ---------------------------------------------------------------------------
console.log('\n12) computeStats');
{
  const teams = [team('A'), team('B'), team('C')];
  const matches = [
    match('A', 'B', 2, 1),
    match('B', 'C', 0, 0),
    match('C', 'A', 1, 4),
    match('A', 'B', 1, 1, 'scheduled'),
    match('B', 'C', 0, 0, 'live'),
    match('C', 'A', 0, 0, 'postponed'),
  ];
  const stats = computeStats(teams, matches);
  check('team count', stats.teamCount === 3);
  check('total matches', stats.totalMatches === 6);
  check('finished count', stats.finishedCount === 3);
  check('upcoming count', stats.upcomingCount === 1);
  check('live count', stats.liveCount === 1);
  check('postponed count', stats.postponedCount === 1);
  check('total goals only from finished', stats.totalGoals === 2 + 1 + 0 + 0 + 1 + 4);
  check('average goals', stats.avgGoals === Math.round(((2 + 1 + 0 + 0 + 1 + 4) / 3) * 100) / 100);
  check('best attack', stats.bestAttack.team.id === 'A' && stats.bestAttack.goals === 6);
  // A and B are tied on goals against (2 each); alphabetical tiebreak picks A.
  check('best defense (tie broken by name)', stats.bestDefense.team.id === 'A' && stats.bestDefense.goalsAgainst === 2);
  check('best goal difference', stats.bestDiff.team.id === 'A' && stats.bestDiff.diff === 4);
  check('empty data safe', computeStats([], []).finishedCount === 0);
}

// ---------------------------------------------------------------------------
console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
