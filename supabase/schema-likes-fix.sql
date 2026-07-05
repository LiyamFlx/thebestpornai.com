-- StreamHub — likes uniqueness fix.
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query → Run).
--
-- Context: unlike `favorites`, the `likes` table (see schema.sql) has NO
-- `client_id` column today — it's just (id, video_id, kind, created_at).
-- To prevent double-fire likes/dislikes from the same browser we need the
-- same anti-abuse column `favorites` already uses (populated client-side via
-- shClientId() in streamhub-api.js), then a unique constraint on top of it.
--
-- IMPORTANT: a bare unique(video_id, client_id, kind) is not enough. Postgres
-- treats every NULL as distinct from every other value in a unique index, so
-- any insert that omits client_id (a raw PostgREST request, a buggy/hostile
-- client) sails straight through the constraint and can vote unlimited
-- times. We close that by requiring client_id on all rows (backfilling the
-- pre-existing historical rows first) and by adding an RLS check that
-- rejects null client_id on insert, mirroring the `favorites` table's style.

-- 1. Add the client_id column, nullable for now so the ALTER TABLE itself
--    doesn't fail against existing rows.
alter table public.likes
  add column if not exists client_id text;

create index if not exists likes_client_idx on public.likes (client_id);

-- 2. Backfill existing rows BEFORE adding any not-null constraint. Historical
--    like/dislike rows predate client_id and have no real browser id to
--    recover, so they get a fixed sentinel value. This MUST happen before
--    step 3 — Postgres will refuse to add a NOT NULL constraint while rows
--    still contain NULL in that column.
update public.likes
  set client_id = 'legacy'
  where client_id is null;

-- 3. Backfilling every historical row to the same 'legacy' sentinel can
--    create duplicate (video_id, client_id, kind) combos if a video had more
--    than one legacy like/dislike row — those would violate step 4's unique
--    constraint. Remove the duplicates first, keeping the earliest row.
--    (Discovered live: a project with real historical data failed on step 4
--    with a duplicate key error until this ran first.)
delete from public.likes a
using public.likes b
where a.video_id = b.video_id
  and a.client_id = b.client_id
  and a.kind = b.kind
  and a.id > b.id;

-- 4. Require client_id on all rows from now on. New inserts without a
--    client_id will be rejected at the database level (not just bypassed
--    silently), which is what actually stops the NULL-bypass in step 5's
--    unique constraint.
alter table public.likes
  alter column client_id set not null;

-- 5. One (video_id, client_id, kind) combo per browser — matches the
--    favorites.unique(video_id, client_id) style, extended with `kind`
--    because a browser should be able to register at most one reaction per
--    kind per video (i.e. one like row and one dislike row, not several of
--    either).
alter table public.likes
  add constraint likes_video_client_kind_unique
  unique (video_id, client_id, kind);

-- 6. Belt-and-suspenders at the RLS layer: even though the column is now
--    NOT NULL, make the insert policy itself reject a null/missing
--    client_id explicitly, so the intent is enforced at every layer a client
--    could hit (matches the existing "public insert likes" / "public insert
--    favorites" policy style in schema.sql, which use `for insert with
--    check (...)`).
drop policy if exists "public insert likes" on public.likes;
create policy "public insert likes" on public.likes
  for insert with check (client_id is not null);
