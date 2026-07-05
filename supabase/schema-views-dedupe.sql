-- StreamHub — views anti-inflation fix.
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query → Run).
--
-- Context: `views` (schema-views.sql) has no client_id, so a single visitor
-- (or a trivial script) can insert unlimited view rows per video, inflating
-- view counts arbitrarily. This mirrors the schema-likes-fix.sql pattern:
-- add client_id, require it, and cap it to one view row per (video, client)
-- per rolling window — we use a simple one-row-per-day cap rather than a
-- hard unique constraint, since genuine repeat views across days are real.

alter table public.views
  add column if not exists client_id text;

-- No index on client_id here: the only lookup that filters on it is the
-- dedup check below, which is already scoped by video_id first (via
-- views_video_idx) — a standalone client_id index is never used for it.
-- (schema-views-drop-unused-index.sql owns dropping it if it was created by
-- an earlier run of this file.)

update public.views
  set client_id = 'legacy'
  where client_id is null;

alter table public.views
  alter column client_id set not null;

drop policy if exists "public insert views" on public.views;
create policy "public insert views" on public.views
  for insert with check (
    client_id is not null
    and not exists (
      select 1 from public.views existing
      where existing.video_id = views.video_id
        and existing.client_id = views.client_id
        and existing.created_at > now() - interval '1 day'
    )
  );
