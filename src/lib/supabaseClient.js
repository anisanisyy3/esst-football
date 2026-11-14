// ============================================================================
// SUPABASE CLIENT + DEMO MODE SWITCH
// - If BOTH environment variables are set -> real Supabase client.
// - If they are missing -> demo mode (local sample data, clearly labeled).
// - If Supabase is configured but unreachable -> errors are shown, we never
//   silently fall back to demo mode.
// Never place a service_role or secret key here: only the publishable/anon key.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// import.meta.env is always defined under Vite; the fallback keeps the module
// importable from plain Node (unit tests) without any build step.
const env = import.meta.env ?? {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (Boolean(url) !== Boolean(key)) {
  // Only one of the two values was provided: this is a configuration mistake.
  console.warn(
    '[ESST] Supabase configuration incomplete: set BOTH VITE_SUPABASE_URL ' +
      'and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file. ' +
      'The app will run in demo mode until then.'
  );
}

/** True when both Supabase env variables are present. */
export const SUPABASE_CONFIGURED = Boolean(url && key);

/** True when the app should use local demo data instead of Supabase. */
export const isDemoMode = !SUPABASE_CONFIGURED;

/** Shared Supabase client (null in demo mode). */
export const supabase = SUPABASE_CONFIGURED
  ? createClient(url, key, {
      auth: {
        persistSession: true, // the session survives page refresh
        autoRefreshToken: true, // expired sessions renew themselves
        detectSessionInUrl: true,
      },
    })
  : null;
