# StreamHub — Hybrid Video Platform

Three independent web apps sharing one catalog and one design system: a social
video platform (viewer / creator studio / platform manager). Live at
**https://www.thebestpornai.com**.

| App | Entry | Role |
|-----|-------|------|
| **Viewer** | `viewer/index.html` (mirrored at root `index.html`) | Browse, watch, favorite, comment, playlists |
| **Creator Studio** | `creator/index.html` | Upload wizard, analytics, revenue, subscribers |
| **Platform Manager** | `manager/index.html` | Users, moderation, recommendations, homepage builder, infra |

`choose.html` is the persona picker (linked from the viewer sidebar as
"Creator / Manager").

## ⚠️ How the live site is actually served

**Not from Vercel**, despite the GitHub→Vercel auto-deploy on every push.

```
thebestpornai.com  ──►  Bunny Pull Zone  ──►  Bunny Storage Zone (streamhub-media)
```

The built HTML/JS/CSS live **in Bunny storage**. `git push` updates GitHub +
Vercel but does **nothing** to the live domain. To actually update the site you
must build and upload to Bunny — see **Deploy**, below.

Full detail (credentials, manual curl fallback, gotchas) lives in
[`CLAUDE.md`](CLAUDE.md) — read that before touching deploy or the catalog.

## Architecture

Real source lives under `src/`, built by **Vite**. There is no more inlining /
`_shared.css` / `_data.js` / `build.js` pipeline — that was an earlier,
abandoned approach and has been deleted. Don't recreate it.

```
src/
  shared/catalog.js     Single source of truth: MEDIA_BASE, mediaUrl(), DATA
                         (videos, creators, categories, comments, moderation, user)
  shared/ui.js           Shared render helpers (videoCard, playerEmbed, rowSection, ...)
  viewer/  creator/  manager/    Per-app main.js + style.css, each imports catalog.js
scripts/
  add-bunny-folder.js    Lists a Bunny subfolder and inserts catalog entries
                         for every file in it (see "Adding videos", below)
deploy.js                Uploads dist/ to Bunny storage (dry-run by default)
Start.command/.bat       Local dev launcher (see "Local dev")
```

Each app's `main.js` imports `src/shared/catalog.js` as an ES module — **edit
the catalog in exactly one place**, no per-app copies to keep in sync.

## Local dev

```bash
npm install
npm run dev        # Vite dev server with hot reload
```

Or for a quick look at pre-built output without Vite: `Start.command` (Mac) /
`Start.bat` (Windows) serve the current directory over `http://localhost:PORT`
and open `index.html` — useful for eyeballing a `dist/` build, not for editing
source (`src/**` isn't watched or rebuilt by the launcher).

`MEDIA_BASE` always points at the Bunny CDN, so playback works locally without
any video files present.

## Adding videos to the catalog

**Read [`CLAUDE.md`](CLAUDE.md) → "Adding videos"** for the full, current
procedure, including the required Bunny filename-matching step and the
Movies/Scenes/Clips naming convention for structured long-form content.

Short version:
1. Upload the `.mp4` file(s) to the Bunny storage zone.
2. Add one entry per video to `DATA.videos` in `src/shared/catalog.js` — either
   by hand, or generate them from an existing Bunny folder with:
   ```bash
   BUNNY_STORAGE_KEY=xxx npm run add-videos -- "folder name" --category "..." --tags "..." --patch
   ```
   **Always inspect the diff after `--patch` runs** — see the CLAUDE.md
   "Known incident" note on why this matters.
3. `npm run build`, then `npm run deploy:apply` (uploads to Bunny) — see
   CLAUDE.md's Deploy checklist for the cache-purge step that must follow.

## Videos are not committed to git

`.gitignore` / `.vercelignore` exclude `media/**/*.mp4` — see
[`media/README.md`](media/README.md). Videos live on Bunny, never in the repo.
