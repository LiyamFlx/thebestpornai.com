# StreamHub Platform — CLAUDE.md

Self-contained social video platform (viewer / creator / manager). Live at
**https://www.thebestpornai.com**. Adult content site.

## ⚠️ How the live site is ACTUALLY served (read this first)

The domain is **NOT served from Vercel**, despite the GitHub→Vercel auto-deploy.

```
thebestpornai.com  ──►  Bunny Pull Zone (id 6077029)  ──►  Bunny Storage Zone (streamhub-media)
```

- The **HTML pages live IN Bunny storage**, not Vercel. Visitors get whatever HTML
  is in the storage zone.
- **Vercel deploys are irrelevant to the live domain.** `git push` updates GitHub +
  Vercel (`x-git-master-flxx.vercel.app`) but does nothing to thebestpornai.com.
- **To deploy: upload the HTML files to Bunny storage, then purge the Pull Zone cache.**

## Deploy checklist (to update the live site)

1. Edit the catalog in `catalog.js` (see "Adding videos" below).
2. Upload to Bunny storage (overwrites live) whatever you changed:
   - `catalog.js`  ← the catalog (one file; covers all pages)
   - `viewer/viewer-app.html` / `manager/platform-manager.html` /
     `creator/creator-studio.html` / `index.html`  ← only if you changed their
     markup/logic (NOT needed for a catalog-only change)
3. **Purge the Pull Zone cache** (30-day TTL — site won't update otherwise):
   Bunny dashboard → CDN → Pull Zone `streamhub-media` → Purge Cache → empty tag → Purge.
4. (Optional) `git commit && git push` to keep GitHub/Vercel in sync.

## Bunny credentials & API

- **Storage Zone:** `streamhub-media`  (id 6077029, region DE)
- **Storage API base:** `https://storage.bunnycdn.com/streamhub-media`
- **CDN (read) base:** `https://streamhub-media.b-cdn.net`  ← this is `MEDIA_BASE`
- **Storage password** (read/write) lives in the Bunny dashboard → Storage → FTP & API
  Access. Do NOT hardcode it in the repo.

List files:
```bash
curl -s -H "AccessKey: $BUNNY_STORAGE_KEY" -H "Accept: application/json" \
  "https://storage.bunnycdn.com/streamhub-media/"
```
Upload/overwrite a file:
```bash
curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" \
  --data-binary "@viewer/viewer-app.html" \
  "https://storage.bunnycdn.com/streamhub-media/viewer/viewer-app.html"
```
Purging the Pull Zone cache via API needs the **account API key** (not the storage
password). Easiest is the dashboard purge button.

## Adding videos (the catalog)

Videos are streamed from Bunny CDN. `mediaUrl(src)` takes a `src` like
`../media/<filename>.mp4`, strips the path, and builds
`https://streamhub-media.b-cdn.net/<urlencoded filename>`.

**The filename in the catalog MUST exactly match the filename in Bunny storage**
(spaces and all), or the video 404s. Always verify against the real storage listing
before committing — do not assume sequential numbering (e.g. comshot files skip
00016/00018/00021).

Steps to add videos:
1. Upload the `.mp4` files to the Bunny storage zone (dashboard or PUT API).
2. Get the EXACT filenames from the storage listing (API call above).
3. Add an entry per video to the `videos: [...]` array **in `catalog.js`** (the
   single source of truth — see below). Entry shape:
   ```js
   { id:<n>, title:"...", creator:"c1", type:"ugc", category:"Cumshot",
     categories:["Cumshot"], views:0, likes:0, dislikes:0, comments:0, favorites:0,
     duration:"0:10", uploaded:"2026-06-29", src:"../media/<exact filename>.mp4",
     tags:["Cumshot","Blowjob"], status:"published", flagged:false }
   ```
4. Verify each CDN URL returns 200:
   `curl -sI "https://streamhub-media.b-cdn.net/<urlencoded filename>"`
5. Deploy: upload `catalog.js` to Bunny storage and purge the cache (see checklist).

### ✅ The catalog lives in ONE place: `catalog.js`

`catalog.js` (at the repo root) defines the globals `MEDIA_BASE`, `mediaUrl()`, and
`DATA` (videos/creators/categories/comments/moderation/user). Every app page loads it
at runtime via `<script src="../catalog.js"></script>` **before** its own inline
script, so all three pages share one catalog. **Edit `catalog.js` only** — no more
4-file sync.

- Pages: `viewer/viewer-app.html`, `creator/creator-studio.html`,
  `manager/platform-manager.html` (each loads `../catalog.js` → resolves to
  `/catalog.js` at the CDN root). `index.html` is a static picker, no catalog.
- **Deploy:** when you change the catalog, upload **`catalog.js`** to Bunny storage
  (`https://storage.bunnycdn.com/streamhub-media/catalog.js`) and purge the Pull Zone
  cache — same as the HTML files. The pages themselves only need re-uploading if you
  changed their markup/logic, not the catalog.
- Per-page **helper functions** (`videoCard`, `fmt`, `playerEmbed`, …) are still
  inlined per page and have drifted (e.g. the viewer's `videoCard` is lazy-loaded).
  They are NOT shared — only the catalog is. Unifying helpers is a separate task.
- Abandoned build pipeline (`build.js`, `*.src.html`) and the old `_data.js` live in
  `_archive/` (see `_archive/README.md`) — do not revive them.

## Local dev

- Open `index.html` (persona picker) or run `Start.command` / `Start.bat` (Python
  http.server) so video plays over http, not file://.
- Locally, `MEDIA_BASE` still points at the CDN, so playback works without local files.

## Repo hygiene

- **Do not commit raw `.mp4` files.** They belong on Bunny, not in git. `.gitignore`
  excludes `media/**/*.mp4` (and `.vercelignore` excludes `media/*.mp4`). The only
  tracked videos are the royalty-free `media/sample-*.mp4`.
- Default branch is `master`. Pushing to it triggers Vercel (but not the live domain).

## Subfolders on Bunny

`mediaUrl()` now preserves the full path after `media/` (encoding each segment),
so videos inside a Bunny subfolder work: `src:"../media/<folder>/<file>.mp4"` →
`b-cdn.net/<folder>/<file>.mp4`. (Earlier it did `split('/').pop()` and dropped
the folder, 404ing every subfolder video — red thumbnails.) When importing from a
subfolder, the catalog `src` MUST include the folder.

## Gotchas that have bitten us

- "I uploaded but don't see them live" → the **30-day Pull Zone cache**. Purge it.
- "Purged but still old" → the HTML in **Bunny storage** is old; re-upload the 4 files.
- "Video 404s" → filename mismatch between catalog `src` and Bunny storage.
- Don't trust sequential numbering — list the storage zone and match exactly.
