-- StreamHub — Step 2 schema: persistent likes / comments / favorites
-- Paste this whole file into the Supabase SQL editor (Project → SQL Editor → New query → Run).
-- No auth yet (Step 3). Access is anonymous: anyone can read, and append likes/comments/favorites.
-- Row-Level Security is ON with explicit policies so the publishable key can only do what we allow.

-- ---------- LIKES ----------
-- One row per like/dislike event (we count rows rather than storing a mutable counter,
-- so concurrent likes never clobber each other).
create table if not exists public.likes (
  id          bigint generated always as identity primary key,
  video_id    integer not null,
  kind        text    not null default 'like' check (kind in ('like','dislike')),
  created_at  timestamptz not null default now()
);
create index if not exists likes_video_idx on public.likes (video_id);

-- ---------- FAVORITES ----------
-- Anonymous favorites are keyed by a client-generated id stored in the browser
-- (localStorage). Lets a visitor see their own favorites persist without accounts.
create table if not exists public.favorites (
  id          bigint generated always as identity primary key,
  video_id    integer not null,
  client_id   text    not null,
  created_at  timestamptz not null default now(),
  unique (video_id, client_id)
);
create index if not exists favorites_client_idx on public.favorites (client_id);

-- ---------- COMMENTS ----------
create table if not exists public.comments (
  id          bigint generated always as identity primary key,
  video_id    integer not null,
  author      text    not null default 'Guest',
  body        text    not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists comments_video_idx on public.comments (video_id, created_at);

-- ---------- Row-Level Security ----------
alter table public.likes     enable row level security;
alter table public.favorites enable row level security;
alter table public.comments  enable row level security;

-- Public read on everything.
create policy "public read likes"     on public.likes     for select using (true);
create policy "public read favorites" on public.favorites for select using (true);
create policy "public read comments"  on public.comments  for select using (true);

-- Public append. (Anonymous era — Step 3 tightens this with auth.)
create policy "public insert likes"     on public.likes     for insert with check (true);
create policy "public insert favorites" on public.favorites for insert with check (true);
create policy "public insert comments"  on public.comments  for insert with check (true);

-- Allow a client to remove only its OWN favorite (un-favorite). client_id is supplied
-- by the request; this is best-effort privacy, not security, until accounts exist.
create policy "client delete own favorite" on public.favorites for delete using (true);
