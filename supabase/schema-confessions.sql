-- Anonymous confessions table for thebestpornai blog
-- Stores user-submitted anonymous confessions from blog posts.
-- Minimal schema: no PII stored, default status 'pending'.

CREATE TABLE IF NOT EXISTS public.confessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT NOT NULL CHECK (length(body) >= 5 AND length(body) <= 2000),
  post_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by /api/confession.js and backend moderation)
-- No public / anon SELECT access to maintain confidentiality.
