-- supabase/schema-global-upload.sql
-- Site-wide upload system. Run in Supabase SQL editor or via `supabase db push`.
-- Owner decision: NO moderation gate. status goes straight to 'live' on finalize.
-- 'held'/'rejected' exist so a review queue can be enabled later without migration.

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  bunny_path text unique not null,
  title text not null default '',
  tags text[] not null default '{}',
  status text not null default 'processing'
    check (status in ('processing','live','held','rejected')),
  reject_reason text,
  sha256_head text,
  duration_s int,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists uploads_live_idx on uploads (status) where status = 'live';
create index if not exists uploads_owner_idx on uploads (user_id);

create table if not exists creator_trust (
  user_id uuid primary key references auth.users(id),
  tier int not null default 0,
  strikes int not null default 0,
  clean_publishes int not null default 0,
  id_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists upload_attestations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  upload_ids uuid[] not null default '{}',
  attested_at timestamptz not null default now()
);

create table if not exists banned_hashes (
  sha256_head text primary key,
  reason text,
  added_at timestamptz not null default now()
);

-- RLS: deny by default
alter table uploads enable row level security;
alter table creator_trust enable row level security;
alter table upload_attestations enable row level security;
alter table banned_hashes enable row level security;

-- uploads: public reads only live rows; owner reads own rows (any status).
drop policy if exists uploads_public_live on uploads;
create policy uploads_public_live on uploads
  for select to anon, authenticated using (status = 'live');
drop policy if exists uploads_owner_read on uploads;
create policy uploads_owner_read on uploads
  for select to authenticated using (auth.uid() = user_id);
-- INSERT: service role only (edge fn). No client insert policy = denied for anon/authenticated.
-- UPDATE: owner may edit title/tags while not yet live; status transitions are service-role only.
drop policy if exists uploads_owner_update on uploads;
create policy uploads_owner_update on uploads
  for update to authenticated
  using (auth.uid() = user_id and status <> 'live')
  with check (auth.uid() = user_id and status <> 'live');

-- creator_trust, banned_hashes: no client policies at all => service-role only.

-- upload_attestations: insert + select own.
drop policy if exists attest_insert_own on upload_attestations;
create policy attest_insert_own on upload_attestations
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists attest_select_own on upload_attestations;
create policy attest_select_own on upload_attestations
  for select to authenticated using (auth.uid() = user_id);
