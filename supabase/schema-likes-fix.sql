-- StreamHub — likes uniqueness fix.
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query → Run).
--
-- Context: unlike `favorites`, the `likes` table (see schema.sql) has NO
-- `client_id` column today — it's just (id, video_id, kind, created_at).
-- To prevent double-fire likes/dislikes from the same browser we need the
-- same anti-abuse column `favorites` already uses (populated client-side via
-- shClientId() in streamhub-api.js), then a unique constraint on top of it.

-- 1. Add the client_id column (nullable at first so existing rows aren't
--    rejected; existing historical like/dislike rows have no client_id and
--    are left as NULL — NULL is never treated as a duplicate for unique
--    constraints in Postgres, so old rows are unaffected).
alter table public.likes
  add column if not exists client_id text;

create index if not exists likes_client_idx on public.likes (client_id);

-- 2. One (video_id, client_id, kind) combo per browser — matches the
--    favorites.unique(video_id, client_id) style, extended with `kind` since
--    a single browser may legitimately like AND dislike... no — a browser
--    should only be able to register one reaction per kind per video.
alter table public.likes
  add constraint likes_video_client_kind_unique
  unique (video_id, client_id, kind);
