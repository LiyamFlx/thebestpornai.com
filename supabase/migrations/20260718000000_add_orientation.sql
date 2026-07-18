-- supabase/migrations/20260718000000_add_orientation.sql
-- Add orientation column to uploads table with a check constraint and default value.

alter table public.uploads
add column if not exists orientation text default 'horizontal' check (orientation in ('horizontal', 'vertical'));
