-- StreamHub — moderators table: fixes privilege-escalation gap where any
-- signed-in user (not just real moderators) could approve/remove catalog
-- entries via api/moderate-manifest.js and insert rows into public.moderation.
--
-- No client insert/update/delete — only the service role (used by
-- api/moderate-manifest.js via its Supabase service key, or manual SQL
-- editor access) may grant/revoke moderator status. Clients may only read
-- their own row, to let the UI check "am I a moderator?".

create table if not exists public.moderators (
  user_id     uuid primary key references auth.users(id),
  role        text not null default 'moderator',
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id)
);

alter table public.moderators enable row level security;

-- No insert/update/delete policies for anon/authenticated => those actions
-- are denied for all client roles; only the service role (which bypasses
-- RLS entirely) can write.
drop policy if exists "read own moderator row" on public.moderators;
create policy "read own moderator row" on public.moderators
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------- Tighten moderation-affecting tables to require real moderators ----------

-- public.moderation (schema-moderation.sql): previously any authenticated
-- user could insert a moderation decision (schema-auth-tighten.sql only
-- checked `authenticated`). Now requires a moderators row.
drop policy if exists "authenticated insert moderation" on public.moderation;
create policy "moderator insert moderation" on public.moderation
  for insert
  to authenticated
  with check (exists (
    select 1 from public.moderators m where m.user_id = auth.uid()
  ));

-- ---------- Manual step: seed the first moderator(s) ----------
-- No moderator account is recorded anywhere in this repo. Before deploying,
-- run the following in the Supabase SQL editor (service role) for each real
-- moderator, using their auth.users.id:
--
--   insert into public.moderators (user_id, granted_by)
--   values ('<uuid-of-real-moderator>', '<uuid-of-real-moderator>');
--
-- Until this is run, api/moderate-manifest.js will return 403 for everyone.
