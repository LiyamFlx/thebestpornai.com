# StreamHub — Hybrid Video Platform

Three independent web apps sharing one catalog and one design system: a social
video platform (viewer / creator studio / platform manager). Live at
**https://www.thebestpornai.com**.

| App | Entry | Role |
|-----|-------|------|
| **Viewer** | `index.html` (root) | Browse, watch, favorite, comment, playlists |
| **Creator Studio** | `creator/index.html` | Upload wizard, analytics, revenue, subscribers |
| **Platform Manager** | `manager/index.html` | Users, moderation, recommendations, homepage builder, infra |

`choose.html` is the persona picker (linked from the viewer sidebar as
"Creator / Manager").

## ⚙️ How the live site is served

The site is served directly from **Vercel** with media assets hosted on **Cloudflare R2**:

```
thebestpornai.com ──► Vercel (hosting HTML/JS pages and Serverless APIs)
media requests    ──► Cloudflare R2 Bucket (streamhub-media)
```

Full detail (credentials, sync script, gotchas) lives in [`CLAUDE.md`](CLAUDE.md) — read that before working on deployment or the catalog.

## Architecture

Real source lives under `src/`, built by **Vite**.

```
src/
  shared/catalog.js     Single source of truth: MEDIA_BASE, mediaUrl(), DATA
                         (videos, creators, categories, comments, moderation, user)
  shared/ui.js           Shared render helpers (videoCard, playerEmbed, barChart, ...)
  viewer/  creator/  manager/    Per-app main.js + style.css, each imports catalog.js
scripts/
  upload-catalog-to-r2.js Uploads local files under media/ to Cloudflare R2 bucket.
  find-local-media.js    Scans local directories, compares against catalog, and reports missing files.
```

Each app's `main.js` imports `src/shared/catalog.js` as an ES module — **edit the catalog in exactly one place**, no per-app copies to keep in sync.

## Local dev

```bash
npm install
npm run dev        # Vite dev server with hot reload
```

`MEDIA_BASE` always points at the Cloudflare R2 public URL, so playback works locally without any local video files present.

## Adding videos to the catalog

**Read [`CLAUDE.md`](CLAUDE.md) → "Adding videos"** for the full, current procedure.

Short version:
1. Move the `.mp4` file(s) into one of the `media/` subfolders.
2. Add one entry per video to `DATA.videos` in `src/shared/catalog.js`.
3. Run the media sync script to upload them to R2:
   ```bash
   npm run sync-media
   ```
4. Push to GitHub to trigger Vercel build/deploy, or trigger it manually via Vercel CLI.

## Videos are not committed to git

`.gitignore` / `.vercelignore` exclude `media/**/*.mp4` — see [`media/README.md`](media/README.md). Videos live on Cloudflare R2, never in the repo.
