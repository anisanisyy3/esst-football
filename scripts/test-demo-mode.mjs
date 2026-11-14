// ============================================================================
// DEMO MODE INTEGRITY TEST
// Verifies that demoService implements EVERY method the dataService facade
// can call in demo mode (the bug that broke the home page and the admin
// dashboard in the portable build), and that key flows work end-to-end.
// Run: node scripts/test-demo-mode.mjs
// ============================================================================
import assert from 'node:assert/strict';

// Minimal localStorage/sessionStorage/window shims so demoService can load.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const sess = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sess.has(k) ? sess.get(k) : null),
  setItem: (k, v) => sess.set(k, String(v)),
  removeItem: (k) => sess.delete(k),
  clear: () => sess.clear(),
};
globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
globalThis.document = { dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

const { demoService } = await import('../src/services/demoService.js');
const { dataService } = await import('../src/services/dataService.js');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✘ ${name}: ${err.message}`);
  }
}

// --- 1. Facade surface completeness ----------------------------------------
const requiredMethods = [
  'getSettings', 'updateSettings',
  'listTeams', 'getTeam', 'createTeam', 'updateTeam', 'deleteTeam',
  'listMatches', 'getMatch', 'createMatch', 'updateMatch', 'deleteMatch',
  'listAuditLogs', 'listManagers', 'changeManagerRole', 'updateMyProfile',
  'listMembers', 'getProfileById', 'updateProfile',
  'listTeamMemberships', 'myMembership',
  'listJoinRequests', 'requestJoinTeam', 'decideJoinRequest',
  'listTeamCreationRequests', 'requestTeamCreation', 'approveTeamCreation',
  'listTransfers', 'requestTransfer', 'captainApproveTransfer', 'finalizeTransfer',
  'listStaffRequests', 'submitStaffRequest', 'reviewStaffRequest',
  'getLineup', 'saveLineup', 'markMatchLive',
  'getMatchEvents', 'getMatchReport', 'submitMatchReport', 'correctMatchReport',
  'getAppearances', 'getAppearancesByPlayer', 'getOvrLedger', 'getSuspensions',
  'suspendedIdsForMatch', 'listNotifications', 'markNotificationRead',
  'addNotification', 'listTeamPosts', 'addTeamPost', 'deleteTeamPost',
  'fetchPlayerRecords',
];
console.log('=== DEMO FACADE SURFACE ===');
check('demoService implements every facade method', () => {
  const missing = requiredMethods.filter((m) => typeof demoService[m] !== 'function');
  assert.deepEqual(missing, [], `missing: ${missing.join(', ')}`);
});

// --- 2. Public reads work without a session ---------------------------------
console.log('=== PUBLIC READS (no session) ===');
let teams;
check('listTeams returns the seeded teams', () => {
  teams = dataService.listTeams();
  assert.equal(teams.length, 8);
  assert.ok(teams[0].name);
});
check('listMatches returns seeded matches', () => {
  const matches = dataService.listMatches();
  assert.ok(matches.length >= 13);
});
check('getSettings returns seeded settings', () => {
  const s = dataService.getSettings();
  assert.equal(s.points_for_win, 3);
});

// --- 3. Auth + role-gated actions -------------------------------------------
console.log('=== AUTH + ROLES ===');
check('demo login as super admin works', () => {
  const session = demoService.loginDemo('super_admin');
  assert.equal(session.profile.role, 'super_admin');
});
check('super admin can update settings', () => {
  const s = dataService.updateSettings({ points_for_win: 3 });
  assert.equal(s.points_for_win, 3);
});
check('super admin can create and archive a team', () => {
  const team = dataService.createTeam({ name: 'Test Team AA', short_name: 'TAA' });
  assert.ok(team.id);
  const updated = dataService.updateTeam(team.id, { archived: true });
  assert.equal(updated.archived, true);
  dataService.deleteTeam(team.id); // no matches -> deletable
});
check('changeManagerRole guards: own role blocked, promote/demote others ok', () => {
  const me = demoService.getDemoSession();
  assert.throws(() => dataService.changeManagerRole(me.user.id, 'member'), /CANNOT_CHANGE_YOUR_OWN_ROLE/);
  const manager = demoService.loadDb().profiles.find((p) => p.role === 'score_manager');
  // Promote the manager to super admin, then demote again: both allowed.
  dataService.changeManagerRole(manager.id, 'super_admin');
  const again = demoService.loadDb().profiles.find((p) => p.id === manager.id);
  assert.equal(again.role, 'super_admin');
  dataService.changeManagerRole(manager.id, 'score_manager');
  assert.equal(demoService.loadDb().profiles.find((p) => p.id === manager.id).role, 'score_manager');
  // Note: the LAST_SUPER_ADMIN guard in changeManagerRole is defense in depth:
  // with a single super admin the only caller IS that admin, so the own-role
  // guard always fires first. The SQL function keeps the extra protection.
});
check('super admin can create/patch/delete a match', () => {
  const [t1, t2] = dataService.listTeams();
  const kickoff = new Date(Date.now() + 86400000).toISOString();
  const m = dataService.createMatch({ home_team_id: t1.id, away_team_id: t2.id, kickoff_at: kickoff, venue: 'X', round_name: 'R', status: 'scheduled', home_score: null, away_score: null });
  const updated = dataService.updateMatch(m.id, { status: 'live', home_score: 1, away_score: 0 });
  assert.equal(updated.status, 'live');
  // live/finished always require both scores (a scoreless match cannot go live)
  const m2 = dataService.createMatch({ home_team_id: t1.id, away_team_id: t2.id, kickoff_at: kickoff, venue: null, round_name: null, status: 'scheduled', home_score: null, away_score: null });
  assert.throws(() => dataService.updateMatch(m2.id, { status: 'live' }), /SCORES_REQUIRED/);
  dataService.deleteMatch(m.id);
  dataService.deleteMatch(m2.id);
  assert.equal(dataService.getMatch(m.id), null);
});

// --- 4. Self-recursion guards (the myTeam stack-overflow bug) ---------------
console.log('=== RECURSION GUARDS ===');
check('listTeamPosts does not recurse', () => {
  const posts = dataService.listTeamPosts('t1');
  assert.ok(Array.isArray(posts));
});
check('listNotifications does not recurse', () => {
  const n = dataService.listNotifications();
  assert.ok(Array.isArray(n));
});
check('addTeamPost works for a team member (own team only)', () => {
  demoService.loginDemo('member'); // demo-member is in t2
  const post = dataService.addTeamPost('t2', 'Title', 'Hello team');
  assert.equal(post.title, 'Title');
  const posts = dataService.listTeamPosts('t2');
  assert.ok(posts.some((p) => p.id === post.id));
  assert.throws(() => dataService.addTeamPost('t1', 'X', 'nope'), /NOT_AUTHENTICATED|FORBIDDEN/);
});
check('deleteTeamPost: own post ok, foreign post refused', () => {
  demoService.loginDemo('member');
  const post = dataService.addTeamPost('t2', 'T', 'b');
  dataService.deleteTeamPost(post.id);
  assert.equal(dataService.listTeamPosts('t2').some((p) => p.id === post.id), false);
  const foreign = dataService.addTeamPost('t2', 'T2', 'b2');
  demoService.loginDemo('captain'); // captain of t1, not t2
  assert.throws(() => dataService.deleteTeamPost(foreign.id), /FORBIDDEN/);
  demoService.loginDemo('super_admin');
  dataService.deleteTeamPost(foreign.id); // admin can moderate
});

// --- 5. Report pipeline in demo mode ----------------------------------------
console.log('=== REPORT PIPELINE (demo) ===');
check('captain can save a valid lineup for the live match', () => {
  demoService.loginDemo('captain'); // seeded as the real captain of t1
  const match = dataService.listMatches().find((m) => m.status === 'live');
  const roster = dataService.listTeamMemberships('t1').map((r) => ({ player_id: r.player_id, jersey_number: r.jersey_number }));
  const positions = ['goalkeeper', 'defender', 'defender', 'defender', 'defender', 'midfielder', 'midfielder', 'midfielder', 'forward', 'forward', 'forward'];
  const players = roster.slice(0, 11).map((r, i) => ({
    player_id: r.player_id,
    is_starter: true,
    match_position: positions[i] ?? 'midfielder',
    jersey_number: r.jersey_number,
    is_captain: i === 0,
    is_vice_captain: false,
  }));
  demoService.saveLineup({ matchId: match.id, teamId: 't1', formation: '4-3-3', captainId: players[0].player_id, viceCaptainId: null, tactics: 'Press high', players });
  const lu = dataService.getLineup(match.id, 't1');
  assert.equal(lu.players.filter((p) => p.is_starter).length, 11);
});
check('lineup validation rejects 10 starters and 8 subs', () => {
  const match = dataService.listMatches().find((m) => m.status === 'scheduled');
  const roster = dataService.listTeamMemberships('t1').map((r) => ({ player_id: r.player_id, jersey_number: r.jersey_number }));
  const short = roster.slice(0, 10).map((r, i) => ({
    player_id: r.player_id, is_starter: true, match_position: i === 0 ? 'goalkeeper' : 'defender',
    jersey_number: r.jersey_number, is_captain: i === 0, is_vice_captain: false,
  }));
  assert.throws(
    () => demoService.saveLineup({ matchId: match.id, teamId: 't1', formation: '4-4-2', captainId: short[0].player_id, viceCaptainId: null, tactics: null, players: short }),
    /INVALID_LINEUP/
  );
});
check('score manager can submit a report; score/OVR/standings update', () => {
  demoService.loginDemo('score_manager');
  const match = dataService.listMatches().find((m) => m.status === 'live');
  const lineup = dataService.getLineup(match.id, 't1');
  const scorer = lineup.players.find((p) => p.is_starter && p.match_position === 'forward').player_id;
  // Own goal credited to t1 -> responsible player belongs to the OPPONENT (t3).
  const opponentRoster = dataService.listTeamMemberships(match.home_team_id);
  const events2 = [
    { event_type: 'goal', minute: 10, team_id: 't1', player_id: scorer, related_player_id: null, detail: null },
    { event_type: 'goal', minute: 45, extra_minute: 2, team_id: 't1', player_id: opponentRoster[0].player_id, related_player_id: null, detail: 'own_goal' },
    { event_type: 'yellow', minute: 60, team_id: 't1', player_id: scorer, related_player_id: null, detail: null },
  ];
  const res = dataService.submitMatchReport({ matchId: match.id, events: events2, summary: 'Test match', refereeHome: 0, refereeAway: 2 });
  assert.equal(res.homeScore, 0);
  assert.equal(res.awayScore, 2);
  const finished = dataService.getMatch(match.id);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.home_score, 0);
  assert.equal(finished.away_score, 2);
  const apps = dataService.getAppearances(match.id);
  assert.equal(apps.length, 11); // only t1 had a lineup -> 11 starters
  const ledger = dataService.getOvrLedger(scorer);
  assert.ok(ledger.some((l) => l.reason === 'goal' && l.delta === 2));
  assert.ok(ledger.some((l) => l.reason === 'yellow' && l.delta === -1));
  // own-goal player receives NO goal bonus
  const ogPlayer = opponentRoster[0].player_id;
  assert.equal(dataService.getOvrLedger(ogPlayer).some((l) => l.reason === 'goal'), false);
});
check('correctMatchReport resets derived data (no double counting)', () => {
  demoService.loginDemo('super_admin');
  const match = dataService.listMatches().find((m) => m.status === 'finished');
  dataService.correctMatchReport(match.id, 're-check events');
  assert.equal(dataService.getMatchEvents(match.id).length, 0);
  assert.equal(dataService.getMatch(match.id).status, 'live');
});

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
