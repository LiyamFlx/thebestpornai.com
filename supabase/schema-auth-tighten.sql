-- StreamHub — tighten RLS: moderation decisions and creator uploads must come
-- from a signed-in Supabase user, not an anonymous publishable-key request.
-- Paste into Supabase SQL Editor and Run. Safe to run after schema-moderation.sql
-- and schema-uploads.sql (drops + replaces their public-insert policies).

-- ---------- MODERATION ----------
-- Previously: any anonymous request could insert a moderation decision
-- (forge an "approve"/"remove" action). Now requires an authenticated session.
drop policy if exists "public insert moderation" on public.moderation;
create policy "authenticated insert moderation" on public.moderation
  for insert
  to authenticated
  with check (true);

-- ---------- UPLOADS ----------
-- Previously: any anonymous request could insert upload metadata (inject
-- fake catalog entries without ever uploading a file). Now requires auth.
drop policy if exists "public insert uploads" on public.uploads;
create policy "authenticated insert uploads" on public.uploads
  for insert
  to authenticated
  with check (true);
