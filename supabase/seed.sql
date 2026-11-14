-- ============================================================================
-- ESST Football Tournament - seed.sql
-- Run after the migrations. Creates the single settings row.
-- Real teams and matches are added by the organizers through the dashboard.
-- ============================================================================

insert into public.tournament_settings (id)
values (1)
on conflict (id) do nothing;

-- (Optional) example teams - uncomment to pre-fill the directory:
-- insert into public.teams (name, short_name) values
--   ('Genie Electrique', 'GEL'),
--   ('Genie Mecanique',  'GME'),
--   ('Informatique',     'INF')
-- on conflict do nothing;
