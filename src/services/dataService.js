// ============================================================================
// DATA SERVICE - single facade used by every page.
// Chooses between the real Supabase implementation and the demo service.
// If Supabase is configured but fails, errors are surfaced (never silently
// swapped for demo data).
// ============================================================================

import { supabase, isDemoMode } from '../lib/supabaseClient.js';
import { demoService, subscribeDemoStorage } from './demoService.js';
import { getLocale } from '../i18n/language.js';
import { t } from '../i18n/language.js';

/** Match rows embed both teams (Supabase join by explicit FK names). */
const MATCH_SELECT =
  '*, home_team:teams!matches_home_team_id_fkey(id,name,short_name,logo_url,archived), ' +
  'away_team:teams!matches_away_team_id_fkey(id,name,short_name,logo_url,archived)';

/** Convert a Supabase/PostgREST error into a translated app error. */
function dbError(error) {
  const message = String(error?.message ?? '');
  const appError = new Error(message || 'DB_ERROR');
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    appError.key = 'errors.dbConnection';
  } else if (error?.code === '42501' || message.includes('row-level security')) {
    appError.key = 'errors.permission';
  } else if (message.includes('duplicate key')) {
    appError.key = 'validation.duplicateTeam';
  } else {
    appError.key = 'errors.generic';
  }
  appError.detail = message;
  return appError;
}

async function query(builder) {
  const { data, error } = await builder;
  if (error) throw dbError(error);
  return data;
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------
const supabaseService = {
  isDemo: false,

  getSettings: () =>
    query(supabase.from('tournament_settings').select('*').eq('id', 1).single()),

  listTeams: () =>
    query(
      supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })
    ),
  // Note: RLS hides archived teams from non-admins automatically.

  getTeam: (id) => query(supabase.from('teams').select('*').eq('id', id).single()),

  createTeam: async (data) => {
    const row = {
      name: data.name.trim(),
      short_name: data.short_name.trim().toUpperCase(),
      logo_url: data.logo_url?.trim() || null,
      description: data.description?.trim() || null,
    };
    return query(supabase.from('teams').insert(row).select().single());
  },

  updateTeam: (id, patch) =>
    query(supabase.from('teams').update(patch).eq('id', id).select().single()),

  deleteTeam: (id) =>
    query(supabase.from('teams').delete().eq('id', id)),

  listMatches: () =>
    query(
      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .order('kickoff_at', { ascending: true })
    ),

  getMatch: (id) =>
    query(supabase.from('matches').select(MATCH_SELECT).eq('id', id).single()),

  createMatch: async (data) => {
    const row = {
      home_team_id: data.home_team_id,
      away_team_id: data.away_team_id,
      kickoff_at: data.kickoff_at,
      venue: data.venue?.trim() || null,
      round_name: data.round_name?.trim() || null,
      status: data.status || 'scheduled',
    };
    if (data.home_score !== undefined && data.home_score !== null && data.home_score !== '') {
      row.home_score = Number(data.home_score);
      row.away_score = Number(data.away_score);
    }
    const created = await query(
      supabase.from('matches').insert(row).select(MATCH_SELECT).single()
    );
    return created;
  },

  updateMatch: (id, patch) =>
    query(supabase.from('matches').update(patch).eq('id', id).select(MATCH_SELECT).single()),

  deleteMatch: (id) => query(supabase.from('matches').delete().eq('id', id)),

  listAuditLogs: () =>
    query(
      supabase
        .from('match_audit_logs')
        .select(
          '*, match:matches(id, kickoff_at, venue, home_team:teams!matches_home_team_id_fkey(name,short_name), away_team:teams!matches_away_team_id_fkey(name,short_name)), ' +
            'changer:profiles!match_audit_logs_changed_by_fkey(display_name, email)'
        )
        .order('changed_at', { ascending: false })
        .limit(200)
    ),

  listManagers: () =>
    query(
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
    ),

  changeManagerRole: async (targetUserId, newRole) => {
    const { error } = await supabase.rpc('change_manager_role', {
      target_user_id: targetUserId,
      new_role: newRole,
    });
    if (error) {
      const message = String(error.message ?? '');
      const appError = new Error(message);
      if (message.includes('your own role')) appError.key = 'admin.errors.selfRole';
      else if (message.includes('LAST_SUPER_ADMIN')) appError.key = 'admin.errors.lastSuperAdmin';
      else appError.key = 'admin.errors.roleChange';
      throw appError;
    }
  },

  updateMyProfile: (patch) =>
    query(
      supabase.auth.getUser().then(({ data }) =>
        supabase.from('profiles').update(patch).eq('id', data.user.id).select().single()
      )
    ),

  updateSettings: (patch) =>
    query(supabase.from('tournament_settings').update(patch).eq('id', 1).select().single()),
};

// ---------------------------------------------------------------------------
// Extended data service methods (player accounts, teams, lineups, reports, ...)
// ---------------------------------------------------------------------------
// Attach extended methods to supabaseService.
Object.assign(supabaseService, {
  // profiles
  listMembers: () => query(supabase.from('profiles').select('*').order('created_at', { ascending: true })),
  getProfileById: (id) => query(supabase.from('profiles').select('*').eq('id', id).single()),
  updateProfile: (fields) => query(supabase.from('profiles').update(fields).eq('id', (async () => (await supabase.auth.getUser()).data.user.id)()).select().single()),

  // memberships
  listTeamMemberships: (teamId) => query(supabase.from('team_memberships').select('*, player:profiles(id,display_name,full_name,main_position,photo_url,ovr)').eq('team_id', teamId).eq('status', 'active')),
  myMembership: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return null;
    const { data } = await supabase.from('team_memberships').select('*').eq('player_id', u.user.id).eq('status', 'active').maybeSingle();
    return data;
  },

  // join requests
  listJoinRequests: (teamId) => query(supabase.from('team_join_requests').select('*, player:profiles(id,display_name,full_name,main_position)').eq('team_id', teamId).order('created_at', { ascending: false })),
  requestJoinTeam: (teamId, message) => query(supabase.rpc('request_join_team', { p_team_id: teamId, p_message: message || null })).then(() => ({ ok: true })),
  decideJoinRequest: (requestId, accept, jerseyNumber) => query(supabase.rpc('decide_join_request', { p_request_id: requestId, p_accept: accept, p_jersey_number: jerseyNumber ?? null })),

  // team creation
  listTeamCreationRequests: () => query(supabase.from('team_creation_requests').select('*, requester:profiles(id,display_name)').order('created_at', { ascending: false })),
  requestTeamCreation: (data) => query(supabase.rpc('request_team_creation', { p_name: data.name, p_short: data.shortName, p_description: data.description || null, p_logo_url: data.logoUrl || null })),
  approveTeamCreation: (requestId, approve) => query(supabase.rpc('approve_team_creation', { p_request_id: requestId, p_approve: approve })),

  // transfers
  listTransfers: () => query(supabase.from('team_transfer_requests').select('*').order('created_at', { ascending: false })),
  requestTransfer: (fromTeamId, toTeamId, reason) => query(supabase.rpc('request_transfer', { p_from_team: fromTeamId, p_to_team: toTeamId, p_reason: reason || null })),
  captainApproveTransfer: (requestId, accept) => query(supabase.rpc('captain_approve_transfer', { p_request_id: requestId, p_accept: accept })),
  finalizeTransfer: (requestId, approve) => query(supabase.rpc('finalize_transfer', { p_request_id: requestId, p_approve: approve })),

  // staff
  listStaffRequests: () => query(supabase.from('staff_access_requests').select('*, user:profiles(id,display_name,email)').order('created_at', { ascending: false })),
  submitStaffRequest: (task, description) => query(supabase.rpc('submit_staff_request', { p_task: task, p_description: description || null })),
  reviewStaffRequest: (requestId, approve, role) => query(supabase.rpc('review_staff_request', { p_request_id: requestId, p_approve: approve, p_assigned_role: role })),

  // lineups
  getLineup: async (matchId, teamId) => {
    const lu = await query(supabase.from('match_lineups').select('*, players:lineup_players(*)').eq('match_id', matchId).eq('team_id', teamId).maybeSingle());
    return lu;
  },
  saveLineup: (data) => query(supabase.rpc('save_lineup', {
    p_match_id: data.matchId, p_team_id: data.teamId, p_formation: data.formation,
    p_captain_id: data.captainId || null, p_vice_captain_id: data.viceCaptainId || null,
    p_tactics: data.tactics || null, p_players: data.players,
  })),
  markMatchLive: (matchId) => query(supabase.rpc('mark_match_live', { p_match_id: matchId })),

  // events / reports
  getMatchEvents: (matchId) => query(supabase.from('match_events').select('*').eq('match_id', matchId).order('sequence', { ascending: true })),
  getMatchReport: (matchId) => query(supabase.from('match_reports').select('*').eq('match_id', matchId).maybeSingle()),
  submitMatchReport: async (data) => {
    // Compute appearances + OVR rows client-side (single source of truth) and
    // pass them to the DB function for materialization.
    const match = await query(supabase.from('matches').select(MATCH_SELECT).eq('id', data.matchId).single());
    const homeLu = await query(supabase.from('match_lineups').select('*, players:lineup_players(*)').eq('match_id', data.matchId).eq('team_id', match.home_team_id).maybeSingle());
    const awayLu = await query(supabase.from('match_lineups').select('*, players:lineup_players(*)').eq('match_id', data.matchId).eq('team_id', match.away_team_id).maybeSingle());
    const homeLineupObj = { team_id: match.home_team_id, players: (homeLu?.players || []).map((p) => ({ player_id: p.player_id, is_starter: p.is_starter, match_position: p.match_position })) };
    const awayLineupObj = { team_id: match.away_team_id, players: (awayLu?.players || []).map((p) => ({ player_id: p.player_id, is_starter: p.is_starter, match_position: p.match_position })) };
    const { computeAppearances } = await import('../utils/career.js');
    const { computeAllMatchOvr } = await import('../utils/ovr.js');
    const { validateMatchEvents } = await import('../utils/matchEvents.js');
    const v = validateMatchEvents(data.events, { homeTeamId: match.home_team_id, awayTeamId: match.away_team_id });
    const { appearances } = computeAppearances(homeLineupObj, awayLineupObj, v.events);
    const mObj = { id: data.matchId, home_team_id: match.home_team_id, away_team_id: match.away_team_id, home_score: v.homeScore, away_score: v.awayScore };
    const ovr = computeAllMatchOvr(mObj, appearances, v.events);
    const appearancesPayload = appearances.map((a) => ({
      player_id: a.player_id, team_id: a.team_id, match_position: a.match_position,
      is_starter: a.is_starter, entry_minute: a.entry_minute, exit_minute: a.exit_minute,
      minutes_played: a.minutes_played,
    }));
    const ovrPayload = [];
    for (const [pid, { rows }] of ovr) {
      for (const r of rows) ovrPayload.push({ player_id: pid, reason: r.reason, delta: r.delta, meta: r.meta || null });
    }
    return query(supabase.rpc('submit_match_report', {
      p_match_id: data.matchId, p_events: data.events, p_summary: data.summary || null,
      p_referee_home: data.refereeHome ?? null, p_referee_away: data.refereeAway ?? null,
      p_appearances: appearancesPayload, p_ovr_rows: ovrPayload,
    }));
  },
  correctMatchReport: (matchId, note) => query(supabase.rpc('correct_match_report', { p_match_id: matchId, p_note: note || null })),

  // appearances / ovr / suspensions
  getAppearances: (matchId) => query(supabase.from('player_match_appearances').select('*').eq('match_id', matchId)),
  getAppearancesByPlayer: (playerId) => query(supabase.from('player_match_appearances').select('*').eq('player_id', playerId)),
  getOvrLedger: (playerId) => query(supabase.from('player_ovr_ledger').select('*').eq('player_id', playerId).order('created_at', { ascending: true })),
  getSuspensions: (playerId) => query(supabase.from('player_suspensions').select('*').eq('player_id', playerId)),
  suspendedIdsForMatch: async (matchId) => {
    const susp = await query(supabase.from('player_suspensions').select('player_id').eq('suspended_for_match_id', matchId).eq('status', 'pending'));
    return new Set((susp || []).map((s) => s.player_id));
  },

  // notifications
  listNotifications: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return [];
    return query(supabase.from('notifications').select('*').eq('user_id', u.user.id).order('created_at', { ascending: false }));
  },
  markNotificationRead: (id) => query(supabase.from('notifications').update({ read: true }).eq('id', id)),
  addNotification: (userId, type, title, body, link) => query(supabase.from('notifications').insert({ user_id: userId, type, title, body, link })),

  // team space
  listTeamPosts: (teamId) => query(supabase.from('team_posts').select('*, author:profiles(id,display_name,photo_url)').eq('team_id', teamId).is('deleted_at', null).order('created_at', { ascending: false })),
  addTeamPost: (teamId, title, body, postType) => query(supabase.from('team_posts').insert({ team_id: teamId, author_id: null, title, body, post_type: postType || 'post' }).select().single()),
  deleteTeamPost: (postId) => query(supabase.from('team_posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId)),

  // career stats are computed client-side; helper fetches the needed records
  fetchPlayerRecords: async (playerId) => {
    const apps = await query(supabase.from('player_match_appearances').select('*').eq('player_id', playerId));
    const matchIds = [...new Set((apps || []).map((a) => a.match_id))];
    const matches = matchIds.length ? await query(supabase.from('matches').select(MATCH_SELECT).in('id', matchIds)) : [];
    const events = matchIds.length ? await query(supabase.from('match_events').select('*').in('match_id', matchIds)) : [];
    return { appearances: apps || [], matches: matches || [], events: events || [] };
  },
});

// Attach the same method names to demoService passthrough (demoService already has them).
// Make sure demoService exposes listJoinRequests etc. (it uses different names) - alias.
demoService.listJoinRequests = (teamId) => demoService.loadDb().team_join_requests.filter((r) => r.team_id === teamId);
demoService.listTeamCreationRequests = () => demoService.loadDb().team_creation_requests;
demoService.listTransfers = () => demoService.loadDb().team_transfer_requests;
demoService.listStaffRequests = () => demoService.loadDb().staff_access_requests;
demoService.getMatchEvents = (matchId) => demoService.loadDb().match_events.filter((e) => e.match_id === matchId).sort((a, b) => a.sequence - b.sequence);
demoService.getMatchReport = (matchId) => demoService.loadDb().match_reports.find((r) => r.match_id === matchId) || null;
demoService.getAppearances = (matchId) => demoService.loadDb().player_match_appearances.filter((a) => a.match_id === matchId);
demoService.getAppearancesByPlayer = (playerId) => demoService.loadDb().player_match_appearances.filter((a) => a.player_id === playerId);
demoService.getOvrLedger = (playerId) => demoService.loadDb().player_ovr_ledger.filter((l) => l.player_id === playerId);
demoService.getSuspensions = (playerId) => demoService.loadDb().player_suspensions.filter((s) => s.player_id === playerId);
// NOTE: listNotifications, listTeamPosts, addTeamPost, deleteTeamPost and
// updateProfile already exist natively in demoService - no alias needed here
// (aliasing a method to itself would recurse infinitely).
demoService.fetchPlayerRecords = async (playerId) => {
  const db = demoService.loadDb();
  const apps = db.player_match_appearances.filter((a) => a.player_id === playerId);
  const matchIds = [...new Set(apps.map((a) => a.match_id))];
  const matches = db.matches.filter((m) => matchIds.includes(m.id));
  const events = db.match_events.filter((e) => matchIds.includes(e.match_id));
  return { appearances: apps, matches, events };
};
// updateProfile is implemented natively in demoService (see export list there).

// ---------------------------------------------------------------------------
// Facade exported to the whole app
// ---------------------------------------------------------------------------
const impl = isDemoMode ? demoService : supabaseService;

export const dataService = {
  isDemo: impl.isDemo,
  getSettings: (...args) => impl.getSettings(...args),
  listTeams: (...args) => impl.listTeams(...args),
  getTeam: (...args) => impl.getTeam(...args),
  createTeam: (...args) => impl.createTeam(...args),
  updateTeam: (...args) => impl.updateTeam(...args),
  deleteTeam: (...args) => impl.deleteTeam(...args),
  listMatches: (...args) => impl.listMatches(...args),
  getMatch: (...args) => impl.getMatch(...args),
  createMatch: (...args) => impl.createMatch(...args),
  updateMatch: (...args) => impl.updateMatch(...args),
  deleteMatch: (...args) => impl.deleteMatch(...args),
  listAuditLogs: (...args) => impl.listAuditLogs(...args),
  listManagers: (...args) => impl.listManagers(...args),
  changeManagerRole: (...args) => impl.changeManagerRole(...args),
  updateMyProfile: (...args) => impl.updateMyProfile(...args),
  updateSettings: (...args) => impl.updateSettings(...args),

  // new extended methods
  listMembers: (...args) => impl.listMembers(...args),
  getProfileById: (...args) => impl.getProfileById(...args),
  updateProfile: (...args) => impl.updateProfile(...args),
  listTeamMemberships: (...args) => impl.listTeamMemberships(...args),
  myMembership: (...args) => impl.myMembership(...args),
  listJoinRequests: (...args) => impl.listJoinRequests(...args),
  requestJoinTeam: (...args) => impl.requestJoinTeam(...args),
  decideJoinRequest: (...args) => impl.decideJoinRequest(...args),
  listTeamCreationRequests: (...args) => impl.listTeamCreationRequests(...args),
  requestTeamCreation: (...args) => impl.requestTeamCreation(...args),
  approveTeamCreation: (...args) => impl.approveTeamCreation(...args),
  listTransfers: (...args) => impl.listTransfers(...args),
  requestTransfer: (...args) => impl.requestTransfer(...args),
  captainApproveTransfer: (...args) => impl.captainApproveTransfer(...args),
  finalizeTransfer: (...args) => impl.finalizeTransfer(...args),
  listStaffRequests: (...args) => impl.listStaffRequests(...args),
  submitStaffRequest: (...args) => impl.submitStaffRequest(...args),
  reviewStaffRequest: (...args) => impl.reviewStaffRequest(...args),
  getLineup: (...args) => impl.getLineup(...args),
  saveLineup: (...args) => impl.saveLineup(...args),
  markMatchLive: (...args) => impl.markMatchLive(...args),
  getMatchEvents: (...args) => impl.getMatchEvents(...args),
  getMatchReport: (...args) => impl.getMatchReport(...args),
  submitMatchReport: (...args) => impl.submitMatchReport(...args),
  correctMatchReport: (...args) => impl.correctMatchReport(...args),
  getAppearances: (...args) => impl.getAppearances(...args),
  getAppearancesByPlayer: (...args) => impl.getAppearancesByPlayer(...args),
  getOvrLedger: (...args) => impl.getOvrLedger(...args),
  getSuspensions: (...args) => impl.getSuspensions(...args),
  suspendedIdsForMatch: (...args) => impl.suspendedIdsForMatch(...args),
  listNotifications: (...args) => impl.listNotifications(...args),
  markNotificationRead: (...args) => impl.markNotificationRead(...args),
  addNotification: (...args) => impl.addNotification(...args),
  listTeamPosts: (...args) => impl.listTeamPosts(...args),
  addTeamPost: (...args) => impl.addTeamPost(...args),
  deleteTeamPost: (...args) => impl.deleteTeamPost(...args),
  fetchPlayerRecords: (...args) => impl.fetchPlayerRecords(...args),
};

/**
 * Subscribe to match changes (Supabase Realtime in production, cross-tab
 * storage events in demo mode). Returns an unsubscribe function.
 */
export function subscribeToMatches(callback) {
  if (isDemoMode) return subscribeDemoStorage(callback);

  const channel = supabase
    .channel('esst-matches')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      (payload) => callback(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export { getLocale, t };
