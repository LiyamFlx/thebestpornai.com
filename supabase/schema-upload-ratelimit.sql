-- StreamHub — persistent rate limit for the open upload-presign endpoint.
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query → Run).
--
-- Context: api/presign.js previously rate-limited by IP using an in-memory Map,
-- which resets on every Vercel cold start / doesn't share state across
-- serverless instances — effectively no real limit on a 2GB-cap, unauthenticated
-- upload endpoint. This mirrors the schema-views-dedupe.sql pattern: log each
-- attempt as a row, and have the insert policy itself reject once an IP exceeds
-- the cap in the rolling window, so the limit is enforced by Postgres, not by
-- fragile in-process state.

create table if not exists public.upload_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists upload_attempts_ip_time_idx
  on public.upload_attempts (ip, created_at);

alter table public.upload_attempts enable row level security;

drop policy if exists "public insert upload_attempts" on public.upload_attempts;
create policy "public insert upload_attempts" on public.upload_attempts
  for insert with check (
    ip is not null
    and (
      select count(*) from public.upload_attempts existing
      where existing.ip = upload_attempts.ip
        and existing.created_at > now() - interval '1 hour'
    ) < 30
  );

-- No public select/update/delete policy — attempts are write-only from the
-- client's perspective; nothing needs to read this table except an admin.
