-- StreamHub — 3a: real view tracking. Paste into Supabase SQL Editor and Run.
-- One row per view event; we count rows (same concurrency-safe pattern as likes).

create table if not exists public.views (
  id          bigint generated always as identity primary key,
  video_id    integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists views_video_idx on public.views (video_id);

alter table public.views enable row level security;
create policy "public read views"   on public.views for select using (true);
create policy "public insert views"  on public.views for insert with check (true);
