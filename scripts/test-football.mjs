// ============================================================================
// FOOTBALL CORE TESTS - run with:  npm test  (third part)
// Pins down the official rules: OVR engine (all section-11 examples),
// match events / own goals / stoppage time, appearances, conceded-goal
// intervals, red-card suspensions and lineup validation.
// Pure functions only: runs in Node, no browser needed.
// ============================================================================

import { computeAppearances, goalsConcededWhileOnPitch, computeCareerStats } from '../src/utils/career.js';
import { computeMatchOvrRows, computeAllMatchOvr, recomputeOvrHistory, clampOvr } from '../src/utils/ovr.js';
import { validateMatchEvents, deriveScore, sortEvents, minuteKey } from '../src/utils/matchEvents.js';
import { validateLineupInput } from '../src/utils/lineup.js';
import { computePlayerSuspensions, suspendedPlayerIdsForMatch } from '../src/utils/suspensions.js';
import { OVR_START, OVR_MIN, OVR_MAX } from '../src/utils/positions.js';

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

// --- fixture helpers ---------------------------------------------------------

const H = 'teamH';
const A = 'teamA';

function matchEvt({ id, type, detail = null, minute, extra = null, team, player, assist = null }) {
  return {
    id,
    event_type: type,
    detail,
    minute,
    extra_minute: extra,
    team_id: team,
    player_id: player,
    related_player_id: assist,
  };
}

function mkMatch(id, { hs, as: asScore, home = H, away = A, kickoff = '2026-01-01T15:00:00Z' }) {
  return { id, home_team_id: home, away_team_id: away, home_score: hs, away_score: asScore, kickoff_at: kickoff, status: 'finished' };
}

function appOf({ player, team = H, position, entry = 0, exit = null }) {
  const exitV = exit ?? 90 * 100;
  return { player_id: player, team_id: team, match_position: position, entry_minute: entry, exit_minute: exitV, minutes_played: Math.round((exitV - entry) / 100) };
}

function ovrFor(match, appearance, events) {
  return computeMatchOvrRows({ player: { id: appearance.player_id }, appearance, match, events });
}

function totalOf(match, appearance, events) {
  return ovrFor(match, appearance, events).total;
}

// ============================================================================
console.log('\n=== OVR: the official section-11 examples ===');

// Example 1 - Midfielder appears in a win, scores one goal, no cards: +3 -> 63.
{
  const m = mkMatch('m1', { hs: 3, as: 1 });
  const events = [matchEvt({ id: 'g1', type: 'goal', minute: 20, team: H, player: 'p1' })];
  const a = appOf({ player: 'p1', position: 'midfielder' });
  const { rows, total } = ovrFor(m, a, events);
  check('MF win + goal total is +3', total === 3);
  check('MF gets NO appearance bonus', !rows.some((r) => r.reason === 'appearance'));
  const hist = recomputeOvrHistory([{ match_id: 'm1', kickoff_at: m.kickoff_at, rows }]);
  check('60 becomes 63', hist.current === 63 && hist.start === OVR_START);
}

// Example 2 - Defender in a 4-goal-margin win, 0 conceded, no goal/cards: +5 -> 65.
{
  const m = mkMatch('m2', { hs: 4, as: 0 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 10, team: H, player: 'fw1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 30, team: H, player: 'fw2' }),
    matchEvt({ id: 'g3', type: 'goal', minute: 60, team: H, player: 'fw1' }),
    matchEvt({ id: 'g4', type: 'goal', minute: 80, team: H, player: 'fw2' }),
  ];
  const a = appOf({ player: 'df1', position: 'defender' });
  const { rows, total } = ovrFor(m, a, events);
  check('DF 4-goal win total is +5', total === 5);
  const reasons = rows.map((r) => r.reason).sort().join(',');
  check('DF rows = appearance, conceded(none), win, win_margin', reasons === 'appearance,win,win_margin');
  check('win_margin for 4+ is +2', rows.find((r) => r.reason === 'win_margin').delta === 2);
  check('60 becomes 65', recomputeOvrHistory([{ match_id: 'm2', kickoff_at: m.kickoff_at, rows }]).current === 65);
}

// Example 3 - Defender in a 3-goal-margin win conceding 1 while playing: +3.
{
  const m = mkMatch('m3', { hs: 3, as: 1 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 10, team: H, player: 'fw1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 30, team: H, player: 'fw1' }),
    matchEvt({ id: 'g3', type: 'goal', minute: 50, team: H, player: 'fw2' }),
    matchEvt({ id: 'g4', type: 'goal', minute: 70, team: A, player: 'af1' }),
  ];
  const a = appOf({ player: 'df1', position: 'defender' });
  const { rows, total } = ovrFor(m, a, events);
  check('DF 3-goal win conceding 1 total is +3', total === 3);
  check('win_margin for 3 is +1', rows.find((r) => r.reason === 'win_margin').delta === 1);
  check('exactly one conceded row of -1', rows.filter((r) => r.reason === 'conceded').length === 1);
}

// Example 4 - Goalkeeper full match in a 2-0 win: +4.
{
  const m = mkMatch('m4', { hs: 2, as: 0 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 20, team: H, player: 'fw1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 70, team: H, player: 'fw2' }),
  ];
  const a = appOf({ player: 'gk1', position: 'goalkeeper' });
  const { rows, total } = ovrFor(m, a, events);
  check('GK clean 2-0 win total is +4', total === 4);
  check('GK gets clean_sheet +1', rows.some((r) => r.reason === 'clean_sheet' && r.delta === 1));
  check('GK gets NO win-margin bonus', !rows.some((r) => r.reason === 'win_margin'));
}

// Example 5 - Goalkeeper in a 1-2 loss conceding two while on pitch: -1.
{
  const m = mkMatch('m5', { hs: 1, as: 2 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 15, team: A, player: 'af1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 60, team: A, player: 'af1' }),
    matchEvt({ id: 'g3', type: 'goal', minute: 85, team: H, player: 'fw1' }),
  ];
  const a = appOf({ player: 'gk1', position: 'goalkeeper' });
  const { total } = ovrFor(m, a, events);
  check('GK 1-2 loss conceding 2 total is -1', total === -1);
}

// Example 6 - Yellow card during a win: +1 -1 = 0.
{
  const m = mkMatch('m6', { hs: 2, as: 0 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 10, team: H, player: 'fw1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 80, team: H, player: 'fw1' }),
    matchEvt({ id: 'y1', type: 'yellow', minute: 55, team: H, player: 'p1' }),
  ];
  const a = appOf({ player: 'p1', position: 'midfielder' });
  check('yellow in a win totals 0', totalOf(m, a, events) === 0);
}

// Example 7 - Red card during a draw: 0 -2 = -2, plus one-match suspension.
{
  const m = mkMatch('m7', { hs: 1, as: 1 });
  const events = [matchEvt({ id: 'r1', type: 'red', minute: 70, team: H, player: 'p1' })];
  const a = appOf({ player: 'p1', position: 'forward', exit: 70 * 100 });
  const { rows, total } = ovrFor(m, a, events);
  check('red in a draw totals -2', total === -2);
  check('red row is -2', rows.find((r) => r.reason === 'red')?.delta === -2);
  const teamMatches = [
    { id: 'm7', kickoff_at: '2026-01-01T15:00:00Z', status: 'finished' },
    { id: 'm8', kickoff_at: '2026-01-08T15:00:00Z', status: 'scheduled' },
  ];
  const blocked = suspendedPlayerIdsForMatch(
    { id: 'm8', kickoff_at: teamMatches[1].kickoff_at, status: 'scheduled' },
    new Map([['p1', [{ match_id: 'm7', kickoff_at: teamMatches[0].kickoff_at }]]]),
    teamMatches,
    new Map()
  );
  check('red card blocks the NEXT official match', blocked.has('p1'));
}

// Example 8 - Unused substitute: nothing at all.
{
  const m = mkMatch('m8', { hs: 3, as: 0 });
  const { rows, total } = computeMatchOvrRows({ player: { id: 'sub1' }, appearance: null, match: m, events: [] });
  check('unused sub has no rows', rows.length === 0 && total === 0);
  const hist = recomputeOvrHistory([{ match_id: 'm8', kickoff_at: m.kickoff_at, rows }]);
  check('unused sub OVR unchanged (60)', hist.current === 60);
}

// ============================================================================
console.log('\n=== OVR: clamps, caps and floors ===');
{
  // Cap at 99: +45 then +3 then -1.
  const big = { match_id: 'c1', kickoff_at: '2026-01-01T00:00:00Z', rows: [{ reason: 'win', delta: 45 }] };
  const more = { match_id: 'c2', kickoff_at: '2026-01-08T00:00:00Z', rows: [{ reason: 'win', delta: 3 }] };
  const down = { match_id: 'c3', kickoff_at: '2026-01-15T00:00:00Z', rows: [{ reason: 'loss', delta: -1 }] };
  const hist = recomputeOvrHistory([big, more, down]);
  check('clamped to 99 at the cap', hist.perMatch[0].after === OVR_MAX);
  check('no further increase while at 99', hist.perMatch[1].after === 99);
  check('later negative match reduces from 99', hist.current === 98);
}
{
  // Floor at 50: -20 then -5 then +2.
  const crash = { match_id: 'f1', kickoff_at: '2026-01-01T00:00:00Z', rows: [{ reason: 'loss', delta: -20 }] };
  const again = { match_id: 'f2', kickoff_at: '2026-01-08T00:00:00Z', rows: [{ reason: 'loss', delta: -5 }] };
  const back = { match_id: 'f3', kickoff_at: '2026-01-15T00:00:00Z', rows: [{ reason: 'win', delta: 2 }] };
  const hist = recomputeOvrHistory([crash, again, back]);
  check('clamped to 50 at the floor', hist.perMatch[0].after === OVR_MIN);
  check('no further decrease while at 50', hist.perMatch[1].after === 50);
  check('later positive match raises from 50', hist.current === 52);
}
check('clampOvr helper', clampOvr(120) === 99 && clampOvr(3) === 50 && clampOvr(75) === 75);

// ============================================================================
console.log('\n=== OVR: own goals, penalties, position specifics ===');
{
  // Own goal: credited to the opponent; responsible player gets NO goal bonus.
  const m = mkMatch('og1', { hs: 1, as: 0 });
  const events = [matchEvt({ id: 'og', type: 'goal', detail: 'own_goal', minute: 30, team: H, player: 'af1' })];
  check('own goal credited to benefiting team', deriveScore(events, H, A).homeScore === 1 && deriveScore(events, H, A).awayScore === 0);
  const aAf1 = appOf({ player: 'af1', team: A, position: 'defender' });
  const { rows } = ovrFor(m, aAf1, events);
  check('own-goal player gets NO goal bonus', !rows.some((r) => r.reason === 'goal'));
  // But the goal WAS conceded by his team while he was on pitch (explicit rule).
  check('own goal counts as conceded for the suffering defender', rows.some((r) => r.reason === 'conceded'));
  check('own-goal defender total = -1 loss +2 app -1 conceded = 0', rows.reduce((s, r) => s + r.delta, 0) === 0);
}
{
  // Penalty counts as a goal (+2), no assist required.
  const m = mkMatch('pen1', { hs: 1, as: 0 });
  const events = [matchEvt({ id: 'p', type: 'goal', detail: 'penalty', minute: 44, team: H, player: 'fw1' })];
  const { rows, total } = ovrFor(m, appOf({ player: 'fw1', position: 'forward' }), events);
  check('penalty goal gives +2', rows.some((r) => r.reason === 'goal') && total === 3);
}
{
  // Defender: NO margin bonus on a 1-goal win.
  const m = mkMatch('w1', { hs: 2, as: 1 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 10, team: H, player: 'fw1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 40, team: A, player: 'af1' }),
    matchEvt({ id: 'g3', type: 'goal', minute: 80, team: H, player: 'fw2' }),
  ];
  const { rows } = ovrFor(m, appOf({ player: 'df1', position: 'defender' }), events);
  check('1-goal win: no win_margin for defender', !rows.some((r) => r.reason === 'win_margin'));
}
{
  // Midfielders/forwards never get conceded/clean-sheet/appearance rows.
  const m = mkMatch('mf1', { hs: 0, as: 2 });
  const events = [matchEvt({ id: 'g1', type: 'goal', minute: 10, team: A, player: 'af1' })];
  const mf = ovrFor(m, appOf({ player: 'm1', position: 'midfielder' }), events);
  const fw = ovrFor(m, appOf({ player: 'f1', position: 'forward' }), events);
  check('MF loss is -1 with nothing else', mf.rows.length === 1 && mf.rows[0].reason === 'loss' && mf.total === -1);
  check('FW loss is -1 with nothing else', fw.rows.length === 1 && fw.rows[0].reason === 'loss' && fw.total === -1);
}
{
  // Red card ends the player's pitch time: goals after are NOT his conceded.
  const m = mkMatch('rc1', { hs: 0, as: 3 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 50, team: A, player: 'af1' }),
    matchEvt({ id: 'r1', type: 'red', minute: 70, team: H, player: 'df1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 80, team: A, player: 'af1' }),
    matchEvt({ id: 'g3', type: 'goal', minute: 88, team: A, player: 'af1' }),
  ];
  const a = appOf({ player: 'df1', position: 'defender', exit: 70 * 100 });
  const conceded = goalsConcededWhileOnPitch(a, events, H);
  check('defender off at 70 concedes only pre-70 goals', conceded.length === 1);
  const { total } = ovrFor(m, a, events);
  check('red + 1 conceded = -1 -2 +2 -1 = -2', total === -2);
}
{
  // GK interval: entered at 60' - goals before entry do not count.
  const m = mkMatch('gk2', { hs: 2, as: 0 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 20, team: H, player: 'fw1' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 40, team: H, player: 'fw1' }),
  ];
  const subGk = appOf({ player: 'gk2', position: 'goalkeeper', entry: 60 * 100 });
  const { rows, total } = ovrFor(m, subGk, events);
  check('GK entering at 60 keeps a clean sheet', rows.some((r) => r.reason === 'clean_sheet') && total === 4);
}
{
  // Boundary rule (documented): intervals are half-open [entry, exit).
  // A goal AT the substitution minute is NOT conceded by the player going out
  // and IS conceded by the player coming in - one deterministic rule for the
  // ambiguous case, and the Score Manager can review the event order.
  const m = mkMatch('bd1', { hs: 0, as: 2 });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 60, team: A, player: 'af1' }),
    matchEvt({ id: 's1', type: 'sub', minute: 60, team: H, player: 'df1', assist: 'df2' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 80, team: A, player: 'af1' }),
  ];
  const offAt60 = appOf({ player: 'df1', position: 'defender', exit: 60 * 100 });
  const inAt60 = appOf({ player: 'df2', position: 'defender', entry: 60 * 100 });
  check('boundary: goal at 60 not conceded by player subbed off at 60', goalsConcededWhileOnPitch(offAt60, events, H).length === 0);
  check('boundary: incoming player owns goals at/after his entry minute', goalsConcededWhileOnPitch(inAt60, events, H).length === 2);
}

// ============================================================================
console.log('\n=== OVR: recompute determinism and corrections ===');
{
  const e1 = { match_id: 'm1', kickoff_at: '2026-01-01T00:00:00Z', rows: [{ reason: 'win', delta: 1 }, { reason: 'goal', delta: 2 }] };
  const e2 = { match_id: 'm2', kickoff_at: '2026-01-08T00:00:00Z', rows: [{ reason: 'win', delta: 1 }] };
  const a = recomputeOvrHistory([e1, e2]);
  const b = recomputeOvrHistory([e2, e1]); // different input order
  check('input order does not matter (deterministic)', a.current === b.current && a.current === 64);
  check('ledger follows chronological order', a.ledger[0].match_id === 'm1' && a.ledger[2].match_id === 'm2');

  // Correction: the goal in m1 is removed -> recompute from scratch.
  const e1corrected = { match_id: 'm1', kickoff_at: '2026-01-01T00:00:00Z', rows: [{ reason: 'win', delta: 1 }] };
  const corrected = recomputeOvrHistory([e1corrected, e2]);
  check('correction recomputes without double counting', corrected.current === 62);
  check('re-running the recompute is stable (idempotent)', recomputeOvrHistory([e1corrected, e2]).current === corrected.current);
}

// ============================================================================
console.log('\n=== FULL PIPELINE: events -> score -> appearances -> OVR -> career ===');
{
  // Lineups: h1 GK, h2-h4 DF, h5-h8 MF, h9-h11 FW (+ subs hs1 MF, hs2 FW).
  const homeLineup = {
    team_id: H,
    players: [
      { player_id: 'h1', is_starter: true, match_position: 'goalkeeper' },
      { player_id: 'h2', is_starter: true, match_position: 'defender' },
      { player_id: 'h3', is_starter: true, match_position: 'defender' },
      { player_id: 'h4', is_starter: true, match_position: 'defender' },
      { player_id: 'h5', is_starter: true, match_position: 'midfielder' },
      { player_id: 'h6', is_starter: true, match_position: 'midfielder' },
      { player_id: 'h7', is_starter: true, match_position: 'midfielder' },
      { player_id: 'h8', is_starter: true, match_position: 'midfielder' },
      { player_id: 'h9', is_starter: true, match_position: 'forward' },
      { player_id: 'h10', is_starter: true, match_position: 'forward' },
      { player_id: 'h11', is_starter: true, match_position: 'forward' },
      { player_id: 'hs1', is_starter: false, match_position: 'midfielder' },
      { player_id: 'hs2', is_starter: false, match_position: 'forward' },
    ],
  };
  const awayLineup = {
    team_id: A,
    players: [
      { player_id: 'a1', is_starter: true, match_position: 'goalkeeper' },
      { player_id: 'a2', is_starter: true, match_position: 'defender' },
      { player_id: 'a3', is_starter: true, match_position: 'defender' },
      { player_id: 'a4', is_starter: true, match_position: 'defender' },
      { player_id: 'a5', is_starter: true, match_position: 'midfielder' },
      { player_id: 'a6', is_starter: true, match_position: 'midfielder' },
      { player_id: 'a7', is_starter: true, match_position: 'midfielder' },
      { player_id: 'a8', is_starter: true, match_position: 'midfielder' },
      { player_id: 'a9', is_starter: true, match_position: 'forward' },
      { player_id: 'a10', is_starter: true, match_position: 'forward' },
      { player_id: 'a11', is_starter: true, match_position: 'forward' },
      { player_id: 'as1', is_starter: false, match_position: 'forward' },
    ],
  };

  const rawEvents = [
    matchEvt({ id: 'e1', type: 'goal', minute: 10, team: H, player: 'h5' }),
    matchEvt({ id: 'e2', type: 'goal', minute: 30, team: H, player: 'h9' }),
    matchEvt({ id: 'e3', type: 'goal', detail: 'own_goal', minute: 40, team: H, player: 'a9' }),
    matchEvt({ id: 'e4', type: 'yellow', minute: 35, team: H, player: 'h2' }),
    matchEvt({ id: 'e5', type: 'red', minute: 55, team: A, player: 'a3' }),
    matchEvt({ id: 'e6', type: 'sub', minute: 60, team: H, player: 'h8', assist: 'hs1' }),
    matchEvt({ id: 'e7', type: 'sub', minute: 65, team: A, player: 'a7', assist: 'as1' }),
    matchEvt({ id: 'e8', type: 'goal', minute: 75, team: A, player: 'a10' }),
  ];
  const rosters = {
    [H]: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11', 'hs1', 'hs2'],
    [A]: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'as1'],
  };
  const lineups = { [H]: rosters[H], [A]: rosters[A] };
  const report = validateMatchEvents(rawEvents, { homeTeamId: H, awayTeamId: A, rosters, lineups });
  check('full report is valid', report.valid === true);
  check('derived score 3-1 (own goal included)', report.homeScore === 3 && report.awayScore === 1);
  check('timeline sorted with subs after earlier goals', report.events.map((e) => e.id).join(',') === 'e1,e2,e4,e3,e5,e6,e7,e8');

  const m = { ...mkMatch('m1', { hs: 3, as: 1 }), home_score: report.homeScore, away_score: report.awayScore };
  const { appearances, endKey } = computeAppearances(homeLineup, awayLineup, report.events);
  check('24 appearances (22 starters + 2 subs used)', appearances.length === 24);
  check('end key is 90+00', endKey === 90 * 100);
  const mine = Object.fromEntries(appearances.map((a) => [a.player_id, a]));
  check('starter subbed off at 60', mine.h8.exit_minute === 6000 && mine.h8.minutes_played === 60);
  check('sub appears only from entry minute', mine.hs1.entry_minute === 6000 && mine.hs1.minutes_played === 30 && mine.hs1.is_starter === false);
  check('unused sub has NO appearance', mine.hs2 === undefined);
  check('red-carded player exits at the red minute', mine.a3.exit_minute === 5500);
  check('away sub enters at 65', mine.as1.entry_minute === 6500);

  const ovr = computeAllMatchOvr(m, appearances, report.events);
  check('MF scorer +3 (win + goal)', ovr.get('h5').total === 3);
  check('FW scorer +3', ovr.get('h9').total === 3);
  check('GK full match: +1 win +2 app -1 conceded = +2', ovr.get('h1').total === 2);
  check('DF with yellow: +1+2-1-1+1 = +2 (win_margin on 2-goal win)', ovr.get('h2').total === 2);
  check('own-goal responsible FW: only -1 loss', ovr.get('a9').total === -1 && !ovr.get('a9').rows.some((r) => r.reason === 'goal'));
  check('red-carded away DF: -1+2-2-3 = -4', ovr.get('a3').total === -4);
  check('away GK: -1+2-3 = -2 (own goal counts as conceded)', ovr.get('a1').total === -2);
  check('subbed-in player still gets the win', ovr.get('hs1').total === 1);

  // Two matches for h5 -> OVR history.
  const m2rows = [{ reason: 'win', delta: 1 }, { reason: 'goal', delta: 2 }];
  const hist = recomputeOvrHistory([
    { match_id: 'm1', kickoff_at: m.kickoff_at, rows: ovr.get('h5').rows },
    { match_id: 'm2', kickoff_at: '2026-01-08T15:00:00Z', rows: m2rows },
  ]);
  check('h5 OVR 60 -> 63 -> 66', hist.current === 66);

  // Career stats from the same official records.
  const career = computeCareerStats('h5', [
    { match: m, appearances, events: report.events },
    { match: { ...m, id: 'm2', kickoff_at: '2026-01-08T15:00:00Z', home_score: 2, away_score: 0 }, appearances: [{ ...mine.h5 }], events: [] },
  ]);
  check('career: 2 matches, 2 wins, 1 goal', career.matches_played === 2 && career.wins === 2 && career.goals === 1);

  // --- correction: remove h9's goal, rebuild everything ---------------------
  const correctedRaw = rawEvents.filter((e) => e.id !== 'e2');
  const corrected = validateMatchEvents(correctedRaw, { homeTeamId: H, awayTeamId: A, rosters, lineups });
  check('corrected score 2-1', corrected.homeScore === 2 && corrected.awayScore === 1);
  const mCorrected = { ...m, home_score: corrected.homeScore, away_score: corrected.awayScore };
  const { appearances: apps2 } = computeAppearances(homeLineup, awayLineup, corrected.events);
  const ovr2 = computeAllMatchOvr(mCorrected, apps2, corrected.events);
  check('corrected: h9 loses the goal bonus (now just +1 win)', ovr2.get('h9').total === 1);
  check('corrected: h5 unchanged', ovr2.get('h5').total === 3);
  const correctedRows = () => [
    { match_id: 'm1', kickoff_at: m.kickoff_at, rows: ovr2.get('h9').rows },
    { match_id: 'm2', kickoff_at: '2026-01-08T15:00:00Z', rows: [{ reason: 'win', delta: 1 }] },
  ];
  const hist2 = recomputeOvrHistory(correctedRows());
  check('corrected history: h9 60 -> 61 -> 62 (no double count)', hist2.current === 62);
  check('recompute twice -> same answer', recomputeOvrHistory(correctedRows()).current === 62);
}

// ============================================================================
console.log('\n=== MATCH EVENTS: stoppage time, duplicates, roster checks ===');
{
  const events = [
    matchEvt({ id: 'x1', type: 'goal', minute: 90, team: H, player: 'p1' }),
    matchEvt({ id: 'x2', type: 'goal', minute: 45, extra: 2, team: A, player: 'p2' }),
    matchEvt({ id: 'x3', type: 'goal', minute: 45, team: H, player: 'p3' }),
    matchEvt({ id: 'x4', type: 'goal', minute: 46, team: H, player: 'p4' }),
    matchEvt({ id: 'x5', type: 'goal', minute: 90, extra: 4, team: A, player: 'p5' }),
  ];
  sortEvents(events);
  check('stoppage: 45 < 45+2 < 46 < 90 < 90+4', events.map((e) => e.id).join(',') === 'x3,x2,x4,x1,x5');
  check('minuteKey math', minuteKey(45, 2) === 4502 && minuteKey(90, 4) === 9004);
}
{
  const rosters = { [H]: ['p1', 'p3'], [A]: ['p2'] };
  const bad = [
    matchEvt({ id: 'b1', type: 'goal', minute: 10, team: H, player: 'p2' }), // scorer not on H
    matchEvt({ id: 'b2', type: 'goal', detail: 'own_goal', minute: 20, team: H, player: 'p1' }), // own goal by H player but credited to H
    matchEvt({ id: 'b3', type: 'yellow', minute: 30, team: A, player: 'p1' }), // card for other team's player
    matchEvt({ id: 'b4', type: 'sub', minute: 40, team: H, player: 'p1', assist: 'p2' }), // sub with outside player
  ];
  const r = validateMatchEvents(bad, { homeTeamId: H, awayTeamId: A, rosters });
  check('roster violations rejected', r.valid === false && r.errors.length === 4);
  const dup = [
    matchEvt({ id: 'd1', type: 'goal', minute: 10, team: H, player: 'p1' }),
    matchEvt({ id: 'd2', type: 'goal', minute: 10, team: H, player: 'p1' }),
  ];
  const r2 = validateMatchEvents(dup, { homeTeamId: H, awayTeamId: A, rosters });
  check('duplicate events rejected', r2.valid === false && r2.errors.some((e) => e.startsWith('events.duplicate')));
  const selfAssist = [matchEvt({ id: 's1', type: 'goal', minute: 10, team: H, player: 'p1', assist: 'p1' })];
  const r3 = validateMatchEvents(selfAssist, { homeTeamId: H, awayTeamId: A, rosters });
  check('self-assist rejected', r3.valid === false && r3.errors.some((e) => e.startsWith('events.selfAssist')));
  const ownAssist = [matchEvt({ id: 'o1', type: 'goal', detail: 'own_goal', minute: 10, team: H, player: 'p2', assist: 'p3' })];
  const r4 = validateMatchEvents(ownAssist, { homeTeamId: H, awayTeamId: A, rosters });
  check('own goal never carries an assist', r4.valid === true && r4.events[0].related_player_id === null);
  const badMinute = [matchEvt({ id: 'm1', type: 'goal', minute: 200, team: H, player: 'p1' })];
  const r5 = validateMatchEvents(badMinute, { homeTeamId: H, awayTeamId: A, rosters });
  check('minute > 130 rejected', r5.valid === false && r5.errors.some((e) => e.startsWith('events.badMinute')));
  const validSub = [matchEvt({ id: 'v1', type: 'sub', minute: 60, team: H, player: 'p1', assist: 'p3' })];
  const r6 = validateMatchEvents(validSub, { homeTeamId: H, awayTeamId: A, rosters });
  check('valid substitution accepted', r6.valid === true);
}

// ============================================================================
console.log('\n=== APPEARANCES: entry/exit minutes and unused subs ===');
{
  const lineup = (team, prefix) => ({
    team_id: team,
    players: [
      ...Array.from({ length: 11 }, (_, i) => ({
        player_id: `${prefix}${i + 1}`,
        is_starter: true,
        match_position: i === 0 ? 'goalkeeper' : 'defender',
      })),
      { player_id: `${prefix}12`, is_starter: false, match_position: 'forward' },
    ],
  });
  const events = [
    matchEvt({ id: 'g1', type: 'goal', minute: 10, team: H, player: 'h1' }),
    matchEvt({ id: 's1', type: 'sub', minute: 60, team: H, player: 'h5', assist: 'h12' }),
    matchEvt({ id: 'g2', type: 'goal', minute: 80, team: H, player: 'h12' }),
    matchEvt({ id: 'r1', type: 'red', minute: 75, team: A, player: 'a7' }),
    matchEvt({ id: 'g3', type: 'goal', minute: 85, team: A, player: 'a1' }),
  ];
  const { appearances } = computeAppearances(lineup(H, 'h'), lineup(A, 'a'), events);
  const byId = Object.fromEntries(appearances.map((a) => [a.player_id, a]));
  check('11 home starters + 1 sub = 12 home appearances', appearances.filter((a) => a.team_id === H).length === 12);
  check('away red-carded player still has an appearance', byId.a7 !== undefined && byId.a7.exit_minute === 7500);
  check('sub who came in has an appearance', byId.h12.entry_minute === 6000);
  check('away unused sub has no appearance', byId.a12 === undefined);
  check('full-match starter played 90', byId.h1.minutes_played === 90);
  check('subbed-off starter played 60', byId.h5.minutes_played === 60);
  check('second-half sub played 30', byId.h12.minutes_played === 30);
  const m = mkMatch('ap1', { hs: 3, as: 1 });
  const career = computeCareerStats('h12', [{ match: m, appearances, events }]);
  check('career of the scoring sub: 1 match, 1 win, 1 goal', career.matches_played === 1 && career.wins === 1 && career.goals === 1);
  const careerUnused = computeCareerStats('h11x', [{ match: m, appearances, events }]);
  check('career of an absent player: nothing', careerUnused.matches_played === 0);
}

// ============================================================================
console.log('\n=== SUSPENSIONS: pending, served, yellow-only ===');
{
  const teamMatches = [
    { id: 'm1', kickoff_at: '2026-01-01T15:00:00Z', status: 'finished' },
    { id: 'm2', kickoff_at: '2026-01-08T15:00:00Z', status: 'finished' },
    { id: 'm3', kickoff_at: '2026-01-15T15:00:00Z', status: 'scheduled' },
  ];
  const cards = new Map([['p1', [{ match_id: 'm1', kickoff_at: teamMatches[0].kickoff_at }]]]);
  // m2 upcoming: p1 blocked.
  let blocked = suspendedPlayerIdsForMatch(teamMatches[1], cards, teamMatches, new Map());
  check('pending suspension blocks the target match', blocked.has('p1'));
  // After m2 finished WITHOUT p1 -> served.
  blocked = suspendedPlayerIdsForMatch(teamMatches[2], cards, teamMatches, new Map());
  check('suspension served after missing the match', !blocked.has('p1'));
  const records = computePlayerSuspensions('p1', cards.get('p1'), teamMatches, new Set());
  check('career record shows served', records[0].status === 'served' && records[0].target_match_id === 'm2');
  // Player who DID appear in m2 (should not normally happen) is eligible again.
  blocked = suspendedPlayerIdsForMatch(teamMatches[2], cards, teamMatches, new Map([['p1', new Set(['m2'])]]));
  check('lenient: appeared in target -> eligible later', !blocked.has('p1'));
  // Yellow-only player is never suspended.
  const noCards = new Map([['p9', []]]);
  blocked = suspendedPlayerIdsForMatch(teamMatches[1], noCards, teamMatches, new Map());
  check('yellow cards never suspend', !blocked.has('p9'));
}

// ============================================================================
console.log('\n=== LINEUP VALIDATION ===');
{
  const eligible = new Set(Array.from({ length: 30 }, (_, i) => `p${i + 1}`));
  const base = Array.from({ length: 18 }, (_, i) => ({
    player_id: `p${i + 1}`,
    jersey_number: i + 1,
    match_position: i === 0 ? 'goalkeeper' : i < 11 ? 'defender' : 'forward',
    is_starter: i < 11,
    is_captain: i === 0,
    is_vice_captain: i === 1,
  }));
  const ok = validateLineupInput({ formation: '4-3-3', players: base, eligiblePlayerIds: eligible, suspendedPlayerIds: [] });
  check('valid 11+7 lineup passes', ok.valid === true && ok.checked.starters === 11 && ok.checked.subs === 7);

  const ten = base.filter((_, i) => i !== 10);
  check('10 starters rejected', validateLineupInput({ formation: '4-3-3', players: ten, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.starters:10')));

  const eightSubs = [...base.slice(0, 11), ...Array.from({ length: 8 }, (_, i) => ({ player_id: `p${20 + i}`, jersey_number: 20 + i, match_position: 'forward', is_starter: false }))];
  check('8 substitutes rejected', validateLineupInput({ formation: '4-3-3', players: eightSubs, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.subs')));

  const dupe = base.map((p, i) => (i === 11 ? { ...p, player_id: 'p1' } : p));
  check('same player twice rejected', validateLineupInput({ formation: '4-3-3', players: dupe, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.duplicatePlayer')));

  const withSusp = base.map((p, i) => (i === 2 ? { ...p, player_id: 'susp1' } : p));
  const eligSusp = new Set([...eligible, 'susp1']);
  check('suspended player rejected', validateLineupInput({ formation: '4-3-3', players: withSusp, eligiblePlayerIds: eligSusp, suspendedPlayerIds: ['susp1'] }).errors.some((e) => e.startsWith('lineup.errors.suspended')));

  const outsider = base.map((p, i) => (i === 5 ? { ...p, player_id: 'outsider' } : p));
  check('player outside the roster rejected', validateLineupInput({ formation: '4-3-3', players: outsider, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.notEligible')));

  const twoCaptains = base.map((p, i) => (i === 5 ? { ...p, is_captain: true } : p));
  check('two captains rejected', validateLineupInput({ formation: '4-3-3', players: twoCaptains, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.captains:2')));

  const jerseyDupe = base.map((p, i) => (i === 5 ? { ...p, jersey_number: 1 } : p));
  check('duplicate jersey number rejected', validateLineupInput({ formation: '4-3-3', players: jerseyDupe, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.jerseyDupe')));

  const jerseyBad = base.map((p, i) => (i === 3 ? { ...p, jersey_number: 0 } : p));
  check('jersey 0 rejected', validateLineupInput({ formation: '4-3-3', players: jerseyBad, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.jerseyMissing')));

  const badPos = base.map((p, i) => (i === 4 ? { ...p, match_position: 'striker' } : p));
  check('unknown match position rejected', validateLineupInput({ formation: '4-3-3', players: badPos, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.badPosition')));

  check('unknown formation rejected', validateLineupInput({ formation: '1-9-9', players: base, eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.some((e) => e.startsWith('lineup.errors.badFormation')));
  check('empty lineup rejected', validateLineupInput({ formation: '4-3-3', players: [], eligiblePlayerIds: eligible, suspendedPlayerIds: [] }).errors.includes('lineup.errors.empty'));
}

// ---------------------------------------------------------------------------
console.log(`\n---\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
