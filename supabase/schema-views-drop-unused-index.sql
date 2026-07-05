-- StreamHub — drop unused views_client_idx.
-- Paste into the Supabase SQL editor (Project → SQL Editor → New query → Run).
--
-- Context: client_id was added to `views` (schema-views-dedupe.sql) only to
-- support the per-(video_id, client_id) dedup check inside the insert RLS
-- policy, which is a correlated subquery already scoped by video_id first
-- (via views_video_idx) — it never does a standalone client_id lookup. The
-- app's only read path (viewCount()) filters solely on video_id. So this
-- index just adds write overhead on every insert with no read ever using it
-- (confirmed unused by the Supabase linter/advisor).

drop index if exists public.views_client_idx;
