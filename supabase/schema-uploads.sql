-- StreamHub — 3c: uploaded videos. Paste into Supabase SQL Editor and Run.
-- Stores metadata for creator-uploaded videos so they appear for everyone.
-- The actual video file lives in Bunny Storage (media/uploads/...).

create table if not exists public.uploads (
  id          bigint generated always as identity primary key,
  title       text    not null default 'Untitled',
  creator     text    not null default 'You',
  src         text    not null,                 -- catalog-style: ../media/uploads/<file>
  category    text    default 'POV',
  categories  jsonb   default '[]'::jsonb,
  tags        jsonb   default '[]'::jsonb,
  duration    text    default '0:00',
  views_seed  integer not null default 12000,   -- realistic baseline (10k-15k)
  likes_seed  integer not null default 180,     -- realistic baseline (100-300)
  status      text    not null default 'review',-- new uploads enter moderation queue (3d)
  uploader    text,                              -- email of the signed-in uploader
  created_at  timestamptz not null default now()
);
create index if not exists uploads_created_idx on public.uploads (created_at desc);

alter table public.uploads enable row level security;
create policy "public read uploads"  on public.uploads for select using (true);
create policy "public insert uploads" on public.uploads for insert with check (true);
