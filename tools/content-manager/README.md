# Content Manager (Internal Writer Tool)

Private tool for the writing team: **Title + Video URL → Generate SEO article → Preview → Publish** into the real thebestpornai blog pipeline.

## Two ways to run this

| | Path | Filesystem | Who it's for |
|---|------|-----------|---------------|
| **Production (remote writer)** | `www.thebestpornai.com/internal/writer` — Vercel serverless functions under `api/internal-writer/*.js` | None (Vercel functions have no persistent disk) — **publish always commits via the GitHub Contents API** | A remote writer with just a browser, no terminal/git |
| **Local (owner machine)** | `npm run writer` → `http://127.0.0.1:3847` — standalone Node server (`server.mjs`) | Writes files directly, runs `gen-blog-posts.js` as a child process | You, testing/debugging on your own laptop |

Both call the same underlying logic in `tools/content-manager/lib/` (generate, validate, slugify, GitHub commit) — they're two different front doors onto the same pipeline, not two separate implementations.

## What "Publish" does

1. Builds a structured post object (id, slug, title, category, excerpt, body, faqs, etc. — same shape as hand-written posts in `src/blog/posts.js`)
2. **Production path**: commits it into `src/blog/writer-posts.json` via the GitHub Contents API → pushes to `main` → Vercel's normal build pipeline runs `scripts/gen-blog-posts.js` + `scripts/gen-sitemap.js` as part of `npm run build`, which writes `blog/{slug}.html`, regenerates the blog hub, RSS, and sitemap.
3. **Local path**: writes `src/blog/writer-posts.json` directly, then runs those same two scripts itself as child processes — no GitHub commit unless you also set `GITHUB_TOKEN`.

Published articles use the exact same generator/template as hand-written posts (real JSON-LD, real `og:image` from the catalog, real category filter pills) — they are not a second, parallel template that could get wiped on the next build.

`src/blog/posts.js` merges `WRITER_POSTS` (from `writer-posts.json`, imported via `writer-posts.js`) with hand-authored `SEED_POSTS`, sorted newest-first. The blog hub's featured hero always prefers a non-`Guides` post, so a dry SEO/comparison article never displaces the site's narrative content in that slot.

## Production setup (Vercel — do this once)

In the Vercel project's **Environment Variables** (not `.env` — this runs as part of the main site's deployment):

```
WRITER_PASSWORD=long-random-password        # required — without it, auth is open
WRITER_LLM_API_KEY=sk-...                   # or OPENAI_API_KEY / XAI_API_KEY
# WRITER_LLM_BASE_URL=https://api.openai.com/v1     (default)
# WRITER_LLM_MODEL=gpt-4o-mini                       (default)
# For xAI: WRITER_LLM_BASE_URL=https://api.x.ai/v1  WRITER_LLM_MODEL=grok-...

GITHUB_TOKEN=ghp_...                        # required for publish — needs contents:write on this repo
GITHUB_REPO=LiyamFlx/thebestpornai.com      # required for publish
# WRITER_GITHUB_BRANCH=main                          (default)
WRITER_COOKIE_SECURE=1                      # or rely on VERCEL=1 being auto-set
```

**`GITHUB_TOKEN` + `GITHUB_REPO` are not optional in production** — Vercel serverless functions have no writable/persistent filesystem, so `/api/internal-writer/publish` has no other way to save anything. Without them, Publish returns a clear error instead of silently doing nothing.

Redeploy after adding the env vars (or they won't be picked up).

### Employee checklist

1. Open `https://www.thebestpornai.com/internal/writer`
2. Enter the password (share via 1Password, not Slack/email)
3. Paste title + a thebestpornai video link (`https://www.thebestpornai.com/#video/4301`)
4. Pick a category, optionally add notes (tone/angle/keywords)
5. **Generate Article** → review/edit the live preview → **Publish to Blog**
6. Wait ~1–2 minutes (Vercel rebuild time), then open the live URL from the success screen

No Node, git, or terminal required on the writer's machine.

## Local dev (owner machine)

```bash
# In repo root .env (never commit):
WRITER_PASSWORD=long-random-password
WRITER_LLM_API_KEY=sk-...
# WRITER_MOCK_LLM=1   # skip real LLM calls entirely — returns a fixed mock article, useful for testing the pipeline without burning API credits

npm run writer
# → http://127.0.0.1:3847
```

Local mode writes files directly and runs the generator scripts itself — no GitHub token needed unless you also want it to auto-commit (`WRITER_GITHUB_PUBLISH=1` + `GITHUB_TOKEN`). After a local publish:

```bash
git add src/blog/writer-posts.json blog/ public/blog/rss.xml public/sitemap.xml
git commit -m "content(writer): your-slug"
git push origin main
```

## Security

| Item | Value |
|------|--------|
| Password | `WRITER_PASSWORD` — HMAC-signed session token in an `HttpOnly`, `SameSite=Strict` cookie (12h TTL). Empty password = open access, dev-only. |
| Path | `/internal/writer` — `noindex`/`nofollow` (meta tag + `X-Robots-Tag` header), excluded in `robots.txt`, never linked from the public site |
| API namespace | `/api/internal-writer/*` — kept separate from the site's real public `/api/*` endpoints |
| Secrets | LLM + GitHub tokens are server-side only (Vercel function env), never sent to the browser |
| Rate limits | Generate/publish/resolve-video capped per IP. On the Vercel serverless path this resets per cold start — acceptable for a private, password-gated single-writer tool, not a substitute for the password itself |
| Recommended hardening | Put Cloudflare Access (email allowlist) in front of `/internal/writer` for real defense in depth beyond one shared password |

## Design

Writer UI: black / `#111` surfaces / Ferrari red `#FF2800`.
Public articles keep the site's own theme (`#E50914`) via the existing blog generator — the writer tool's branding never leaks into published pages.

## Files

```
tools/content-manager/
  server.mjs                # local standalone server (npm run writer)
  public/                   # local UI source (copied into public/internal/writer/ for prod)
  lib/                      # generate, publish, video parse, github, slug, posts-io — shared by both paths
  README.md

api/internal-writer/        # PRODUCTION — Vercel serverless functions
  _shared.js                 # auth/rate-limit helpers for the (req,res) handler shape
  health.js login.js logout.js session.js
  resolve-video.js generate.js publish.js

public/internal/writer/     # PRODUCTION — static UI, served as-is by Vercel
  index.html styles.css app.js

src/blog/writer-posts.json  # tool output (the actual mutable data)
src/blog/writer-posts.js    # stable ESM import shim around the .json (JSON is easier to PATCH via GitHub's API than regenerating JS source)
src/blog/posts.js           # merges WRITER_POSTS + SEED_POSTS
```

`public/internal/writer/*` is a copy of `tools/content-manager/public/*`, kept in sync manually — if you edit the UI, update both (or symlink) so local dev and production don't drift.

## Troubleshooting

- **Missing WRITER_LLM_API_KEY** — set the key (Vercel env var for prod, `.env` for local)
- **Video not found** — the id must exist in `src/shared/catalog-videos.js`
- **"Publish is not configured on this deployment"** — set `GITHUB_TOKEN` (with `contents:write`) and `GITHUB_REPO` in Vercel's project env vars, then redeploy
- **Publish succeeded (local mode) but not live** — you still need `git push origin main` unless `WRITER_GITHUB_PUBLISH=1` was also set
- **401 Unauthorized on every request** — session cookie expired (12h) or `WRITER_PASSWORD` changed after login; log in again
