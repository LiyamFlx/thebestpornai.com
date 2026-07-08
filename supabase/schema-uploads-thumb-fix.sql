-- StreamHub — add thumb column to uploads table.
-- Paste into Supabase SQL Editor and Run.

alter table public.uploads
  add column if not exists thumb text;
