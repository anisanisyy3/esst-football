// ============================================================================
// DEMO SERVICE (v2) - mirrors the new player/team/lineup/report/OVR features
// on top of localStorage. Used ONLY when Supabase env vars are missing.
// ============================================================================
import { computeAppearances } from '../utils/career.js';
import { computeAllMatchOvr, recomputeOvrHistory } from '../utils/ovr.js';
import { validateMatchEvents } from '../utils/matchEvents.js';
import { validateMatch } from '../utils/validation.js';
import { validateLineupInput } from '../utils/lineup.js';
import { suspendedPlayerIdsForMatch } from '../utils/suspensions.js';

const DB_KEY = 'esst_demo_db_v4';
const SESSION_KEY = 'esst_demo_session_v2';

const DAY = 86400000;
const HOUR = 3600000;

function seedDatabase() {
  const now = Date.now();
  const at = (offset) => new Date(now + offset).toISOString();
  const teams = [
    { id: 't1', name: 'Génie Électrique FC', short_name: 'GEL', logo_url: null, description: 'Équipe du département Génie Électrique.', archived: false, created_at: at(-30 * DAY), updated_at: at(-30 * DAY) },
    { id: 't2', name: 'Génie Mécanique United', short_name: 'GME', logo_url: null, description: 'Équipe du département Génie Mécanique.', archived: false, created_at: at(-30 * DAY), updated_at: at(-30 * DAY) },
    { id: 't3', name: 'Informatique Stars', short_name: 'INF', logo_url: null, description: 'Équipe du département Informatique.', archived: false, created_at: at(-29 * DAY), updated_at: at(-29 * DAY) },
    { id: 't4', name: 'Génie Civil Athletic', short_name: 'GCI', logo_url: null, description: 'Équipe du département Génie Civil.', archived: false, created_at: at(-29 * DAY), updated_at: at(-29 * DAY) },
    { id: 't5', name: 'Génie Industriel', short_name: 'GIN', logo_url: null, description: 'Équipe du département Génie Industriel.', archived: false, created_at: at(-28 * DAY), updated_at: at(-28 * DAY) },
    { id: 't6', name: 'Sciences Économiques', short_name: 'SEC', logo_url: null, description: 'Équipe du département Sciences Économiques.', archived: false, created_at: at(-28 * DAY), updated_at: at(-28 * DAY) },
    { id: 't7', name: 'Sciences Biologiques', short_name: 'BIO', logo_url: null, description: 'Équipe du département Sciences Biologiques.', archived: false, created_at: at(-27 * DAY), updated_at: at(-27 * DAY) },
    { id: 't8', name: 'IA & Data Science', short_name: 'IAD', logo_url: null, description: 'Équipe du département IA & Data Science.', archived: false, created_at: at(-27 * DAY), updated_at: at(-27 * DAY) },
  ];
  const m = (id, home, away, hs, as_, kickoff, status, round) => ({
    id, home_team_id: home, away_team_id: away,
    home_score: status === 'scheduled' || status === 'postponed' ? null : hs,
    away_score: status === 'scheduled' || status === 'postponed' ? null : as_,
    kickoff_at: kickoff, venue: 'Terrain central ESST', round_name: round,
    status, updated_by: 'demo-manager', created_at: at(-20 * DAY), updated_at: at(-1 * HOUR),
  });
  const matches = [
    m('m1', 't3', 't2', 3, 1, at(-9 * DAY), 'finished', 'Journée 1'),
    m('m2', 't4', 't7', 0, 0, at(-8 * DAY), 'finished', 'Journée 1'),
    m('m3', 't1', 't8', 2, 2, at(-7 * DAY), 'finished', 'Journée 2'),
    m('m4', 't6', 't3', 1, 4, at(-6 * DAY), 'finished', 'Journée 2'),
    m('m5', 't2', 't5', 2, 0, at(-5 * DAY), 'finished', 'Journée 3'),
    m('m6', 't7', 't6', 1, 1, at(-4 * DAY), 'finished', 'Journée 3'),
    m('m7', 't8', 't4', 2, 3, at(-3 * DAY), 'finished', 'Journée 4'),
    m('m8', 't5', 't1', 1, 1, at(-2 * DAY), 'finished', 'Journée 4'),
    m('m9', 't3', 't1', 2, 1, at(-1 * HOUR), 'live', 'Journée 5'),
    m('m10', 't2', 't7', null, null, at(2 * DAY + 7 * HOUR), 'scheduled', 'Journée 5'),
    m('m11', 't4', 't6', null, null, at(3 * DAY + 9 * HOUR), 'scheduled', 'Journée 6'),
    m('m12', 't8', 't5', null, null, at(5 * DAY + 7 * HOUR), 'scheduled', 'Journée 6'),
    m('m13', 't7', 't1', null, null, at(1 * DAY + 8 * HOUR), 'postponed', 'Journée 5'),
  ];
  const a = (id, matchId, oh, nh, oa, na, os_, ns) => ({
    id, match_id: matchId, old_home_score: oh, new_home_score: nh,
    old_away_score: oa, new_away_score: na, old_status: os_, new_status: ns,
    changed_by: 'demo-manager', changed_at: at(-1 * DAY),
  });
  const audit_logs = [
    a('a1', 'm8', 0, 1, 0, 1, 'live', 'finished'),
    a('a2', 'm7', 1, 2, 2, 3, 'live', 'finished'),
    a('a3', 'm9', 1, 2, 1, 1, 'live', 'live'),
  ];

  const positions = ['goalkeeper', 'defender', 'midfielder', 'forward'];
  const posPlan = { goalkeeper: 1, defender: 4, midfielder: 5, forward: 4 };
  const profiles = [
    { id: 'demo-super', email: 'superadmin@demo.esst', display_name: 'Super Admin (démo)', full_name: 'Super Admin Demo', birth_year: 1985, main_position: 'midfielder', preferred_foot: 'right', profile_complete: true, role: 'super_admin', ovr: 60, created_at: at(-30 * DAY) },
    { id: 'demo-manager', email: 'manager@demo.esst', display_name: 'Manager Résultats (démo)', full_name: 'Manager Demo', birth_year: 1990, main_position: 'midfielder', preferred_foot: 'right', profile_complete: true, role: 'score_manager', ovr: 60, created_at: at(-25 * DAY) },
    { id: 'demo-captain', email: 'captain@demo.esst', display_name: 'Capitaine Demo (démo)', full_name: 'Capitaine Demo', birth_year: 1998, main_position: 'midfielder', preferred_foot: 'right', profile_complete: true, role: 'member', ovr: 60, created_at: at(-20 * DAY) },
    { id: 'demo-member', email: 'member@demo.esst', display_name: 'Joueur Demo (démo)', full_name: 'Joueur Demo', birth_year: 2000, main_position: 'forward', preferred_foot: 'left', profile_complete: true, role: 'member', ovr: 60, created_at: at(-10 * DAY) },
  ];

  // Generate roster players for each team.
  const memberships = [];
  const teamRosterIds = {};
  for (const t of teams) {
    const ids = [];
    let counter = 1;
    for (const pos of positions) {
      for (let i = 0; i < posPlan[pos]; i++) {
        const pid = `${t.id}-p${counter}`;
        counter++;
        ids.push(pid);
        profiles.push({
          id: pid,
          email: `${pid}@demo.esst`,
          display_name: `${t.short_name} ${pos.slice(0, 2).toUpperCase()}${i + 1}`,
          full_name: `${t.name} Joueur ${counter}`,
          birth_year: 1998 + (counter % 6),
          main_position: pos,
          preferred_foot: counter % 3 === 0 ? 'left' : 'right',
          profile_complete: true,
          role: 'member',
          ovr: 60,
          created_at: at(-20 * DAY),
        });
        memberships.push({
          id: `mem-${pid}`,
          team_id: t.id,
          player_id: pid,
          status: 'active',
          role_in_team: 'player',
          jersey_number: counter,
          joined_at: at(-20 * DAY),
        });
      }
    }
    teamRosterIds[t.id] = ids;
  }
  // Make the demo captain the captain of t1 (the persona must be able to use
  // the captain tools: lineup editor, roster requests, team space moderation).
  const t1CaptainMember = memberships.find((m) => m.team_id === 't1' && m.player_id === 't1-p1');
  if (t1CaptainMember) t1CaptainMember.role_in_team = 'player';
  memberships.push({
    id: 'mem-demo-captain',
    team_id: 't1',
    player_id: 'demo-captain',
    status: 'active',
    role_in_team: 'captain',
    jersey_number: 99,
    joined_at: at(-15 * DAY),
  });
  memberships.push({
    id: 'mem-demo-member',
    team_id: 't2',
    player_id: 'demo-member',
    status: 'active',
    role_in_team: 'player',
    jersey_number: 7,
    joined_at: at(-8 * DAY),
  });

  return {
    settings: {
      id: 1,
      tournament_name: 'ESST Football Tournament',
      season_label: '2025 / 2026',
      timezone: 'Africa/Algiers',
      points_for_win: 3,
      points_for_draw: 1,
      points_for_loss: 0,
      substitutions_per_match: 5,
      updated_at: at(-30 * DAY),
    },
    teams, matches, audit_logs, profiles,
    staff_access_requests: [],
    team_memberships: memberships,
    team_join_requests: [],
    team_creation_requests: [],
    team_transfer_requests: [],
    match_lineups: [],
    lineup_players: [],
    match_events: [],
    match_reports: [],
    player_suspensions: [],
    player_match_appearances: [],
    player_ovr_ledger: [],
    team_posts: [],
    team_messages: [],
    notifications: [],
    teamRosterIds,
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.team_memberships) return db;
    }
  } catch { /* corrupted -> reseed */ }
  const db = seedDatabase();
  saveDb(db);
  return db;
}

function saveDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

function resetDb() {
  try {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

function uid() { return 'demo-' + Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }

function getDemoSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { userId } = JSON.parse(raw);
    const db = loadDb();
    const profile = db.profiles.find((p) => p.id === userId) || null;
    if (!profile) return null;
    return { user: { id: userId, email: profile.email }, profile };
  } catch { return null; }
}

function setDemoSession(userId) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId })); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent('esst-demo-auth'));
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  document.dispatchEvent(new CustomEvent('esst-demo-auth'));
}

function loginDemo(role) {
  const db = loadDb();
  const map = {
    super_admin: 'demo-super',
    score_manager: 'demo-manager',
    captain: 'demo-captain',
    member: 'demo-member',
  };
  const userId = map[role];
  if (!userId || !db.profiles.find((p) => p.id === userId)) throw new Error('UNKNOWN_DEMO_ROLE');
  setDemoSession(userId);
  return getDemoSession();
}

function signUpDemo({ email, password, displayName }) {
  const db = loadDb();
  const id = 'demo-user-' + Math.random().toString(36).slice(2, 8);
  const profile = {
    id, email, display_name: displayName || email.split('@')[0],
    full_name: null, birth_year: null, main_position: null, secondary_position: null,
    preferred_foot: null, height_cm: null, weight_kg: null, photo_url: null,
    nickname: null, profile_complete: false, role: 'member', ovr: 60, created_at: now(),
  };
  db.profiles.push(profile);
  saveDb(db);
  setDemoSession(id);
  return { user: { id, email }, profile };
}

function updateProfileDemo(fields) {
  const session = getDemoSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');
  const db = loadDb();
  const idx = db.profiles.findIndex((p) => p.id === session.user.id);
  if (idx < 0) throw new Error('PROFILE_NOT_FOUND');
  const allowed = ['full_name', 'birth_year', 'main_position', 'secondary_position', 'preferred_foot', 'height_cm', 'weight_kg', 'photo_url', 'nickname', 'profile_complete'];
  for (const k of allowed) {
    if (fields[k] !== undefined) db.profiles[idx][k] = fields[k];
  }
  // auto-complete flag
  const p = db.profiles[idx];
  p.profile_complete = !!(p.full_name && p.birth_year && p.main_position && p.preferred_foot);
  saveDb(db);
  setDemoSession(session.user.id);
  return db.profiles[idx];
}

function isCaptainOfDemo(teamId) {
  const session = getDemoSession();
  if (!session) return false;
  const db = loadDb();
  return db.team_memberships.some((m) => m.player_id === session.user.id && m.team_id === teamId && m.status === 'active' && m.role_in_team === 'captain');
}

function listMembers() {
  const db = loadDb();
  return db.profiles.filter((p) => p.role === 'member' || p.role === 'score_manager' || p.role === 'super_admin');
}

function getProfileById(id) {
  const db = loadDb();
  return db.profiles.find((p) => p.id === id) || null;
}

function listTeamMemberships(teamId) {
  const db = loadDb();
  return db.team_memberships.filter((m) => m.team_id === teamId && m.status === 'active');
}

function myMembership() {
  const session = getDemoSession();
  if (!session) return null;
  const db = loadDb();
  return db.team_memberships.find((m) => m.player_id === session.user.id && m.status === 'active') || null;
}

function requestJoinTeam(teamId, message) {
  const session = getDemoSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');
  const db = loadDb();
  if (db.team_memberships.some((m) => m.player_id === session.user.id && m.status === 'active')) throw new Error('ALREADY_IN_A_TEAM');
  const req = { id: uid(), team_id: teamId, player_id: session.user.id, message: message || null, status: 'pending', reviewed_by: null, reviewed_at: null, created_at: now() };
  db.team_join_requests.push(req);
  saveDb(db);
  return req;
}

function decideJoinRequest(requestId, accept, jerseyNumber) {
  const db = loadDb();
  const req = db.team_join_requests.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') throw new Error('REQUEST_NOT_FOUND');
  const session = getDemoSession();
  const isCaptain = db.team_memberships.some((m) => m.player_id === session?.user.id && m.team_id === req.team_id && m.status === 'active' && m.role_in_team === 'captain');
  if (!isCaptain && session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  if (accept) {
    const active = db.team_memberships.filter((m) => m.team_id === req.team_id && m.status === 'active').length;
    if (active >= 45) throw new Error('TEAM_FULL');
    if (db.team_memberships.some((m) => m.player_id === req.player_id && m.status === 'active')) throw new Error('ALREADY_IN_A_TEAM');
    req.status = 'accepted'; req.reviewed_by = session.user.id; req.reviewed_at = now();
    db.team_memberships.push({ id: uid(), team_id: req.team_id, player_id: req.player_id, status: 'active', role_in_team: 'player', jersey_number: jerseyNumber || null, joined_at: now() });
  } else {
    req.status = 'rejected'; req.reviewed_by = session?.user.id; req.reviewed_at = now();
  }
  saveDb(db);
  return req;
}

function requestTeamCreation({ name, shortName, description, logoUrl }) {
  const session = getDemoSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');
  const db = loadDb();
  const req = { id: uid(), requester_id: session.user.id, proposed_name: name, short_name: shortName, description, logo_url: logoUrl || null, status: 'pending', reviewed_by: null, reviewed_at: null, approved_team_id: null, created_at: now() };
  db.team_creation_requests.push(req);
  saveDb(db);
  return req;
}

function approveTeamCreation(requestId, approve) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  const req = db.team_creation_requests.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') throw new Error('REQUEST_NOT_FOUND');
  if (approve) {
    const team = { id: 't' + (db.teams.length + 1), name: req.proposed_name, short_name: req.short_name, logo_url: req.logo_url, description: req.description, archived: false, created_at: now(), updated_at: now() };
    db.teams.push(team);
    db.team_memberships.push({ id: uid(), team_id: team.id, player_id: req.requester_id, status: 'active', role_in_team: 'captain', jersey_number: null, joined_at: now() });
    req.status = 'approved'; req.reviewed_by = session.user.id; req.reviewed_at = now(); req.approved_team_id = team.id;
  } else {
    req.status = 'rejected'; req.reviewed_by = session.user.id; req.reviewed_at = now();
  }
  saveDb(db);
  return req;
}

function requestTransfer(fromTeamId, toTeamId, reason) {
  const session = getDemoSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');
  const db = loadDb();
  const req = { id: uid(), player_id: session.user.id, from_team_id: fromTeamId, to_team_id: toTeamId, reason, status: 'pending', captain_reviewed_by: null, captain_reviewed_at: null, final_approved_by: null, final_approved_at: null, created_at: now() };
  db.team_transfer_requests.push(req);
  saveDb(db);
  return req;
}

function captainApproveTransfer(requestId, accept) {
  const session = getDemoSession();
  const db = loadDb();
  const req = db.team_transfer_requests.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') throw new Error('REQUEST_NOT_FOUND');
  const isCaptain = db.team_memberships.some((m) => m.player_id === session?.user.id && m.team_id === req.to_team_id && m.status === 'active' && m.role_in_team === 'captain');
  if (!isCaptain && session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  if (accept) { req.status = 'captain_approved'; } else { req.status = 'rejected'; }
  req.captain_reviewed_by = session?.user.id; req.captain_reviewed_at = now();
  saveDb(db);
  return req;
}

function finalizeTransfer(requestId, approve) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  const req = db.team_transfer_requests.find((r) => r.id === requestId);
  if (!req) throw new Error('REQUEST_NOT_FOUND');
  if (approve) {
    const active = db.team_memberships.filter((m) => m.team_id === req.to_team_id && m.status === 'active').length;
    if (active >= 45) throw new Error('TEAM_FULL');
    const old = db.team_memberships.find((m) => m.player_id === req.player_id && m.team_id === req.from_team_id && m.status === 'active');
    if (old) { old.status = 'transferred_out'; old.left_at = now(); old.transferred_to = req.to_team_id; }
    db.team_memberships.push({ id: uid(), team_id: req.to_team_id, player_id: req.player_id, status: 'active', role_in_team: 'player', jersey_number: null, joined_at: now() });
    req.status = 'approved';
  } else {
    req.status = 'rejected';
  }
  req.final_approved_by = session.user.id; req.final_approved_at = now();
  saveDb(db);
  return req;
}

function getLineup(matchId, teamId) {
  const db = loadDb();
  const lu = db.match_lineups.find((l) => l.match_id === matchId && l.team_id === teamId);
  if (!lu) return null;
  return { ...lu, players: db.lineup_players.filter((p) => p.lineup_id === lu.id) };
}

function saveLineup({ matchId, teamId, formation, captainId, viceCaptainId, tactics, players }) {
  const session = getDemoSession();
  const db = loadDb();
  const isCaptain = db.team_memberships.some((m) => m.player_id === session?.user.id && m.team_id === teamId && m.status === 'active' && m.role_in_team === 'captain');
  if (!isCaptain && session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  // Same rules as the SQL save_lineup() function: 11 starters, <= 7 subs,
  // roster members only, no suspended player, unique jerseys, one armband.
  const roster = db.team_memberships
    .filter((m) => m.team_id === teamId && m.status === 'active')
    .map((m) => m.player_id);
  const suspended = [...suspendedIdsForMatch(matchId)];
  const check = validateLineupInput({ formation, players, eligiblePlayerIds: roster, suspendedPlayerIds: suspended });
  if (!check.valid) {
    const err = new Error('INVALID_LINEUP');
    err.key = check.errors[0]?.split(':')[0] ?? 'errors.saving';
    err.detail = check.errors.join(', ');
    throw err;
  }
  let lu = db.match_lineups.find((l) => l.match_id === matchId && l.team_id === teamId);
  if (lu && lu.is_locked) throw new Error('LINEUP_LOCKED');
  if (!lu) {
    lu = { id: uid(), match_id: matchId, team_id: teamId, formation, captain_id: captainId, vice_captain_id: viceCaptainId, tactics, is_locked: false, is_public: false, created_by: session?.user.id, updated_by: session?.user.id, created_at: now(), updated_at: now() };
    db.match_lineups.push(lu);
  } else {
    lu.formation = formation; lu.captain_id = captainId; lu.vice_captain_id = viceCaptainId; lu.tactics = tactics; lu.updated_by = session?.user.id; lu.updated_at = now();
  }
  // replace players
  db.lineup_players = db.lineup_players.filter((p) => p.lineup_id !== lu.id);
  for (const pl of players) {
    db.lineup_players.push({ id: uid(), lineup_id: lu.id, player_id: pl.player_id, jersey_number: pl.jersey_number, match_position: pl.match_position, is_starter: pl.is_starter, is_captain: !!pl.is_captain, is_vice_captain: !!pl.is_vice_captain, created_at: now() });
  }
  saveDb(db);
  return getLineup(matchId, teamId);
}

function markMatchLive(matchId) {
  const session = getDemoSession();
  if (!session || (session.profile.role !== 'score_manager' && session.profile.role !== 'super_admin')) throw new Error('FORBIDDEN');
  const db = loadDb();
  const match = db.matches.find((m) => m.id === matchId);
  if (!match || match.status !== 'scheduled') throw new Error('MATCH_NOT_SCHEDULABLE');
  const homeLu = db.match_lineups.find((l) => l.match_id === matchId && l.team_id === match.home_team_id);
  const awayLu = db.match_lineups.find((l) => l.match_id === matchId && l.team_id === match.away_team_id);
  if (!homeLu || !awayLu) throw new Error('LINEUPS_REQUIRED');
  homeLu.is_locked = true; homeLu.is_public = true;
  awayLu.is_locked = true; awayLu.is_public = true;
  match.status = 'live';
  match.home_score = match.home_score ?? 0;
  match.away_score = match.away_score ?? 0;
  saveDb(db);
  return match;
}

function submitMatchReport({ matchId, events, summary, refereeHome, refereeAway }) {
  const session = getDemoSession();
  if (!session || (session.profile.role !== 'score_manager' && session.profile.role !== 'super_admin')) throw new Error('FORBIDDEN');
  const db = loadDb();
  const match = db.matches.find((m) => m.id === matchId);
  if (!match) throw new Error('MATCH_NOT_FOUND');
  const report = validateMatchEvents(events, { homeTeamId: match.home_team_id, awayTeamId: match.away_team_id });
  if (!report.valid) throw new Error('INVALID_EVENTS:' + report.errors.join(','));
  if (refereeHome != null && refereeHome !== report.homeScore) throw new Error('SCORE_MISMATCH');
  if (refereeAway != null && refereeAway !== report.awayScore) throw new Error('SCORE_MISMATCH');

  // Clear derived rows.
  db.match_events = db.match_events.filter((e) => e.match_id !== matchId);
  db.player_match_appearances = db.player_match_appearances.filter((a) => a.match_id !== matchId);
  db.player_ovr_ledger = db.player_ovr_ledger.filter((l) => l.match_id !== matchId);
  db.player_suspensions = db.player_suspensions.filter((s) => s.red_card_match_id !== matchId);

  // Insert events with chronological sequence.
  const sorted = [...report.events].sort((a, b) => (a.minute * 100 + (a.extra_minute || 0)) - (b.minute * 100 + (b.extra_minute || 0)));
  sorted.forEach((ev, i) => {
    db.match_events.push({ id: uid(), match_id: matchId, sequence: i + 1, event_type: ev.event_type, detail: ev.detail, minute: ev.minute, extra_minute: ev.extra_minute, team_id: ev.team_id, player_id: ev.player_id, related_player_id: ev.related_player_id, created_by: session.user.id, created_at: now() });
  });

  // Materialize appearances from lineups.
  const homeLu = getLineup(matchId, match.home_team_id);
  const awayLu = getLineup(matchId, match.away_team_id);
  const homeLineupObj = { team_id: match.home_team_id, players: (homeLu?.players || []).map((p) => ({ player_id: p.player_id, is_starter: p.is_starter, match_position: p.match_position })) };
  const awayLineupObj = { team_id: match.away_team_id, players: (awayLu?.players || []).map((p) => ({ player_id: p.player_id, is_starter: p.is_starter, match_position: p.match_position })) };
  const { appearances } = computeAppearances(homeLineupObj, awayLineupObj, report.events);
  for (const ap of appearances) {
    db.player_match_appearances.push({ id: uid(), match_id: matchId, player_id: ap.player_id, team_id: ap.team_id, match_position: ap.match_position, is_starter: ap.is_starter, entry_minute: ap.entry_minute, exit_minute: ap.exit_minute, minutes_played: ap.minutes_played, created_at: now() });
  }

  // Materialize OVR ledger.
  const mObj = { id: matchId, home_team_id: match.home_team_id, away_team_id: match.away_team_id, home_score: report.homeScore, away_score: report.awayScore };
  const ovr = computeAllMatchOvr(mObj, appearances, report.events);
  for (const [pid, { rows }] of ovr) {
    for (const r of rows) {
      db.player_ovr_ledger.push({ id: uid(), player_id: pid, match_id: matchId, reason: r.reason, delta: r.delta, meta: r.meta || null, created_at: now() });
    }
  }

  // Red-card suspensions.
  const redCards = report.events.filter((e) => e.event_type === 'red');
  const teamMatches = db.matches.filter((mm) => mm.home_team_id === match.home_team_id || mm.away_team_id === match.home_team_id || mm.home_team_id === match.away_team_id || mm.away_team_id === match.away_team_id);
  const appearancesByPlayer = new Map();
  for (const ap of db.player_match_appearances) {
    if (!appearancesByPlayer.has(ap.player_id)) appearancesByPlayer.set(ap.player_id, new Set());
    appearancesByPlayer.get(ap.player_id).add(ap.match_id);
  }
  for (const rc of redCards) {
    const playerTeam = rc.team_id;
    const redCardsByPlayer = new Map([[rc.player_id, [{ match_id: matchId, kickoff_at: match.kickoff_at }]]]);
    const teamMatchesForTeam = teamMatches.filter((mm) => mm.home_team_id === playerTeam || mm.away_team_id === playerTeam);
    // suspendedPlayerIdsForMatch expects (match, redCardsByPlayer, teamMatches, appearancesByPlayer)
    // We instead record a pending suspension targeted at the next team match.
    const sortedTeamMatches = [...teamMatchesForTeam].filter((mm) => mm.status !== 'cancelled').sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)));
    const idx = sortedTeamMatches.findIndex((mm) => mm.id === matchId);
    const target = sortedTeamMatches.slice(idx + 1).find((mm) => mm.status !== 'cancelled');
    db.player_suspensions.push({ id: uid(), player_id: rc.player_id, team_id: playerTeam, red_card_match_id: matchId, suspended_for_match_id: target?.id || null, status: 'pending', created_at: now(), served_at: null });
  }

  // Update match score + status BEFORE recomputing OVR so this match counts as finished.
  match.status = 'finished';
  match.home_score = report.homeScore;
  match.away_score = report.awayScore;

  // Recompute OVR for affected players: walk all their finished matches' ledger rows.
  const affectedPlayers = new Set([...ovr.keys()]);
  // also players with prior ledger rows for this match's teams? keep simple: recompute for players who appeared here.
  for (const pid of affectedPlayers) {
    const playerEntries = db.matches
      .filter((mm) => mm.status === 'finished')
      .sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)))
      .map((mm) => {
        const rows = db.player_ovr_ledger.filter((l) => l.player_id === pid && l.match_id === mm.id).map((l) => ({ reason: l.reason, delta: l.delta }));
        return { match_id: mm.id, kickoff_at: mm.kickoff_at, rows };
      })
      .filter((e) => e.rows.length > 0);
    const hist = recomputeOvrHistory(playerEntries);
    const prof = db.profiles.find((p) => p.id === pid);
    if (prof) prof.ovr = hist.current;
  }

  // Suspensions: mark served when a target match is finished without the player.
  for (const s of db.player_suspensions) {
    if (s.status === 'pending' && s.suspended_for_match_id) {
      const target = db.matches.find((mm) => mm.id === s.suspended_for_match_id);
      if (target && target.status === 'finished') {
        const appeared = db.player_match_appearances.some((a) => a.match_id === target.id && a.player_id === s.player_id);
        if (!appeared) { s.status = 'served'; s.served_at = now(); }
      }
    }
  }

  // Update match + report.
  const existingReport = db.match_reports.find((r) => r.match_id === matchId);
  const rep = { id: existingReport?.id || uid(), match_id: matchId, summary: summary || null, referee_score_home: refereeHome ?? null, referee_score_away: refereeAway ?? null, status: 'published', submitted_by: session.user.id, submitted_at: now(), corrected_by: null, corrected_at: null, correction_note: null, created_at: existingReport?.created_at || now(), updated_at: now() };
  if (existingReport) Object.assign(existingReport, rep);
  else db.match_reports.push(rep);

  saveDb(db);
  return { homeScore: report.homeScore, awayScore: report.awayScore };
}

function correctMatchReport(matchId, note) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  const match = db.matches.find((m) => m.id === matchId);
  if (match) match.status = 'live';
  db.match_events = db.match_events.filter((e) => e.match_id !== matchId);
  db.player_match_appearances = db.player_match_appearances.filter((a) => a.match_id !== matchId);
  db.player_ovr_ledger = db.player_ovr_ledger.filter((l) => l.match_id !== matchId);
  db.player_suspensions = db.player_suspensions.filter((s) => s.red_card_match_id !== matchId);
  const rep = db.match_reports.find((r) => r.match_id === matchId);
  if (rep) { rep.status = 'corrected'; rep.corrected_by = session.user.id; rep.corrected_at = now(); rep.correction_note = note || null; }
  saveDb(db);
}

function listNotifications(userId) {
  const db = loadDb();
  const uid_ = userId || getDemoSession()?.user.id;
  return db.notifications.filter((n) => n.user_id === uid_).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function markNotificationRead(id) {
  const db = loadDb();
  const n = db.notifications.find((x) => x.id === id);
  if (n) { n.read = true; saveDb(db); }
}

function addNotification(userId, type, title, body, link) {
  const db = loadDb();
  db.notifications.push({ id: uid(), user_id: userId, type, title, body: body || null, link: link || null, read: false, created_at: now() });
  saveDb(db);
}

function listTeamPosts(teamId) {
  const db = loadDb();
  return db.team_posts.filter((p) => p.team_id === teamId && !p.deleted_at).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function addTeamPost(teamId, title, body, postType) {
  const session = getDemoSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');
  const db = loadDb();
  // Mirror the RLS policy: only active members of the team (or a super admin)
  // may post in the private team space.
  const isMember = db.team_memberships.some((m) => m.player_id === session.user.id && m.team_id === teamId && m.status === 'active');
  if (!isMember && session.profile.role !== 'super_admin') throw new Error('FORBIDDEN');
  const post = { id: uid(), team_id: teamId, author_id: session.user.id, title: title || null, body, post_type: postType || 'post', created_at: now(), updated_at: now(), deleted_at: null };
  db.team_posts.push(post);
  saveDb(db);
  return post;
}

function deleteTeamPost(postId) {
  const session = getDemoSession();
  const db = loadDb();
  const post = db.team_posts.find((p) => p.id === postId);
  if (!post) return;
  if (post.author_id !== session?.user.id && session?.profile?.role !== 'super_admin') {
    // captains can moderate their own team's posts
    const isCaptain = db.team_memberships.some((m) => m.player_id === session?.user.id && m.team_id === post.team_id && m.status === 'active' && m.role_in_team === 'captain');
    if (!isCaptain) throw new Error('FORBIDDEN');
  }
  post.deleted_at = now();
  saveDb(db);
}

function submitStaffRequest(task, description) {
  const session = getDemoSession();
  if (!session) throw new Error('NOT_AUTHENTICATED');
  const db = loadDb();
  const req = { id: uid(), user_id: session.user.id, requested_task: task, description: description || null, status: 'pending', reviewed_by: null, reviewed_at: null, assigned_role: null, created_at: now() };
  db.staff_access_requests.push(req);
  saveDb(db);
  return req;
}

function reviewStaffRequest(requestId, approve, assignedRole) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  const req = db.staff_access_requests.find((r) => r.id === requestId);
  if (!req || req.status !== 'pending') throw new Error('REQUEST_NOT_FOUND');
  if (approve) {
    req.status = 'approved'; req.assigned_role = assignedRole || 'score_manager';
    const prof = db.profiles.find((p) => p.id === req.user_id);
    if (prof) prof.role = req.assigned_role;
  } else {
    req.status = 'rejected';
  }
  req.reviewed_by = session.user.id; req.reviewed_at = now();
  saveDb(db);
  return req;
}

function getCareerStats(playerId) {
  const db = loadDb();
  const appearances = db.player_match_appearances.filter((a) => a.player_id === playerId);
  const entries = [];
  for (const ap of appearances) {
    const match = db.matches.find((m) => m.id === ap.match_id);
    if (!match || match.status !== 'finished') continue;
    const matchAppearances = db.player_match_appearances.filter((a) => a.match_id === match.id);
    const events = db.match_events.filter((e) => e.match_id === match.id);
    entries.push({ match, appearances: matchAppearances, events });
  }
  // de-dup by match
  const byMatch = new Map();
  for (const e of entries) byMatch.set(e.match.id, e);
  return { entries: [...byMatch.values()], appearances };
}

function getOvrHistory(playerId) {
  const db = loadDb();
  const ledger = db.player_ovr_ledger.filter((l) => l.player_id === playerId);
  const matchIds = [...new Set(ledger.map((l) => l.match_id))];
  const entries = matchIds
    .map((mid) => {
      const match = db.matches.find((m) => m.id === mid);
      const rows = ledger.filter((l) => l.match_id === mid).map((l) => ({ reason: l.reason, delta: l.delta }));
      return { match_id: mid, kickoff_at: match?.kickoff_at, rows };
    })
    .sort((a, b) => String(a.kickoff_at).localeCompare(String(b.kickoff_at)));
  const hist = recomputeOvrHistory(entries);
  return { ledger, history: hist };
}

function getSuspensions(playerId) {
  const db = loadDb();
  return db.player_suspensions.filter((s) => s.player_id === playerId);
}

function suspendedIdsForMatch(matchId) {
  const db = loadDb();
  const match = db.matches.find((m) => m.id === matchId);
  if (!match) return new Set();
  const teamIds = [match.home_team_id, match.away_team_id];
  const redCardsByPlayer = new Map();
  for (const s of db.player_suspensions) {
    if (s.status !== 'pending') continue;
    if (!teamIds.includes(s.team_id)) continue;
    if (!redCardsByPlayer.has(s.player_id)) redCardsByPlayer.set(s.player_id, []);
    redCardsByPlayer.get(s.player_id).push({ match_id: s.red_card_match_id, kickoff_at: db.matches.find((m) => m.id === s.red_card_match_id)?.kickoff_at });
  }
  const teamMatches = db.matches.filter((m) => teamIds.includes(m.home_team_id) || teamIds.includes(m.away_team_id));
  const appearancesByPlayer = new Map();
  for (const a of db.player_match_appearances) {
    if (!appearancesByPlayer.has(a.player_id)) appearancesByPlayer.set(a.player_id, new Set());
    appearancesByPlayer.get(a.player_id).add(a.match_id);
  }
  return suspendedPlayerIdsForMatch(match, redCardsByPlayer, teamMatches, appearancesByPlayer);
}

// Avoid require in ESM; re-import at top instead. We'll shim:
// (suspensions util already imported? add import)
// Note: suspendedIdsForMatch uses the imported function if available.

// --- Settings (mirror of the Supabase tournament_settings table) -------------
function getSettings() {
  return loadDb().settings;
}

function updateSettings(patch) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  db.settings = { ...db.settings, ...patch, updated_at: now() };
  saveDb(db);
  return db.settings;
}

// --- Teams (official CRUD - the admin panel; creation via request+approval is
// handled separately by requestTeamCreation/approveTeamCreation) --------------
function listTeams() {
  const db = loadDb();
  const session = getDemoSession();
  const isAdmin = session?.profile?.role === 'super_admin';
  // Mirror the RLS rule: archived teams are visible to admins only.
  return db.teams
    .filter((team) => isAdmin || !team.archived)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function createTeam(data) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  const name = String(data.name ?? '').trim();
  const short = String(data.short_name ?? '').trim().toUpperCase();
  if (name.length < 2 || short.length < 2 || short.length > 6) throw new Error('INVALID_TEAM');
  if (db.teams.some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new Error('DUPLICATE_TEAM');
  const team = {
    id: uid(),
    name,
    short_name: short,
    logo_url: data.logo_url?.trim() || null,
    description: data.description?.trim() || null,
    archived: false,
    created_at: now(),
    updated_at: now(),
  };
  db.teams.push(team);
  saveDb(db);
  return team;
}

function updateTeam(id, patch) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  const team = db.teams.find((x) => x.id === id);
  if (!team) throw new Error('TEAM_NOT_FOUND');
  if (patch.name !== undefined) team.name = String(patch.name).trim();
  if (patch.short_name !== undefined) team.short_name = String(patch.short_name).trim().toUpperCase();
  if (patch.logo_url !== undefined) team.logo_url = patch.logo_url || null;
  if (patch.description !== undefined) team.description = patch.description || null;
  if (patch.archived !== undefined) team.archived = !!patch.archived;
  team.updated_at = now();
  saveDb(db);
  return team;
}

function deleteTeam(id) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  const db = loadDb();
  // Mirror the FK constraint: a team that already played cannot be deleted.
  if (db.matches.some((m) => m.home_team_id === id || m.away_team_id === id)) {
    throw new Error('TEAM_IN_USE');
  }
  db.teams = db.teams.filter((x) => x.id !== id);
  db.team_memberships = db.team_memberships.filter((m) => m.team_id !== id);
  db.team_join_requests = db.team_join_requests.filter((r) => r.team_id !== id);
  saveDb(db);
}

// --- Matches (official CRUD - score manager / super admin) --------------------
function staffSession() {
  const session = getDemoSession();
  if (!session || (session.profile.role !== 'score_manager' && session.profile.role !== 'super_admin')) {
    return null;
  }
  return session;
}

function auditRow(db, session, match, oldValues, newValues) {
  db.audit_logs.push({
    id: uid(),
    match_id: match.id,
    old_home_score: oldValues.home_score,
    new_home_score: newValues.home_score,
    old_away_score: oldValues.away_score,
    new_away_score: newValues.away_score,
    old_status: oldValues.status,
    new_status: newValues.status,
    changed_by: session.user.id,
    changed_at: now(),
  });
}

function createMatch(data) {
  const session = staffSession();
  if (!session) throw new Error('FORBIDDEN');
  const v = validateMatch(data);
  if (!v.valid) {
    const err = new Error('INVALID_MATCH');
    err.key = Object.values(v.errors)[0] ?? 'errors.saving';
    throw err;
  }
  const db = loadDb();
  const match = {
    id: uid(),
    home_team_id: data.home_team_id,
    away_team_id: data.away_team_id,
    home_score: data.home_score === null || data.home_score === undefined || data.home_score === '' ? null : Number(data.home_score),
    away_score: data.away_score === null || data.away_score === undefined || data.away_score === '' ? null : Number(data.away_score),
    kickoff_at: new Date(data.kickoff_at).toISOString(),
    venue: data.venue || null,
    round_name: data.round_name || null,
    status: data.status || 'scheduled',
    updated_by: session.user.id,
    created_at: now(),
    updated_at: now(),
  };
  db.matches.push(match);
  saveDb(db);
  return match;
}

function updateMatch(id, patch) {
  const session = staffSession();
  if (!session) throw new Error('FORBIDDEN');
  const db = loadDb();
  const match = db.matches.find((m) => m.id === id);
  if (!match) throw new Error('MATCH_NOT_FOUND');
  const old = { home_score: match.home_score, away_score: match.away_score, status: match.status };

  if (patch.kickoff_at !== undefined && patch.kickoff_at !== null && patch.kickoff_at !== '') {
    const d = new Date(patch.kickoff_at);
    if (Number.isNaN(d.getTime())) throw new Error('INVALID_KICKOFF');
    match.kickoff_at = d.toISOString();
  }
  if (patch.venue !== undefined) match.venue = patch.venue || null;
  if (patch.round_name !== undefined) match.round_name = patch.round_name || null;
  if (patch.home_score !== undefined) {
    match.home_score = patch.home_score === null || patch.home_score === '' ? null : Number(patch.home_score);
  }
  if (patch.away_score !== undefined) {
    match.away_score = patch.away_score === null || patch.away_score === '' ? null : Number(patch.away_score);
  }
  if (patch.status !== undefined) match.status = patch.status;

  // live/finished always need both scores (mirrors the DB trigger).
  if ((match.status === 'live' || match.status === 'finished') &&
      (match.home_score === null || match.away_score === null)) {
    throw new Error('SCORES_REQUIRED');
  }

  match.updated_by = session.user.id;
  match.updated_at = now();
  if (old.home_score !== match.home_score || old.away_score !== match.away_score || old.status !== match.status) {
    auditRow(db, session, match, old, { home_score: match.home_score, away_score: match.away_score, status: match.status });
  }
  saveDb(db);
  return match;
}

function deleteMatch(id) {
  const session = staffSession();
  if (!session) throw new Error('FORBIDDEN');
  const db = loadDb();
  db.matches = db.matches.filter((m) => m.id !== id);
  db.match_events = db.match_events.filter((e) => e.match_id !== id);
  db.match_lineups = db.match_lineups.filter((l) => l.match_id !== id);
  db.lineup_players = db.lineup_players.filter((p) => !db.match_lineups.some((l) => l.id === p.lineup_id));
  db.match_reports = db.match_reports.filter((r) => r.match_id !== id);
  db.player_match_appearances = db.player_match_appearances.filter((a) => a.match_id !== id);
  db.player_ovr_ledger = db.player_ovr_ledger.filter((l) => l.match_id !== id);
  db.player_suspensions = db.player_suspensions.filter((s) => s.red_card_match_id !== id && s.suspended_for_match_id !== id);
  db.audit_logs = db.audit_logs.filter((a) => a.match_id !== id);
  saveDb(db);
}

// --- Admin / staff directory --------------------------------------------------
function listAuditLogs() {
  return [...loadDb().audit_logs]
    .sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)))
    .slice(0, 200);
}

function listManagers() {
  return [...loadDb().profiles].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

function changeManagerRole(targetUserId, newRole) {
  const session = getDemoSession();
  if (session?.profile?.role !== 'super_admin') throw new Error('FORBIDDEN');
  if (targetUserId === session.user.id) throw new Error('CANNOT_CHANGE_YOUR_OWN_ROLE');
  const db = loadDb();
  const target = db.profiles.find((p) => p.id === targetUserId);
  if (!target) throw new Error('PROFILE_NOT_FOUND');
  const superAdmins = db.profiles.filter((p) => p.role === 'super_admin');
  if (target.role === 'super_admin' && newRole !== 'super_admin' && superAdmins.length <= 1) {
    throw new Error('LAST_SUPER_ADMIN');
  }
  target.role = newRole;
  saveDb(db);
  return target;
}

function updateMyProfile(patch) {
  return updateProfileDemo(patch);
}

export const demoService = {
  // auth
  getDemoSession, clearSession: clearSession, loginDemo, signUpDemo, updateProfileDemo, isCaptainOfDemo,
  updateProfile: updateProfileDemo, // facade name compatibility
  // data
  loadDb, saveDb, resetDb,
  // settings
  getSettings, updateSettings,
  // teams (official CRUD)
  listTeams, createTeam, updateTeam, deleteTeam,
  // matches (official CRUD)
  createMatch, updateMatch, deleteMatch,
  // admin / staff directory
  listAuditLogs, listManagers, changeManagerRole, updateMyProfile,
  // profiles
  listMembers, getProfileById,
  // teams
  listTeamMemberships, myMembership, requestJoinTeam, decideJoinRequest,
  requestTeamCreation, approveTeamCreation, requestTransfer, captainApproveTransfer, finalizeTransfer,
  // lineups
  getLineup, saveLineup, markMatchLive,
  // reports
  submitMatchReport, correctMatchReport, validateMatchEvents,
  // career / ovr / suspensions
  getCareerStats, getOvrHistory, getSuspensions, suspendedIdsForMatch,
  // content
  listNotifications, markNotificationRead, addNotification,
  listTeamPosts, addTeamPost, deleteTeamPost,
  // staff
  submitStaffRequest, reviewStaffRequest,
  // realtime shim (no-op in demo)
  subscribeDemoStorage: (cb) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); },
};

// Demo match rows embed both teams so pages can use match.home_team /
// match.away_team exactly like the Supabase FK join (MATCH_SELECT).
function matchWithTeams(db, match) {
  if (!match || typeof match !== 'object') return match;
  const byId = new Map((db.teams || []).map((t) => [t.id, t]));
  return {
    ...match,
    home_team: match.home_team ?? byId.get(match.home_team_id) ?? null,
    away_team: match.away_team ?? byId.get(match.away_team_id) ?? null,
  };
}
demoService.getMatch = (id) => { const db = loadDb(); return matchWithTeams(db, (db.matches || []).find((m) => m.id === id) || null); };
demoService.listMatches = () => { const db = loadDb(); return (db.matches || []).map((m) => matchWithTeams(db, m)); };
demoService.getTeam = (id) => (loadDb().teams || []).find((t) => t.id === id) || null;

export function subscribeDemoStorage(cb) {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}
