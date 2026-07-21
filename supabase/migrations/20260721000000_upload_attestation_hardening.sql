-- supabase/migrations/20260721000000_upload_attestation_hardening.sql
-- Phase 1 of compliance-pipeline hardening: allow anonymous (client_id-keyed)
-- uploaders to attest + be hash-checked + trust-tier-gated, since the live
-- upload path (api/presign.js, api/save-upload.js) is explicitly "no sign-in
-- required (open uploads)" and doesn't have an auth.users row to hang these
-- tables off of. Additive only — no drops, no data loss. Existing
-- authenticated-user rows (17 real upload_attestations, 10 real
-- creator_trust rows) are untouched; user_id stays valid for signed-in flows.

alter table public.upload_attestations
  alter column user_id drop not null,
  add column if not exists client_id text,
  add column if not exists attested_statements jsonb,
  add column if not exists ip_hash text,
  add constraint upload_attestations_owner_chk
    check (user_id is not null or client_id is not null);

-- creator_trust.user_id was the primary key (implying NOT NULL); a
-- client_id-keyed anonymous row needs its own identity column, since
-- client_id isn't the same kind of unique identity user_id was. Add a
-- surrogate id PK first, then drop the old PK constraint before relaxing
-- user_id's NOT NULL (a PK column can't be nullable while it's still the PK).
alter table public.creator_trust
  add column if not exists id uuid not null default gen_random_uuid();
alter table public.creator_trust drop constraint if exists creator_trust_pkey;
alter table public.creator_trust add primary key (id);
alter table public.creator_trust
  alter column user_id drop not null,
  add column if not exists client_id text,
  add constraint creator_trust_owner_chk
    check (user_id is not null or client_id is not null);
create unique index if not exists creator_trust_user_id_idx
  on public.creator_trust (user_id) where user_id is not null;
create unique index if not exists creator_trust_client_id_idx
  on public.creator_trust (client_id) where client_id is not null;

alter table public.uploads
  alter column user_id drop not null,
  add column if not exists client_id text,
  add constraint uploads_owner_chk
    check (user_id is not null or client_id is not null),
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists reviewed_by text;   -- moderator email/id who cleared a 'held' item

-- 'held' already exists in the status check constraint (processing/live/held/rejected)
-- from schema-global-upload.sql — reused as-is for the fail-closed CSAM state
-- and for CSAM matches themselves (both land here; the manager UI distinguishes
-- them via a separate reason, not a separate status, see reviewed_by/reject_reason).

create index if not exists uploads_client_idx on public.uploads (client_id);
create index if not exists upload_attestations_client_idx on public.upload_attestations (client_id);
create index if not exists creator_trust_client_idx_lookup on public.creator_trust (client_id);

-- RLS: extend existing policies to cover client_id-keyed anonymous rows.
-- Anonymous uploaders get NO direct table read at all (their only proof of
-- attestation is the signed token api/attest.js returns) — this is stricter
-- than the authenticated-owner-read policy already in place, by design.
drop policy if exists uploads_owner_read on public.uploads;
create policy uploads_owner_read on public.uploads
  for select to authenticated using (auth.uid() = user_id);
-- (uploads_public_live, attest_select_own, attest_insert_own unchanged —
-- anon role still has zero policies on upload_attestations/creator_trust/
-- banned_hashes, i.e. service-role only, which is what Phase 1's api/*.js
-- functions use via SUPABASE_SERVICE_ROLE_KEY.)
