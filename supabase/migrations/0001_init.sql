-- ============================================================================
-- ESST Football Tournament - Migration 0001: initial schema + security
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- Profiles: one row per organizer account (created automatically by trigger).
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null default '',
  role         text not null default 'pending'
               check (role in ('pending', 'score_manager', 'super_admin')),
  created_at   timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);

-- Teams. Archived teams are hidden from the public site but kept in DB.
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  short_name  text not null unique,
  logo_url    text,
  description text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint teams_short_name_format
    check (char_length(btrim(short_name)) between 2 and 6)
);
create index if not exists teams_archived_idx on public.teams (archived);

-- Matches (the league fixtures).
create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  home_team_id uuid not null references public.teams (id) on delete cascade,
  away_team_id uuid not null references public.teams (id) on delete cascade,
  home_score   integer,
  away_score   integer,
  kickoff_at   timestamptz not null,
  venue        text,
  round_name   text,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint matches_home_team_id_fkey foreign key (home_team_id)
    references public.teams (id) on delete cascade,
  constraint matches_away_team_id_fkey foreign key (away_team_id)
    references public.teams (id) on delete cascade,
  constraint matches_teams_differ check (home_team_id <> away_team_id),
  constraint matches_scores_non_negative
    check ((home_score is null or home_score >= 0)
       and (away_score is null or away_score >= 0)),
  -- A live or finished match must always have both scores.
  constraint matches_scores_required
    check (status not in ('live', 'finished')
           or (home_score is not null and away_score is not null))
);
create index if not exists matches_home_team_idx on public.matches (home_team_id);
create index if not exists matches_away_team_idx on public.matches (away_team_id);
create index if not exists matches_status_idx   on public.matches (status);
create index if not exists matches_kickoff_idx  on public.matches (kickoff_at);

-- Immutable history of score / status changes (filled by a trigger).
create table if not exists public.match_audit_logs (
  id             bigint generated always as identity primary key,
  match_id       uuid not null references public.matches (id) on delete cascade,
  old_home_score integer,
  new_home_score integer,
  old_away_score integer,
  new_away_score integer,
  old_status     text,
  new_status     text,
  changed_by     uuid references public.profiles (id) on delete set null,
  changed_at     timestamptz not null default now()
);
create index if not exists match_audit_match_idx on public.match_audit_logs (match_id);
create index if not exists match_audit_time_idx  on public.match_audit_logs (changed_at desc);

-- Single-row tournament settings (public information).
create table if not exists public.tournament_settings (
  id              smallint primary key default 1 check (id = 1),
  tournament_name text not null default 'ESST Football Tournament',
  season_label    text not null default '',
  timezone        text not null default 'Africa/Algiers',
  points_for_win  integer not null default 3 check (points_for_win >= 0),
  points_for_draw integer not null default 1 check (points_for_draw >= 0),
  points_for_loss integer not null default 0 check (points_for_loss >= 0),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. TRIGGER: keep updated_at fresh
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.tournament_settings;
create trigger settings_set_updated_at
  before update on public.tournament_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. TRIGGER: stamp "who changed this match" + write audit log rows
-- ----------------------------------------------------------------------------
create or replace function public.handle_match_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.handle_match_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.home_score, new.away_score, new.status)
     is distinct from (old.home_score, old.away_score, old.status) then
    insert into public.match_audit_logs (
      match_id, old_home_score, new_home_score,
      old_away_score, new_away_score, old_status, new_status, changed_by
    ) values (
      new.id, old.home_score, new.home_score,
      old.away_score, new.away_score, old.status, new.status, auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists matches_before_update on public.matches;
create trigger matches_before_update
  before update on public.matches
  for each row execute function public.handle_match_before_update();

drop trigger if exists matches_audit on public.matches;
create trigger matches_audit
  after update on public.matches
  for each row execute function public.handle_match_audit();

-- ----------------------------------------------------------------------------
-- 4. TRIGGER: every new Supabase Auth user automatically gets a "pending"
--    profile. New accounts have NO permissions until a super admin approves.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name',
             split_part(coalesce(new.email, 'membre'), '@', 1)),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. SECURITY HELPER FUNCTIONS (used inside RLS policies)
--    security definer + fixed search_path so they can read profiles
--    without triggering profile RLS recursion.
-- ----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
$$;

create or replace function public.can_manage_matches()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('score_manager', 'super_admin')
  )
$$;

-- ----------------------------------------------------------------------------
-- 6. SECURE ROLE-CHANGE FUNCTION
--    The ONLY way roles ever change. Verifies the caller is a super admin,
--    forbids self role changes, and protects the last super admin.
-- ----------------------------------------------------------------------------
create or replace function public.change_manager_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'super_admin' then
    raise exception 'FORBIDDEN: only super administrators can change roles';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'FORBIDDEN: you cannot change your own role';
  end if;

  if new_role not in ('pending', 'score_manager', 'super_admin') then
    raise exception 'INVALID_ROLE';
  end if;

  select role into target_role from public.profiles where id = target_user_id;
  if target_role is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  -- Never allow removal of the last super administrator.
  if target_role = 'super_admin' and new_role <> 'super_admin' then
    if (select count(*) from public.profiles where role = 'super_admin') <= 1 then
      raise exception 'LAST_SUPER_ADMIN';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

revoke all on function public.change_manager_role(uuid, text) from public, anon;
grant execute on function public.change_manager_role(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 7. TRIGGER GUARD: nobody can ever UPDATE a profile role directly
--    (not even a score manager escalating themselves). Role changes must go
--    through change_manager_role(), which runs as the function owner.
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'service_role') then
    raise exception 'FORBIDDEN: role changes are only allowed via change_manager_role()';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY on every exposed table
-- ----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.teams               enable row level security;
alter table public.matches             enable row level security;
alter table public.match_audit_logs    enable row level security;
alter table public.tournament_settings enable row level security;

-- ----------------------------------------------------------------------------
-- 9. GRANTS: revoke the defaults, grant only what the app needs
-- ----------------------------------------------------------------------------
revoke all on public.profiles            from anon, authenticated;
revoke all on public.teams               from anon, authenticated;
revoke all on public.matches             from anon, authenticated;
revoke all on public.match_audit_logs    from anon, authenticated;
revoke all on public.tournament_settings from anon, authenticated;

-- Profiles: authenticated users may read (rows filtered by policy) and may
-- update ONLY their display_name. Emails are never readable by anonymous.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Teams: everyone reads published teams; only super admins write.
grant select on public.teams to anon, authenticated;
grant insert, update, delete on public.teams to authenticated;

-- Matches: everyone reads; score managers + super admins write.
grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;

-- Audit logs: super admins read only (rows written by the trigger).
grant select on public.match_audit_logs to authenticated;

-- Settings: everyone reads; super admins write.
grant select on public.tournament_settings to anon, authenticated;
grant insert, update on public.tournament_settings to authenticated;

-- ----------------------------------------------------------------------------
-- 10. POLICIES
-- ----------------------------------------------------------------------------

-- PROFILES -------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles_update_own_display_name" on public.profiles;
create policy "profiles_update_own_display_name"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- TEAMS ----------------------------------------------------------------------
drop policy if exists "teams_select_published" on public.teams;
create policy "teams_select_published"
  on public.teams for select to anon, authenticated
  using (archived = false or public.is_super_admin());

drop policy if exists "teams_insert_super_admin" on public.teams;
create policy "teams_insert_super_admin"
  on public.teams for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "teams_update_super_admin" on public.teams;
create policy "teams_update_super_admin"
  on public.teams for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "teams_delete_super_admin" on public.teams;
create policy "teams_delete_super_admin"
  on public.teams for delete to authenticated
  using (public.is_super_admin());

-- MATCHES --------------------------------------------------------------------
drop policy if exists "matches_select_everyone" on public.matches;
create policy "matches_select_everyone"
  on public.matches for select to anon, authenticated
  using (true);

drop policy if exists "matches_insert_managers" on public.matches;
create policy "matches_insert_managers"
  on public.matches for insert to authenticated
  with check (public.can_manage_matches());

drop policy if exists "matches_update_managers" on public.matches;
create policy "matches_update_managers"
  on public.matches for update to authenticated
  using (public.can_manage_matches())
  with check (public.can_manage_matches());

drop policy if exists "matches_delete_super_admin" on public.matches;
create policy "matches_delete_super_admin"
  on public.matches for delete to authenticated
  using (public.is_super_admin());

-- MATCH AUDIT LOGS -----------------------------------------------------------
drop policy if exists "audit_select_super_admin" on public.match_audit_logs;
create policy "audit_select_super_admin"
  on public.match_audit_logs for select to authenticated
  using (public.is_super_admin());

-- TOURNAMENT SETTINGS --------------------------------------------------------
drop policy if exists "settings_select_everyone" on public.tournament_settings;
create policy "settings_select_everyone"
  on public.tournament_settings for select to anon, authenticated
  using (true);

drop policy if exists "settings_write_super_admin" on public.tournament_settings;
create policy "settings_write_super_admin"
  on public.tournament_settings for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "settings_insert_super_admin" on public.tournament_settings;
create policy "settings_insert_super_admin"
  on public.tournament_settings for insert to authenticated
  with check (public.is_super_admin());
