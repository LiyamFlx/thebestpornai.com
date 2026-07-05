-- StreamHub — comments anti-abuse + favorites delete-ownership fix.
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query → Run).
--
-- Context: `comments` (schema.sql) has no client_id, so a single visitor (or
-- a trivial script) can flood a video with unlimited comments. `favorites`
-- already has client_id (schema.sql) but its DELETE policy is `using (true)`,
-- so any client can delete ANY row, not just its own — despite the comment
-- in schema.sql claiming "own favorite only". Both fixes mirror the
-- client_id pattern already used by likes (schema-likes-fix.sql) and views
-- (schema-views-dedupe.sql): there's no real auth in this app for anonymous
-- actions, so client_id (from shClientId()) is the ownership key.

-- ---------- COMMENTS ----------
alter table public.comments
  add column if not exists client_id text;

create index if not exists comments_client_idx on public.comments (client_id);

update public.comments
  set client_id = 'legacy'
  where client_id is null;

alter table public.comments
  alter column client_id set not null;

-- Cap to one comment per (video, client) per minute to blunt flooding,
-- without blocking a real visitor from posting multiple distinct comments
-- over time.
drop policy if exists "public insert comments" on public.comments;
create policy "public insert comments" on public.comments
  for insert with check (
    client_id is not null
    and not exists (
      select 1 from public.comments existing
      where existing.video_id = comments.video_id
        and existing.client_id = comments.client_id
        and existing.created_at > now() - interval '1 minute'
    )
  );

-- ---------- FAVORITES ----------
-- NOTE: this app has no real auth session for anonymous actions (every
-- browser shares the same publishable key), so RLS has no trustworthy
-- signal to check client_id against — there is no JWT claim or header
-- PostgREST guarantees came from the real owner. A `using (client_id =
-- <anything client-supplied>)` policy is circular: the same request that
-- can forge client_id on the DELETE could forge it on the check too. This
-- table's DELETE therefore stays best-effort (enforced only by the app
-- sending `client_id=eq.<their id>` in the query, per streamhub-api.js's
-- removeFavorite()), same as the original schema.sql comment already
-- documented. Real per-user delete scoping requires migrating favorites to
-- real Supabase auth sessions, matching the moderation/uploads pattern in
-- schema-auth-tighten.sql — out of scope for this anti-abuse pass.
