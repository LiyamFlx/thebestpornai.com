-- StreamHub — views: stop 401 noise on re-views (same client, same day).
-- Paste into Supabase SQL Editor and Run.
--
-- Problem: schema-views-dedupe.sql used an RLS WITH CHECK that rejects a second
-- insert for the same (video_id, client_id) within 24h. PostgREST surfaces that
-- RLS failure as HTTP 401, so every page refresh / re-open logs:
--   Failed to load resource: the server responded with a status of 401 ()
-- against /rest/v1/views — even though the app treats it as best-effort.
--
-- Fix: allow all inserts with a non-null client_id, enforce one row per
-- (video, client, UTC day) with a unique index, and let the client send
-- Prefer: resolution=ignore-duplicates (see streamhub-api.js addView).

-- 1) Drop any same-day duplicates so the unique index can be created
delete from public.views a
  using public.views b
 where a.id > b.id
   and a.video_id = b.video_id
   and a.client_id is not distinct from b.client_id
   and ((timezone('utc', a.created_at))::date)
     = ((timezone('utc', b.created_at))::date);

-- 2) Unique: one view row per client per video per UTC calendar day
create unique index if not exists views_one_per_client_per_day
  on public.views (
    video_id,
    client_id,
    ((timezone('utc', created_at))::date)
  );

-- 3) Replace RLS gate (reject → 401) with simple non-null client_id check
drop policy if exists "public insert views" on public.views;
create policy "public insert views" on public.views
  for insert
  with check (client_id is not null);

-- Read stays public
drop policy if exists "public read views" on public.views;
create policy "public read views" on public.views
  for select
  using (true);
