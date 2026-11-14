// ============================================================================
// AUTH SERVICE - email/password sessions + organizer profiles/roles.
// In demo mode this is a clearly-labeled local simulation (no real auth).
// ============================================================================

import { supabase, isDemoMode } from '../lib/supabaseClient.js';
import { demoService } from './demoService.js';

export const ROLES = {
  MEMBER: 'member',
  SCORE_MANAGER: 'score_manager',
  SUPER_ADMIN: 'super_admin',
};

export function roleOf(profile) {
  return profile?.role ?? 'member';
}

export function isMember(profile) {
  return ['member', 'score_manager', 'super_admin'].includes(roleOf(profile));
}

export function isScoreManager(profile) {
  return roleOf(profile) === 'score_manager' || roleOf(profile) === 'super_admin';
}

export function isSuperAdmin(profile) {
  return roleOf(profile) === 'super_admin';
}

export function isProfileComplete(profile) {
  if (!profile) return false;
  return (
    !!profile.full_name &&
    !!profile.birth_year &&
    !!profile.main_position &&
    !!profile.preferred_foot
  );
}

/**
 * Current session (null when signed out).
 * Demo sessions carry { user, profile } like Supabase does.
 */
export async function getSession() {
  if (isDemoMode) return demoService.getDemoSession();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Fetch the profile (role) of the signed-in user.
 * Throws with .key = 'errors.profileMissing' when the SQL trigger did not run.
 */
export async function getProfile() {
  if (isDemoMode) {
    const session = demoService.getDemoSession();
    return session?.profile ?? null;
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (error || !profile) {
    const err = new Error('PROFILE_NOT_FOUND');
    err.key = 'errors.profileMissing';
    throw err;
  }
  return profile;
}

/**
 * Sign in with email + password.
 * Resolves { session, profile } or throws an Error with .key for the UI.
 */
export async function login(email, password) {
  if (isDemoMode) {
    // Demo mode has no real authentication by design.
    const err = new Error('DEMO_MODE_NO_AUTH');
    err.key = 'demo.authNotice';
    throw err;
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    const message = String(error.message ?? '');
    const appError = new Error(message);
    appError.key =
      error.status === 400 &&
      (message.includes('Invalid login credentials') || message.includes('invalid'))
        ? 'auth.invalid'
        : 'auth.error';
    throw appError;
  }
  let profile = null;
  try {
    profile = await getProfile();
  } catch (err) {
    // Sign out again when the profile row is missing (setup issue).
    await supabase.auth.signOut();
    throw err;
  }
  return { session: data.session, profile };
}

/** Sign out everywhere applicable. */
export async function logout() {
  if (isDemoMode) {
    demoService.clearSession();
    return;
  }
  await supabase.auth.signOut();
}

/**
 * Subscribe to auth changes (login, logout, session expiry).
 * Returns an unsubscribe function.
 */
export function onAuthChange(callback) {
  if (isDemoMode) {
    const handler = () => callback(null);
    document.addEventListener('esst-demo-auth', handler);
    return () => document.removeEventListener('esst-demo-auth', handler);
  }
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Public member registration (no invite code required).
 * Creates the Supabase Auth user; the DB trigger creates the profile row.
 */
export async function signUp({ email, password, displayName }) {
  if (isDemoMode) return demoService.signUpDemo({ email, password, displayName });
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName?.trim() || '' } },
  });
  if (error) {
    const appError = new Error(error.message);
    appError.key = 'auth.error';
    throw appError;
  }
  return data;
}

/**
 * Update the allowed fields of the signed-in user's own profile.
 */
export async function updateProfile(fields) {
  if (isDemoMode) return demoService.updateProfileDemo(fields);
  const session = await getSession();
  if (!session?.user) throw new Error('NOT_AUTHENTICATED');
  const allowed = [
    'full_name', 'birth_year', 'main_position', 'secondary_position',
    'preferred_foot', 'height_cm', 'weight_kg', 'photo_url', 'nickname',
    'profile_complete',
  ];
  const payload = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) payload[k] = fields[k];
  }
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', session.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Captain check: is the signed-in user the active captain of the given team?
 */
export async function isCaptainOf(teamId) {
  if (isDemoMode) return demoService.isCaptainOfDemo(teamId);
  const session = await getSession();
  if (!session?.user) return false;
  const { data } = await supabase
    .from('team_memberships')
    .select('id')
    .eq('player_id', session.user.id)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .eq('role_in_team', 'captain')
    .maybeSingle();
  return !!data;
}
