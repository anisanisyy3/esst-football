-- ============================================================================
-- ESST Football Tournament - Migration 0002: enable Realtime updates
-- Run after 0001_init.sql in the Supabase SQL Editor.
-- This lets browsers receive an event whenever a match row changes.
-- ============================================================================

-- Full replica identity so the payload also contains old values.
alter table public.matches replica identity full;

-- Add the matches table to the realtime publication (ignore if already added).
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception
  when duplicate_object then null;
end $$;
