# Content Manager (Internal Writer Tool)

Private tool for the writing team: **Title + Video URL → Generate SEO article → Preview → Publish** into the real thebestpornai blog pipeline.

## What “Publish” does

1. Appends a structured post to `src/blog/writer-posts.js`
2. Runs `scripts/gen-blog-posts.js` + `scripts/gen-sitemap.js`
3. Writes `blog/{slug}.html`, updates hub + RSS
4. Optionally commits `writer-posts.js` to GitHub if tokens are set

**Live site still needs a git push** (or GitHub auto-commit + Vercel).  
Published articles use the same generator as hand-written posts — they survive `npm run build`.

## Quick start (owner machine)

```bash
# In repo root .env (never commit):
WRITER_PASSWORD=long-random-password
WRITER_LLM_API_KEY=sk-...
# Optional OpenAI-compatible:
# WRITER_LLM_BASE_URL=https://api.openai.com/v1
# WRITER_LLM_MODEL=gpt-4o-mini
# For xAI: WRITER_LLM_BASE_URL=https://api.x.ai/v1  WRITER_LLM_MODEL=grok-...

# Optional remote auto-commit (US writer → main without SSH):
# GITHUB_TOKEN=ghp_...with contents:write
# GITHUB_REPO=LiyamFlx/thebestpornai.com
# WRITER_GITHUB_PUBLISH=1

npm run writer
# → http://127.0.0.1:3847
```

Open the URL, log in, paste:

- Title: e.g. `Best AI MILF scenes to stream`
- Video: `https://www.thebestpornai.com/#video/4301`
- Category + optional notes
- **Generate** → edit → **Publish to Blog**

Then:

```bash
git add src/blog/writer-posts.js blog/ public/blog/rss.xml public/sitemap.xml
git commit -m "content(writer): your-slug"
git push origin main
```

## Remote US writer (hosted)

The same app can be deployed on Railway / Fly / Render / a VPS:

1. Deploy `node tools/content-manager/server.mjs` with env vars above
2. Set `WRITER_HOST=0.0.0.0` and `WRITER_PORT=...`
3. Set `WRITER_COOKIE_SECURE=1` behind HTTPS
4. Put Cloudflare Access or Basic Auth in front of the URL (recommended)
5. Enable `WRITER_GITHUB_PUBLISH=1` + `GITHUB_TOKEN` so Publish commits without local git
6. Vercel rebuilds production from that commit (includes `gen-blog-posts` in `npm run build`)

**Do not** link this tool from the public site. Meta robots is `noindex`.

### Employee checklist

1. Open the private writer URL you shared  
2. Enter password (from 1Password)  
3. Paste title + video link from thebestpornai  
4. Generate → light edit → Publish  
5. Wait ~1–2 minutes after deploy, open the live blog URL from the success screen  

No Node/git required on the writer’s laptop when GitHub publish is enabled.

## Security

| Item | Value |
|------|--------|
| Password | `WRITER_PASSWORD` (required in production) |
| Bind | Default `127.0.0.1` (local). Hosted: `0.0.0.0` + HTTPS only |
| Secrets | LLM + GitHub tokens server-side only |
| Rate limits | Generate/publish capped per IP |

## Design

Writer UI: black / `#111` surfaces / Ferrari red `#FF2800`.  
Public articles keep site theme (`#E50914`) via existing blog generator.

## Files

```
tools/content-manager/
  server.mjs
  public/          # UI
  lib/             # generate, publish, video parse, github
  README.md
src/blog/writer-posts.js   # tool output
src/blog/posts.js          # merges WRITER_POSTS + SEED_POSTS
```

## Troubleshooting

- **Missing WRITER_LLM_API_KEY** — set key in `.env`  
- **Video not found** — id must exist in `catalog-videos.js`  
- **Publish succeeded but not live** — push to `main` / check Vercel  
- **GitHub skipped** — set `GITHUB_TOKEN` + `GITHUB_REPO` + `WRITER_GITHUB_PUBLISH=1`
