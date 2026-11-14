-- ============================================================================
-- ESST Football Tournament - Migration 0003: player accounts, teams, lineups,
-- match reports, career stats, OVR ledger, private team space, notifications.
--
-- Run AFTER 0001_init.sql (and 0002 if it exists) in:
--   Supabase Dashboard > SQL Editor > New query
--
-- Idempotent: safe to re-run (uses if not exists / create or replace).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper: member check (any authenticated member)
-- ----------------------------------------------------------------------------
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'score_manager', 'super_admin')
  )
$$;

create or replace function public.is_captain_of(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_memberships
    where player_id = auth.uid()
      and team_id = p_team_id
      and status = 'active'
      and role_in_team = 'captain'
  )
$$;

-- ----------------------------------------------------------------------------
-- 1. PROFILES: extend for football members
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists full_name          text,
  add column if not exists birth_year         integer,
  add column if not exists main_position      text,
  add column if not exists secondary_position text,
  add column if not exists preferred_foot    text,
  add column if not exists height_cm          integer,
  add column if not exists weight_kg          integer,
  add column if not exists photo_url          text,
  add column if not exists nickname           text,
  add column if not exists profile_complete   boolean not null default false,
  add column if not exists ovr                integer not null default 60,
  add column if not exists updated_at         timestamptz not null default now();

-- Migrate the legacy 'pending' role into 'member'.
update public.profiles set role = 'member' where role = 'pending';

-- Drop the old role check and replace with the new one.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('member', 'score_manager', 'super_admin'));

-- Position / foot / privacy sanity checks.
alter table public.profiles
  add constraint profiles_main_position_check
    check (main_position is null or main_position in ('goalkeeper','defender','midfielder','forward')),
  add constraint profiles_secondary_position_check
    check (secondary_position is null or secondary_position in ('goalkeeper','defender','midfielder','forward')),
  add constraint profiles_preferred_foot_check
    check (preferred_foot is null or preferred_foot in ('right','left','both')),
  add constraint profiles_birth_year_check
    check (birth_year is null or (birth_year between 1950 and 2020)),
  add constraint profiles_height_check
    check (height_cm is null or (height_cm between 120 and 230)),
  add constraint profiles_weight_check
    check (weight_kg is null or (weight_kg between 30 and 160)),
  add constraint profiles_ovr_check
    check (ovr between 50 and 99);

create index if not exists profiles_role_idx2 on public.profiles (role);
create index if not exists profiles_main_position_idx on public.profiles (main_position);

-- Trigger to keep updated_at fresh on profiles.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. handle_new_user: new accounts are 'member' (no privileges until profile complete)
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
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. change_manager_role: update allowed roles
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

  if new_role not in ('member', 'score_manager', 'super_admin') then
    raise exception 'INVALID_ROLE';
  end if;

  select role into target_role from public.profiles where id = target_user_id;
  if target_role is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if target_role = 'super_admin' and new_role <> 'super_admin' then
    if (select count(*) from public.profiles where role = 'super_admin') <= 1 then
      raise exception 'LAST_SUPER_ADMIN';
    end if;
  end if;

  update public.profiles set role = new_role where id = target_user_id;
end;
$$;

-- guard_profile_role: block direct role updates by non-service users
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

-- ----------------------------------------------------------------------------
-- 4. STAFF ACCESS REQUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.staff_access_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  requested_task text not null,
  description    text,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  assigned_role  text check (assigned_role in ('score_manager','super_admin')),
  created_at     timestamptz not null default now()
);
create index if not exists staff_access_user_idx on public.staff_access_requests (user_id);
create index if not exists staff_access_status_idx on public.staff_access_requests (status);

-- ----------------------------------------------------------------------------
-- 5. TEAMS (already exists) - add captain linkage via memberships; no change here
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 6. TEAM MEMBERSHIPS
-- ----------------------------------------------------------------------------
create table if not exists public.team_memberships (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'active'
                 check (status in ('active','left','transferred_out')),
  role_in_team   text not null default 'player'
                 check (role_in_team in ('captain','player')),
  jersey_number  integer check (jersey_number is null or (jersey_number between 1 and 99)),
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  transferred_to uuid references public.teams (id) on delete set null
);
create index if not exists memberships_team_idx on public.team_memberships (team_id);
create index if not exists memberships_player_idx on public.team_memberships (player_id);
create index if not exists memberships_status_idx on public.team_memberships (status);

-- One active membership per player.
create unique index if not exists memberships_one_active_per_player
  on public.team_memberships (player_id) where (status = 'active');
-- Jersey number unique within a team's active roster.
create unique index if not exists memberships_jersey_unique_per_team
  on public.team_memberships (team_id, jersey_number) where (status = 'active' and jersey_number is not null);

-- ----------------------------------------------------------------------------
-- 7. TEAM JOIN REQUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.team_join_requests (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  player_id    uuid not null references public.profiles (id) on delete cascade,
  message      text,
  status       text not null default 'pending'
               check (status in ('pending','accepted','rejected','cancelled')),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists join_req_team_idx on public.team_join_requests (team_id);
create index if not exists join_req_player_idx on public.team_join_requests (player_id);
create index if not exists join_req_status_idx on public.team_join_requests (status);
-- No duplicate pending requests.
create unique index if not exists join_req_one_pending_per_pair
  on public.team_join_requests (team_id, player_id) where (status = 'pending');

-- ----------------------------------------------------------------------------
-- 8. TEAM CREATION REQUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.team_creation_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.profiles (id) on delete cascade,
  proposed_name  text not null,
  short_name     text not null,
  description    text,
  logo_url       text,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  approved_team_id uuid references public.teams (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists team_create_status_idx on public.team_creation_requests (status);

-- ----------------------------------------------------------------------------
-- 9. TEAM TRANSFER REQUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.team_transfer_requests (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.profiles (id) on delete cascade,
  from_team_id        uuid not null references public.teams (id) on delete cascade,
  to_team_id          uuid not null references public.teams (id) on delete cascade,
  reason              text,
  status              text not null default 'pending'
                      check (status in ('pending','captain_approved','approved','rejected','cancelled')),
  captain_reviewed_by uuid references public.profiles (id) on delete set null,
  captain_reviewed_at timestamptz,
  final_approved_by   uuid references public.profiles (id) on delete set null,
  final_approved_at   timestamptz,
  created_at          timestamptz not null default now(),
  constraint transfer_teams_differ check (from_team_id <> to_team_id)
);
create index if not exists transfer_player_idx on public.team_transfer_requests (player_id);
create index if not exists transfer_status_idx on public.team_transfer_requests (status);

-- ----------------------------------------------------------------------------
-- 10. MATCH LINEUPS (private draft -> locked snapshot at LIVE)
-- ----------------------------------------------------------------------------
create table if not exists public.match_lineups (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  formation      text not null,
  captain_id     uuid references public.profiles (id) on delete set null,
  vice_captain_id uuid references public.profiles (id) on delete set null,
  tactics        text,
  is_locked      boolean not null default false,
  is_public      boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null,
  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint lineups_one_per_team_match unique (match_id, team_id)
);
create index if not exists lineups_match_idx on public.match_lineups (match_id);
create index if not exists lineups_team_idx on public.match_lineups (team_id);

drop trigger if exists lineups_set_updated_at on public.match_lineups;
create trigger lineups_set_updated_at
  before update on public.match_lineups
  for each row execute function public.set_updated_at();

create table if not exists public.lineup_players (
  id              uuid primary key default gen_random_uuid(),
  lineup_id       uuid not null references public.match_lineups (id) on delete cascade,
  player_id       uuid not null references public.profiles (id) on delete cascade,
  jersey_number   integer not null check (jersey_number between 1 and 99),
  match_position  text not null check (match_position in ('goalkeeper','defender','midfielder','forward')),
  is_starter      boolean not null default false,
  is_captain      boolean not null default false,
  is_vice_captain boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint lineup_players_unique_per_lineup unique (lineup_id, player_id)
);
create index if not exists lineup_players_lineup_idx on public.lineup_players (lineup_id);
create index if not exists lineup_players_player_idx on public.lineup_players (player_id);

-- ----------------------------------------------------------------------------
-- 11. MATCH EVENTS (the single canonical event record)
-- ----------------------------------------------------------------------------
create table if not exists public.match_events (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches (id) on delete cascade,
  sequence          integer not null,
  event_type        text not null check (event_type in ('goal','yellow','red','sub')),
  detail            text check (detail is null or detail in ('normal','penalty','own_goal')),
  minute            integer not null check (minute between 0 and 130),
  extra_minute      integer check (extra_minute is null or extra_minute between 0 and 15),
  team_id           uuid not null references public.teams (id) on delete cascade,
  player_id         uuid not null references public.profiles (id) on delete cascade,
  related_player_id uuid references public.profiles (id) on delete set null,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint match_events_sub_requires_related
    check (event_type <> 'sub' or related_player_id is not null),
  constraint match_events_goal_detail_required
    check (event_type <> 'goal' or detail is not null)
);
create index if not exists match_events_match_idx on public.match_events (match_id, sequence);
create index if not exists match_events_team_idx on public.match_events (team_id);

-- ----------------------------------------------------------------------------
-- 12. MATCH REPORTS
-- ----------------------------------------------------------------------------
create table if not exists public.match_reports (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null unique references public.matches (id) on delete cascade,
  summary          text,
  referee_score_home integer check (referee_score_home is null or referee_score_home >= 0),
  referee_score_away integer check (referee_score_away is null or referee_score_away >= 0),
  status           text not null default 'draft'
                   check (status in ('draft','submitted','published','corrected')),
  submitted_by     uuid references public.profiles (id) on delete set null,
  submitted_at     timestamptz,
  corrected_by     uuid references public.profiles (id) on delete set null,
  corrected_at     timestamptz,
  correction_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists match_reports_set_updated_at on public.match_reports;
create trigger match_reports_set_updated_at
  before update on public.match_reports
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 13. PLAYER SUSPENSIONS
-- ----------------------------------------------------------------------------
create table if not exists public.player_suspensions (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.profiles (id) on delete cascade,
  team_id             uuid not null references public.teams (id) on delete cascade,
  red_card_match_id   uuid not null references public.matches (id) on delete cascade,
  suspended_for_match_id uuid references public.matches (id) on delete set null,
  status              text not null default 'pending'
                      check (status in ('pending','served')),
  created_at          timestamptz not null default now(),
  served_at           timestamptz
);
create index if not exists suspensions_player_idx on public.player_suspensions (player_id);
create index if not exists suspensions_team_idx on public.player_suspensions (team_id);

-- ----------------------------------------------------------------------------
-- 14. PLAYER MATCH APPEARANCES (materialized by the report function)
-- ----------------------------------------------------------------------------
create table if not exists public.player_match_appearances (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  player_id      uuid not null references public.profiles (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  match_position text not null check (match_position in ('goalkeeper','defender','midfielder','forward')),
  is_starter     boolean not null default false,
  entry_minute   integer not null,
  exit_minute    integer not null,
  minutes_played integer not null,
  created_at     timestamptz not null default now(),
  constraint appearances_unique_per_match_player unique (match_id, player_id)
);
create index if not exists appearances_player_idx on public.player_match_appearances (player_id);
create index if not exists appearances_match_idx on public.player_match_appearances (match_id);

-- ----------------------------------------------------------------------------
-- 15. PLAYER OVR LEDGER (auditable per-match)
-- ----------------------------------------------------------------------------
create table if not exists public.player_ovr_ledger (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  reason     text not null,
  delta      integer not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ovr_ledger_player_idx on public.player_ovr_ledger (player_id);
create index if not exists ovr_ledger_match_idx on public.player_ovr_ledger (match_id);

-- ----------------------------------------------------------------------------
-- 16. PRIVATE TEAM SPACE: posts / messages / announcements
-- ----------------------------------------------------------------------------
create table if not exists public.team_posts (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  title       text,
  body        text not null,
  post_type   text not null default 'post'
              check (post_type in ('announcement','post','message')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists team_posts_team_idx on public.team_posts (team_id, created_at desc);
drop trigger if exists team_posts_set_updated_at on public.team_posts;
create trigger team_posts_set_updated_at
  before update on public.team_posts
  for each row execute function public.set_updated_at();

create table if not exists public.team_messages (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists team_messages_team_idx on public.team_messages (team_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 17. NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read = false;

-- ----------------------------------------------------------------------------
-- 18. AUDIT LOGS (generic)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_time_idx on public.audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- 19. TOURNAMENT SETTINGS: add substitutions-per-match
-- ----------------------------------------------------------------------------
alter table public.tournament_settings
  add column if not exists substitutions_per_match integer not null default 5
  check (substitutions_per_match between 0 and 7);

-- ----------------------------------------------------------------------------
-- 20. RLS: enable on every new table
-- ----------------------------------------------------------------------------
alter table public.staff_access_requests    enable row level security;
alter table public.team_memberships         enable row level security;
alter table public.team_join_requests       enable row level security;
alter table public.team_creation_requests   enable row level security;
alter table public.team_transfer_requests   enable row level security;
alter table public.match_lineups            enable row level security;
alter table public.lineup_players           enable row level security;
alter table public.match_events             enable row level security;
alter table public.match_reports            enable row level security;
alter table public.player_suspensions       enable row level security;
alter table public.player_match_appearances enable row level security;
alter table public.player_ovr_ledger        enable row level security;
alter table public.team_posts               enable row level security;
alter table public.team_messages            enable row level security;
alter table public.notifications            enable row level security;
alter table public.audit_logs               enable row level security;

-- ----------------------------------------------------------------------------
-- 21. GRANTS
-- ----------------------------------------------------------------------------
revoke all on public.staff_access_requests, public.team_memberships, public.team_join_requests,
  public.team_creation_requests, public.team_transfer_requests, public.match_lineups,
  public.lineup_players, public.match_events, public.match_reports, public.player_suspensions,
  public.player_match_appearances, public.player_ovr_ledger, public.team_posts,
  public.team_messages, public.notifications, public.audit_logs
  from anon, authenticated;

grant select on public.staff_access_requests to authenticated;
grant insert on public.staff_access_requests to authenticated;

grant select on public.team_memberships to authenticated;
grant select on public.team_join_requests to authenticated;
grant insert on public.team_join_requests to authenticated;
grant select on public.team_creation_requests to authenticated;
grant insert on public.team_creation_requests to authenticated;
grant select on public.team_transfer_requests to authenticated;
grant insert on public.team_transfer_requests to authenticated;

grant select on public.match_lineups to anon, authenticated;
grant select on public.lineup_players to anon, authenticated;
grant select on public.match_events to anon, authenticated;
grant select on public.match_reports to anon, authenticated;
grant select on public.player_suspensions to authenticated;
grant select on public.player_match_appearances to authenticated;
grant select on public.player_ovr_ledger to authenticated;
grant select on public.team_posts to authenticated;
grant select on public.team_messages to authenticated;
grant select on public.notifications to authenticated;
grant insert on public.notifications to authenticated;

-- ----------------------------------------------------------------------------
-- 22. POLICIES
-- ----------------------------------------------------------------------------

-- staff_access_requests: a member creates their own; super admin reads all.
drop policy if exists "staff_req_insert_own" on public.staff_access_requests;
create policy "staff_req_insert_own"
  on public.staff_access_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "staff_req_select_own_or_admin" on public.staff_access_requests;
create policy "staff_req_select_own_or_admin"
  on public.staff_access_requests for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- team_memberships: members see their own + teammates; team members see roster.
drop policy if exists "memberships_select_own_or_teammate" on public.team_memberships;
create policy "memberships_select_own_or_teammate"
  on public.team_memberships for select to authenticated
  using (
    player_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.team_memberships m2
      where m2.player_id = auth.uid() and m2.team_id = team_memberships.team_id and m2.status = 'active'
    )
  );

-- team_join_requests: requester sees own; captain sees requests for their team.
drop policy if exists "join_req_select" on public.team_join_requests;
create policy "join_req_select"
  on public.team_join_requests for select to authenticated
  using (
    player_id = auth.uid()
    or public.is_super_admin()
    or public.is_captain_of(team_id)
  );

drop policy if exists "join_req_insert_own" on public.team_join_requests;
create policy "join_req_insert_own"
  on public.team_join_requests for insert to authenticated
  with check (player_id = auth.uid() and public.is_member());

-- team_creation_requests: requester sees own; super admin sees all.
drop policy if exists "team_create_select" on public.team_creation_requests;
create policy "team_create_select"
  on public.team_creation_requests for select to authenticated
  using (requester_id = auth.uid() or public.is_super_admin());

drop policy if exists "team_create_insert" on public.team_creation_requests;
create policy "team_create_insert"
  on public.team_creation_requests for insert to authenticated
  with check (requester_id = auth.uid() and public.is_member());

-- team_transfer_requests: player sees own; captains of both teams; super admin.
drop policy if exists "transfer_select" on public.team_transfer_requests;
create policy "transfer_select"
  on public.team_transfer_requests for select to authenticated
  using (
    player_id = auth.uid()
    or public.is_super_admin()
    or public.is_captain_of(from_team_id)
    or public.is_captain_of(to_team_id)
  );

drop policy if exists "transfer_insert" on public.team_transfer_requests;
create policy "transfer_insert"
  on public.team_transfer_requests for insert to authenticated
  with check (player_id = auth.uid() and public.is_member());

-- match_lineups: private until locked/public. Captain of the team or super admin can write.
drop policy if exists "lineups_select" on public.match_lineups;
create policy "lineups_select"
  on public.match_lineups for select to anon, authenticated
  using (
    is_public = true
    or public.is_super_admin()
    or (auth.uid() is not null and public.is_captain_of(team_id))
    or (auth.uid() is not null and exists (
          select 1 from public.team_memberships m
          where m.player_id = auth.uid() and m.team_id = match_lineups.team_id and m.status = 'active'
        ))
  );

drop policy if exists "lineups_write_captain" on public.match_lineups;
create policy "lineups_write_captain"
  on public.match_lineups for all to authenticated
  using (public.is_captain_of(team_id) or public.is_super_admin())
  with check (public.is_captain_of(team_id) or public.is_super_admin());

-- lineup_players: follows the parent lineup's visibility.
drop policy if exists "lineup_players_select" on public.lineup_players;
create policy "lineup_players_select"
  on public.lineup_players for select to anon, authenticated
  using (
    exists (
      select 1 from public.match_lineups l
      where l.id = lineup_players.lineup_id
        and (
          l.is_public = true
          or public.is_super_admin()
          or public.is_captain_of(l.team_id)
          or exists (select 1 from public.team_memberships m
                     where m.player_id = auth.uid() and m.team_id = l.team_id and m.status = 'active')
        )
    )
  );

drop policy if exists "lineup_players_write" on public.lineup_players;
create policy "lineup_players_write"
  on public.lineup_players for all to authenticated
  using (
    exists (select 1 from public.match_lineups l
            where l.id = lineup_players.lineup_id
              and (public.is_captain_of(l.team_id) or public.is_super_admin()))
  )
  with check (
    exists (select 1 from public.match_lineups l
            where l.id = lineup_players.lineup_id
              and (public.is_captain_of(l.team_id) or public.is_super_admin()))
  );

-- match_events: public once the match is live/finished; managers write.
drop policy if exists "match_events_select" on public.match_events;
create policy "match_events_select"
  on public.match_events for select to anon, authenticated
  using (
    exists (select 1 from public.matches m where m.id = match_events.match_id
            and m.status in ('live','finished'))
    or public.is_super_admin()
    or public.can_manage_matches()
  );

drop policy if exists "match_events_write" on public.match_events;
create policy "match_events_write"
  on public.match_events for all to authenticated
  using (public.can_manage_matches() or public.is_super_admin())
  with check (public.can_manage_matches() or public.is_super_admin());

-- match_reports: public once published; managers write.
drop policy if exists "match_reports_select" on public.match_reports;
create policy "match_reports_select"
  on public.match_reports for select to anon, authenticated
  using (
    status in ('published','corrected')
    or public.is_super_admin()
    or public.can_manage_matches()
  );

drop policy if exists "match_reports_write" on public.match_reports;
create policy "match_reports_write"
  on public.match_reports for all to authenticated
  using (public.can_manage_matches() or public.is_super_admin())
  with check (public.can_manage_matches() or public.is_super_admin());

-- player_suspensions: member sees own; team members see teammates'; admin all.
drop policy if exists "suspensions_select" on public.player_suspensions;
create policy "suspensions_select"
  on public.player_suspensions for select to authenticated
  using (
    player_id = auth.uid()
    or public.is_super_admin()
    or exists (select 1 from public.team_memberships m
               where m.player_id = auth.uid() and m.team_id = player_suspensions.team_id and m.status = 'active')
  );

-- player_match_appearances: member sees own + teammates; admin all.
drop policy if exists "appearances_select" on public.player_match_appearances;
create policy "appearances_select"
  on public.player_match_appearances for select to authenticated
  using (
    player_id = auth.uid()
    or public.is_super_admin()
    or exists (select 1 from public.team_memberships m
               where m.player_id = auth.uid() and m.team_id = player_match_appearances.team_id and m.status = 'active')
  );

-- player_ovr_ledger: member sees own; admin all.
drop policy if exists "ovr_ledger_select" on public.player_ovr_ledger;
create policy "ovr_ledger_select"
  on public.player_ovr_ledger for select to authenticated
  using (player_id = auth.uid() or public.is_super_admin());

-- team_posts / team_messages: only active team members + admin.
drop policy if exists "team_posts_select" on public.team_posts;
create policy "team_posts_select"
  on public.team_posts for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.team_memberships m
               where m.player_id = auth.uid() and m.team_id = team_posts.team_id and m.status = 'active')
  );

drop policy if exists "team_posts_write" on public.team_posts;
create policy "team_posts_write"
  on public.team_posts for all to authenticated
  using (
    public.is_super_admin()
    or (author_id = auth.uid() and exists (select 1 from public.team_memberships m
                                           where m.player_id = auth.uid() and m.team_id = team_posts.team_id and m.status = 'active'))
  )
  with check (
    public.is_super_admin()
    or (author_id = auth.uid() and exists (select 1 from public.team_memberships m
                                           where m.player_id = auth.uid() and m.team_id = team_posts.team_id and m.status = 'active'))
  );

drop policy if exists "team_messages_select" on public.team_messages;
create policy "team_messages_select"
  on public.team_messages for select to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.team_memberships m
               where m.player_id = auth.uid() and m.team_id = team_messages.team_id and m.status = 'active')
  );

drop policy if exists "team_messages_insert" on public.team_messages;
create policy "team_messages_insert"
  on public.team_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.team_memberships m
                where m.player_id = auth.uid() and m.team_id = team_messages.team_id and m.status = 'active')
  );

-- notifications: own only.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_insert_own_or_admin" on public.notifications;
create policy "notifications_insert_own_or_admin"
  on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_logs: super admin read only.
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select to authenticated
  using (public.is_super_admin());

-- profiles: extend grants for new columns (members update their own allowed fields).
grant update (full_name, birth_year, main_position, secondary_position, preferred_foot,
              height_cm, weight_kg, photo_url, nickname, profile_complete)
  on public.profiles to authenticated;

-- profiles select: any member can read football-facing info of other members.
drop policy if exists "profiles_select_member_football" on public.profiles;
create policy "profiles_select_member_football"
  on public.profiles for select to authenticated
  using (public.is_member());

-- Replace the old "profiles_select_own_or_admin" policy (kept for backward compat but now members can read members).
-- (Drop the stricter one so the member policy applies.)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;

-- profiles update: a member edits only their own allowed fields; admins via service role.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 23. SECURE FUNCTIONS (multi-step, security definer, fixed search_path)
-- ----------------------------------------------------------------------------

-- 23a. Bootstrap the first super admin (only works if NO super admin exists).
create or replace function public.bootstrap_super_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where role = 'super_admin') then
    raise exception 'BOOTSTRAP_DISABLED: a super admin already exists';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;
  update public.profiles set role = 'super_admin' where id = target_user_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (target_user_id, 'bootstrap_super_admin', 'profile', target_user_id::text);
end;
$$;
revoke all on function public.bootstrap_super_admin(uuid) from public, anon;
grant execute on function public.bootstrap_super_admin(uuid) to authenticated;

-- 23b. Submit a staff access request (no privileges granted).
create or replace function public.submit_staff_request(p_task text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_member() then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.staff_access_requests (user_id, requested_task, description)
  values (auth.uid(), p_task, p_description)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.submit_staff_request(text, text) from public, anon;
grant execute on function public.submit_staff_request(text, text) to authenticated;

-- 23c. Approve/reject a staff request (super admin only).
create or replace function public.review_staff_request(p_request_id uuid, p_approve boolean, p_assigned_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select * into req from public.staff_access_requests where id = p_request_id;
  if req is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  if p_approve and p_assigned_role not in ('score_manager','super_admin') then
    raise exception 'INVALID_ROLE';
  end if;

  if p_approve then
    update public.staff_access_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
          assigned_role = p_assigned_role
      where id = p_request_id;
    -- Role change goes through the secured function (last-super-admin guard).
    perform public.change_manager_role(req.user_id, p_assigned_role);
  else
    update public.staff_access_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_approve then 'approve_staff_request' else 'reject_staff_request' end,
          'staff_access_request', p_request_id::text,
          jsonb_build_object('user_id', req.user_id, 'assigned_role', p_assigned_role));
end;
$$;
revoke all on function public.review_staff_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_staff_request(uuid, boolean, text) to authenticated;

-- 23d. Request team creation.
create or replace function public.request_team_creation(p_name text, p_short text, p_description text, p_logo_url text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_member() then raise exception 'FORBIDDEN'; end if;
  insert into public.team_creation_requests (requester_id, proposed_name, short_name, description, logo_url)
  values (auth.uid(), p_name, p_short, p_description, p_logo_url)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.request_team_creation(text, text, text, text) from public, anon;
grant execute on function public.request_team_creation(text, text, text, text) to authenticated;

-- 23e. Approve team creation (super admin) -> creates team + captain membership.
create or replace function public.approve_team_creation(p_request_id uuid, p_approve boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  new_team_id uuid;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select * into req from public.team_creation_requests where id = p_request_id;
  if req is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;

  if p_approve then
    insert into public.teams (name, short_name, description, logo_url)
    values (req.proposed_name, req.short_name, req.description, req.logo_url)
    returning id into new_team_id;

    -- Captain membership (the requester becomes captain automatically).
    insert into public.team_memberships (team_id, player_id, status, role_in_team)
    values (new_team_id, req.requester_id, 'active', 'captain');

    update public.team_creation_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
          approved_team_id = new_team_id
      where id = p_request_id;
  else
    update public.team_creation_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_approve then 'approve_team_creation' else 'reject_team_creation' end,
          'team_creation_request', p_request_id::text,
          jsonb_build_object('approved_team_id', new_team_id));

  return new_team_id;
end;
$$;
revoke all on function public.approve_team_creation(uuid, boolean) from public, anon;
grant execute on function public.approve_team_creation(uuid, boolean) to authenticated;

-- 23f. Request to join a team.
create or replace function public.request_join_team(p_team_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_member() then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.team_memberships where player_id = auth.uid() and status = 'active') then
    raise exception 'ALREADY_IN_A_TEAM';
  end if;
  insert into public.team_join_requests (team_id, player_id, message)
  values (p_team_id, auth.uid(), p_message)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.request_join_team(uuid, text) from public, anon;
grant execute on function public.request_join_team(uuid, text) to authenticated;

-- 23g. Captain accepts/rejects a join request (race-safe 45 cap).
create or replace function public.decide_join_request(p_request_id uuid, p_accept boolean, p_jersey_number integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  active_count integer;
begin
  select * into req from public.team_join_requests where id = p_request_id;
  if req is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  if not (public.is_captain_of(req.team_id) or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  if p_accept then
    -- Race-safe capacity check: lock the team's membership rows.
    select count(*) into active_count
      from public.team_memberships
      where team_id = req.team_id and status = 'active'
      for update;
    if active_count >= 45 then
      raise exception 'TEAM_FULL';
    end if;
    if exists (select 1 from public.team_memberships where player_id = req.player_id and status = 'active') then
      raise exception 'ALREADY_IN_A_TEAM';
    end if;

    update public.team_join_requests
      set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request_id;

    insert into public.team_memberships (team_id, player_id, status, role_in_team, jersey_number)
    values (req.team_id, req.player_id, 'active', 'player', p_jersey_number);
  else
    update public.team_join_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_accept then 'accept_join_request' else 'reject_join_request' end,
          'team_join_request', p_request_id::text,
          jsonb_build_object('player_id', req.player_id, 'team_id', req.team_id));
end;
$$;
revoke all on function public.decide_join_request(uuid, boolean, integer) from public, anon;
grant execute on function public.decide_join_request(uuid, boolean, integer) to authenticated;

-- 23h. Transfer request workflow.
create or replace function public.request_transfer(p_from_team uuid, p_to_team uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if not public.is_member() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.team_memberships where player_id = auth.uid() and team_id = p_from_team and status = 'active') then
    raise exception 'NOT_A_MEMBER_OF_SOURCE_TEAM';
  end if;
  insert into public.team_transfer_requests (player_id, from_team_id, to_team_id, reason)
  values (auth.uid(), p_from_team, p_to_team, p_reason)
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.request_transfer(uuid, uuid, text) from public, anon;
grant execute on function public.request_transfer(uuid, uuid, text) to authenticated;

create or replace function public.captain_approve_transfer(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select * into req from public.team_transfer_requests where id = p_request_id;
  if req is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  if not (public.is_captain_of(req.to_team_id) or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  if p_accept then
    update public.team_transfer_requests
      set status = 'captain_approved', captain_reviewed_by = auth.uid(), captain_reviewed_at = now()
      where id = p_request_id;
  else
    update public.team_transfer_requests
      set status = 'rejected', captain_reviewed_by = auth.uid(), captain_reviewed_at = now()
      where id = p_request_id;
  end if;
end;
$$;
revoke all on function public.captain_approve_transfer(uuid, boolean) from public, anon;
grant execute on function public.captain_approve_transfer(uuid, boolean) to authenticated;

create or replace function public.finalize_transfer(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  active_count integer;
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  select * into req from public.team_transfer_requests where id = p_request_id;
  if req is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.status not in ('captain_approved') then
    -- Super admin may also approve directly from pending.
    if req.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  end if;

  if p_approve then
    -- Race-safe capacity check on the receiving team.
    select count(*) into active_count
      from public.team_memberships
      where team_id = req.to_team_id and status = 'active'
      for update;
    if active_count >= 45 then raise exception 'TEAM_FULL'; end if;

    -- Close the old membership, open the new one, atomically.
    update public.team_memberships
      set status = 'transferred_out', left_at = now(), transferred_to = req.to_team_id
      where player_id = req.player_id and team_id = req.from_team_id and status = 'active';

    insert into public.team_memberships (team_id, player_id, status, role_in_team)
    values (req.to_team_id, req.player_id, 'active', 'player');

    update public.team_transfer_requests
      set status = 'approved', final_approved_by = auth.uid(), final_approved_at = now()
      where id = p_request_id;
  else
    update public.team_transfer_requests
      set status = 'rejected', final_approved_by = auth.uid(), final_approved_at = now()
      where id = p_request_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_approve then 'approve_transfer' else 'reject_transfer' end,
          'team_transfer_request', p_request_id::text,
          jsonb_build_object('player_id', req.player_id, 'from', req.from_team_id, 'to', req.to_team_id));
end;
$$;
revoke all on function public.finalize_transfer(uuid, boolean) from public, anon;
grant execute on function public.finalize_transfer(uuid, boolean) to authenticated;

-- 23i. Save a lineup (captain only) - validates 11 starters / <=7 subs / no dupes / no suspended.
create or replace function public.save_lineup(
  p_match_id uuid,
  p_team_id uuid,
  p_formation text,
  p_captain_id uuid,
  p_vice_captain_id uuid,
  p_tactics text,
  p_players jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lineup_id uuid;
  v_player jsonb;
  v_starters integer := 0;
  v_subs integer := 0;
  v_seen uuid[] := '{}';
  v_jerseys integer[] := '{}';
  v_captains integer := 0;
  v_suspended uuid[];
begin
  if not (public.is_captain_of(p_team_id) or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  -- Suspended players for this team at this match.
  select coalesce(array_agg(ps.player_id), '{}') into v_suspended
    from public.player_suspensions ps
    where ps.team_id = p_team_id and ps.status = 'pending'
      and (ps.suspended_for_match_id is null or ps.suspended_for_match_id = p_match_id);

  -- Validate counts and uniqueness.
  for v_player in select * from jsonb_array_elements(p_players) loop
    if (v_player->>'player_id')::uuid = any(v_seen) then
      raise exception 'DUPLICATE_PLAYER';
    end if;
    v_seen := v_seen || (v_player->>'player_id')::uuid;

    if (v_player->>'player_id')::uuid = any(v_suspended) then
      raise exception 'SUSPENDED_PLAYER';
    end if;

    if (v_player->>'is_starter')::boolean then v_starters := v_starters + 1;
    else v_subs := v_subs + 1; end if;

    if (v_player->>'jersey_number')::integer = any(v_jerseys) then
      raise exception 'DUPLICATE_JERSEY';
    end if;
    v_jerseys := v_jerseys || (v_player->>'jersey_number')::integer;

    if (v_player->>'is_captain')::boolean then v_captains := v_captains + 1; end if;
  end loop;

  if v_starters <> 11 then raise exception 'STARTERS_MUST_BE_11'; end if;
  if v_subs > 7 then raise exception 'TOO_MANY_SUBS'; end if;
  if v_captains <> 1 then raise exception 'EXACTLY_ONE_CAPTAIN'; end if;

  -- Upsert the lineup header.
  insert into public.match_lineups (match_id, team_id, formation, captain_id, vice_captain_id, tactics, created_by, updated_by)
  values (p_match_id, p_team_id, p_formation, p_captain_id, p_vice_captain_id, p_tactics, auth.uid(), auth.uid())
  on conflict (match_id, team_id) do update
    set formation = excluded.formation,
        captain_id = excluded.captain_id,
        vice_captain_id = excluded.vice_captain_id,
        tactics = excluded.tactics,
        updated_by = auth.uid(),
        updated_at = now()
  returning id into v_lineup_id;

  -- Only editable while not locked.
  if exists (select 1 from public.match_lineups where id = v_lineup_id and is_locked) then
    raise exception 'LINEUP_LOCKED';
  end if;

  -- Replace players.
  delete from public.lineup_players where lineup_id = v_lineup_id;
  for v_player in select * from jsonb_array_elements(p_players) loop
    insert into public.lineup_players (lineup_id, player_id, jersey_number, match_position, is_starter, is_captain, is_vice_captain)
    values (
      v_lineup_id,
      (v_player->>'player_id')::uuid,
      (v_player->>'jersey_number')::integer,
      v_player->>'match_position',
      (v_player->>'is_starter')::boolean,
      coalesce((v_player->>'is_captain')::boolean, false),
      coalesce((v_player->>'is_vice_captain')::boolean, false)
    );
  end loop;

  return v_lineup_id;
end;
$$;
revoke all on function public.save_lineup(uuid, uuid, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.save_lineup(uuid, uuid, text, uuid, uuid, text, jsonb) to authenticated;

-- 23j. Mark a match LIVE -> locks both teams' lineups and publishes them.
create or replace function public.mark_match_live(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  home_lineup uuid;
  away_lineup uuid;
begin
  if not (public.can_manage_matches() or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;
  select * into m from public.matches where id = p_match_id;
  if m is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.status <> 'scheduled' then raise exception 'MATCH_NOT_SCHEDULABLE'; end if;

  select id into home_lineup from public.match_lineups where match_id = p_match_id and team_id = m.home_team_id;
  select id into away_lineup from public.match_lineups where match_id = p_match_id and team_id = m.away_team_id;
  if home_lineup is null or away_lineup is null then
    raise exception 'LINEUPS_REQUIRED';
  end if;

  -- Lock and publish both lineups (freeze the snapshot).
  update public.match_lineups set is_locked = true, is_public = true where id in (home_lineup, away_lineup);

  -- Set match live with both scores (required by constraint).
  update public.matches
    set status = 'live',
        home_score = coalesce(home_score, 0),
        away_score = coalesce(away_score, 0)
    where id = p_match_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'mark_match_live', 'match', p_match_id::text);
end;
$$;
revoke all on function public.mark_match_live(uuid) from public, anon;
grant execute on function public.mark_match_live(uuid) to authenticated;

-- 23k. Submit (publish) a match report -> derives score, materializes appearances,
--       OVR ledger, suspensions, and marks the match finished.
-- The heavy lifting mirrors src/utils/{matchEvents,career,ovr,suspensions}.js.
-- This function is the canonical server-side implementation.
create or replace function public.submit_match_report(
  p_match_id uuid,
  p_events jsonb,
  p_summary text,
  p_referee_home integer,
  p_referee_away integer,
  p_appearances jsonb default '[]'::jsonb,
  p_ovr_rows jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_home_score integer := 0;
  v_away_score integer := 0;
  ev jsonb;
  v_detail text;
  v_minute integer;
  v_extra integer;
  v_team uuid;
  v_player uuid;
  v_related uuid;
  v_seq integer := 0;
  v_home_lineup uuid;
  v_away_lineup uuid;
begin
  if not (public.can_manage_matches() or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  select * into m from public.matches where id = p_match_id;
  if m is null then raise exception 'MATCH_NOT_FOUND'; end if;
  if m.status not in ('live','finished') then raise exception 'MATCH_NOT_LIVE_OR_FINISHED'; end if;

  -- Clear any previously-derived rows for this match (idempotent re-submit).
  delete from public.match_events where match_id = p_match_id;
  delete from public.player_match_appearances where match_id = p_match_id;
  delete from public.player_ovr_ledger where match_id = p_match_id;
  delete from public.player_suspensions where red_card_match_id = p_match_id;

  -- Insert events in given order; sequence renumbered by minute below.
  for ev in select * from jsonb_array_elements(p_events) loop
    v_detail := ev->>'detail';
    if v_detail = '' then v_detail := null; end if;
    v_minute := (ev->>'minute')::integer;
    v_extra := nullif(ev->>'extra_minute', '')::integer;
    v_team := (ev->>'team_id')::uuid;
    v_player := (ev->>'player_id')::uuid;
    v_related := nullif(ev->>'related_player_id', '')::uuid;

    if ev->>'event_type' = 'goal' then
      if v_detail is null then v_detail := 'normal'; end if;
      if v_team = m.home_team_id then v_home_score := v_home_score + 1;
      elsif v_team = m.away_team_id then v_away_score := v_away_score + 1; end if;
    end if;

    v_seq := v_seq + 1;
    insert into public.match_events (match_id, sequence, event_type, detail, minute, extra_minute, team_id, player_id, related_player_id, created_by)
    values (p_match_id, v_seq, ev->>'event_type', v_detail, v_minute, v_extra, v_team, v_player, v_related, auth.uid());
  end loop;

  -- Cross-check referee score if provided.
  if p_referee_home is not null or p_referee_away is not null then
    if coalesce(p_referee_home, v_home_score) <> v_home_score
       or coalesce(p_referee_away, v_away_score) <> v_away_score then
      raise exception 'SCORE_MISMATCH';
    end if;
  end if;

  -- Re-sequence events chronologically (minute*100 + extra).
  with ranked as (
    select id, row_number() over (order by minute asc, coalesce(extra_minute,0) asc, created_at asc) as rn
    from public.match_events where match_id = p_match_id
  )
  update public.match_events me set sequence = r.rn from ranked r where me.id = r.id;

  -- Update the match score + status.
  update public.matches
    set home_score = v_home_score, away_score = v_away_score, status = 'finished'
    where id = p_match_id;

  -- Upsert the report.
  insert into public.match_reports (match_id, summary, referee_score_home, referee_score_away, status, submitted_by, submitted_at)
  values (p_match_id, p_summary, p_referee_home, p_referee_away, 'published', auth.uid(), now())
  on conflict (match_id) do update
    set summary = excluded.summary,
        referee_score_home = excluded.referee_score_home,
        referee_score_away = excluded.referee_score_away,
        status = 'published',
        submitted_by = auth.uid(),
        submitted_at = now(),
        updated_at = now();

  -- Materialize appearances (passed by the client, computed from lineups + events).
  for ev in select * from jsonb_array_elements(p_appearances) loop
    insert into public.player_match_appearances
      (match_id, player_id, team_id, match_position, is_starter, entry_minute, exit_minute, minutes_played)
    values (
      p_match_id,
      (ev->>'player_id')::uuid,
      (ev->>'team_id')::uuid,
      ev->>'match_position',
      (ev->>'is_starter')::boolean,
      (ev->>'entry_minute')::integer,
      (ev->>'exit_minute')::integer,
      (ev->>'minutes_played')::integer
    )
    on conflict (match_id, player_id) do update
      set team_id = excluded.team_id,
          match_position = excluded.match_position,
          is_starter = excluded.is_starter,
          entry_minute = excluded.entry_minute,
          exit_minute = excluded.exit_minute,
          minutes_played = excluded.minutes_played;
  end loop;

  -- Materialize OVR ledger rows (passed by the client, computed from official rules).
  for ev in select * from jsonb_array_elements(p_ovr_rows) loop
    insert into public.player_ovr_ledger (player_id, match_id, reason, delta, meta)
    values (
      (ev->>'player_id')::uuid,
      p_match_id,
      ev->>'reason',
      (ev->>'delta')::integer,
      ev->'meta'
    );
  end loop;

  -- Recompute affected players' OVR from the ledger (chronological, clamped).
  -- (Done by the client in demo mode; in production this is a follow-up job
  --  or an edge function. The ledger is the audit source of truth.)

  -- Auto-create suspensions for red cards.
  for ev in select * from public.match_events where match_id = p_match_id and event_type = 'red' loop
    insert into public.player_suspensions (player_id, team_id, red_card_match_id, status)
    values (ev.player_id, ev.team_id, p_match_id, 'pending')
    on conflict do nothing;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'submit_match_report', 'match', p_match_id::text,
          jsonb_build_object('home_score', v_home_score, 'away_score', v_away_score));
end;
$$;
revoke all on function public.submit_match_report(uuid, jsonb, text, integer, integer) from public, anon;
grant execute on function public.submit_match_report(uuid, jsonb, text, integer, integer, jsonb, jsonb) to authenticated;

-- 23l. Correct a report (super admin) - recompute friendly: clears derived rows
--      and lets the manager re-submit; audited.
create or replace function public.correct_match_report(p_match_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  -- Clear derived rows so a fresh submit_match_report rebuilds them (no double count).
  delete from public.match_events where match_id = p_match_id;
  delete from public.player_match_appearances where match_id = p_match_id;
  delete from public.player_ovr_ledger where match_id = p_match_id;
  delete from public.player_suspensions where red_card_match_id = p_match_id;

  update public.match_reports
    set status = 'corrected', corrected_by = auth.uid(), corrected_at = now(),
        correction_note = p_note
    where match_id = p_match_id;

  -- Re-open the match for re-submission (back to live).
  update public.matches set status = 'live' where id = p_match_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'correct_match_report', 'match', p_match_id::text,
          jsonb_build_object('note', p_note));
end;
$$;
revoke all on function public.correct_match_report(uuid, text) from public, anon;
grant execute on function public.correct_match_report(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 24. Realtime: publish the tables the app subscribes to
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.team_posts;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.match_reports;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.match_events;
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 25. Storage buckets (profile photos + team logos)
--     (Buckets are created via the Storage API; policies below assume they exist.)
-- ----------------------------------------------------------------------------
-- Bucket creation is done in the Supabase dashboard (Storage > New bucket):
--   - "profile-photos" (public read, auth write own folder)
--   - "team-logos" (public read, admin write)
-- The policies below are applied to storage.objects.

-- Allow public read of both buckets.
drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('profile-photos', 'team-logos'));

-- Allow a member to upload/update/delete their own profile photo (folder = user id).
drop policy if exists "storage_profile_photo_write_own" on storage.objects;
create policy "storage_profile_photo_write_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_profile_photo_update_own" on storage.objects;
create policy "storage_profile_photo_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_profile_photo_delete_own" on storage.objects;
create policy "storage_profile_photo_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only super admins manage team logos.
drop policy if exists "storage_team_logo_admin" on storage.objects;
create policy "storage_team_logo_admin"
  on storage.objects for all to authenticated
  using (bucket_id = 'team-logos' and public.is_super_admin())
  with check (bucket_id = 'team-logos' and public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 26. Seed: ensure a single-row tournament settings row exists
-- ----------------------------------------------------------------------------
insert into public.tournament_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- END OF MIGRATION 0003
-- ============================================================================
