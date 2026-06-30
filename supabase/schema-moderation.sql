-- StreamHub — 3d: real moderation decisions. Paste into Supabase SQL Editor and Run.
-- Records moderator actions on videos (approve / remove / escalate / flag).
-- The viewer/manager read the latest decision per video to reflect real status.

create table if not exists public.moderation (
  id          bigint generated always as identity primary key,
  video_id    text    not null,          -- catalog id (number) or upload src; text covers both
  action      text    not null check (action in ('approve','remove','escalate','flag','unflag')),
  reason      text,
  moderator   text,                       -- email if available
  created_at  timestamptz not null default now()
);
create index if not exists moderation_video_idx on public.moderation (video_id, created_at desc);

alter table public.moderation enable row level security;
create policy "public read moderation"   on public.moderation for select using (true);
create policy "public insert moderation"  on public.moderation for insert with check (true);
