-- Allow this browser to remove its own like/dislike row (toggle off / switch).
-- Matches favorites: RLS cannot cryptographically bind client_id, so DELETE
-- is `using (true)` and the app always filters `client_id=eq.<sh_client_id>`.
-- Paste into the Supabase SQL editor and run once.

drop policy if exists "client delete own like" on public.likes;
create policy "client delete own like" on public.likes
  for delete using (true);
