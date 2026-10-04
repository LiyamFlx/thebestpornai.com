-- Supabase Database Migration: Support 64-bit integer IDs for videos
-- Created: 2026-10-04
--
-- Tables likes, favorites, comments, and views originally defined video_id as 32-bit `integer`.
-- Upgrading video_id to `bigint` allows timestamp-based IDs (e.g. from Date.now())
-- and high-volume identifiers without encountering Postgres 22003 "out of range for type integer" 400 errors.

ALTER TABLE IF EXISTS public.likes ALTER COLUMN video_id TYPE bigint;
ALTER TABLE IF EXISTS public.favorites ALTER COLUMN video_id TYPE bigint;
ALTER TABLE IF EXISTS public.comments ALTER COLUMN video_id TYPE bigint;
ALTER TABLE IF EXISTS public.views ALTER COLUMN video_id TYPE bigint;
