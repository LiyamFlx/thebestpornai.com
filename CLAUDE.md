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

1. Edit the catalog in `src/shared/catalog.js` (see "Adding videos" below).
2. Run `npm run build` — Vite outputs the built site to `dist/` with
   content-hashed filenames (no more manual `?v=N` cache-busting).
3. Upload the **entire contents of `dist/`** to Bunny storage, preserving the
   folder structure (`dist/index.html` → storage root, `dist/creator/index.html`
   → `creator/index.html`, `dist/assets/*` → `assets/`, etc.):
   ```bash
   curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --data-binary "@dist/index.html" \
     "https://storage.bunnycdn.com/streamhub-media/index.html"
   # repeat for each file under dist/, or use a small upload script that walks dist/
   ```
4. **Purge the Pull Zone cache** (30-day TTL — site won't update otherwise):
   Bunny dashboard → CDN → Pull Zone `streamhub-media` → Purge Cache → empty tag → Purge.
5. (Optional) `git commit && git push` to keep GitHub/Vercel in sync.

**Catalog-only fast path unchanged**: if you only edited `src/shared/catalog.js`
and nothing else, you can still run the build and upload just the resulting
hashed catalog chunk plus the three app HTML files that reference it (their
`<script>` tag hash changes whenever catalog content changes) — or simply
upload the full `dist/` output each time, which is simpler and safe.

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
  --data-binary "@dist/viewer/index.html" \
  "https://storage.bunnycdn.com/streamhub-media/viewer/index.html"
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
3. Add an entry per video to the `videos: [...]` array **in `src/shared/catalog.js`**
   (the single source of truth — see below). Entry shape:
   ```js
   { id:<n>, title:"...", creator:"c1", type:"ugc", category:"Cumshot",
     categories:["Cumshot"], views:0, likes:0, dislikes:0, comments:0, favorites:0,
     duration:"0:10", uploaded:"2026-06-29", src:"../media/<exact filename>.mp4",
     tags:["Cumshot","Blowjob"], status:"published", flagged:false }
   ```
4. Verify each CDN URL returns 200:
   `curl -sI "https://streamhub-media.b-cdn.net/<urlencoded filename>"`
5. Deploy: run `npm run build` and upload the resulting `dist/` output to Bunny
   storage, then purge the cache (see checklist).

### ✅ The catalog lives in ONE place: `src/shared/catalog.js`

`src/shared/catalog.js` defines the globals `MEDIA_BASE`, `mediaUrl()`, and
`DATA` (videos/creators/categories/comments/moderation/user). Every app (viewer,
creator, manager) imports it as an ES module via its Vite-bundled `main.js`, so all
three apps share one catalog. **Edit `src/shared/catalog.js` only** — no more
4-file sync.

- Pages: `viewer/index.html` (also mirrored at root `index.html`, so
  thebestpornai.com loads straight into the video homepage), `creator/index.html`,
  `manager/index.html` each load their bundled JS (built by Vite from `src/`),
  which imports the shared catalog module. The old persona picker now lives at
  `choose.html` (linked from the viewer sidebar as "Creator / Manager").
- **Deploy:** when you change the catalog, run `npm run build` and upload the
  resulting `dist/` contents to Bunny storage, then purge the Pull Zone cache — see
  the Deploy checklist above.
- Per-page **helper functions** (`videoCard`, `fmt`, `playerEmbed`, …) are still
  inlined per page and have drifted (e.g. the viewer's `videoCard` is lazy-loaded).
  They are NOT shared — only the catalog is. Unifying helpers is a separate task.
- The old `_archive/` (abandoned build pipeline, `*.src.html`, `_data.js`) has been
  deleted — it was unused and confirmed dead. Don't recreate that pattern.

## Local dev

- Open `index.html` (video homepage, same as `viewer/index.html`) or run
  `Start.command` / `Start.bat` (Python
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

## Movies / Scenes / Clips / Acts (structured long-form content)

For content that's more than a flat clip — a movie broken into scenes
(episodes), each scene cut into clips, plus cross-cutting Act/Highlight
reels — use this filename convention when uploading, so catalog entries
can be generated from filenames alone (no manual tagging UI exists):

```
<Movie-Title>__Scene-<NN>__Clip-<NN>.<ext>                    → a clip within a scene
<Movie-Title>__Scene-<NN>.<ext>                                → a full scene (no clip suffix)
<Movie-Title>__Full-Movie.<ext>                                → the whole movie file
<Movie-Title>__Scene-<NN>__Clip-<NN>__Highlight-<Name>.<ext>   → a highlight moment
<Movie-Title>__Act-<ActName>__<NN>.<ext>                       → a cross-cutting act compilation piece
```

Spaces in the movie title become hyphens; `__` (double underscore)
separates structural segments; scene/clip numbers are zero-padded
2-digit (`Scene-01`, not `Scene-1`) so numeric and lexical sort agree.

This maps onto **optional** fields on the video object in
`src/shared/catalog.js` — existing flat clips simply don't have them:

```js
{
  ...existing fields (id, title, creator, category, src, duration, ...),
  movieTitle: "King David and His Wives",   // shared across every asset from this movie
  level: "movie" | "scene" | "clip" | "highlight" | "act",
  sceneNumber: 1,        // present on scene/clip/highlight levels
  clipNumber: 2,         // present on clip/highlight levels only
  actName: "Doggy",      // only on a dedicated level:"act" compilation entry, if one exists
  tags: ["Doggy"],       // see tag convention below
}
```

**Tag convention — important:** an "Act" row (e.g. "Act: Doggy") appears
automatically for any tag shared by 2+ clips of the *same movie* — no
dedicated compilation file is required (`actNames()` in
`src/viewer/main.js` detects this). Because of that, **`tags` on a
scene/clip entry must be reserved for act-type labels only** ("Doggy",
"Oral", etc.) — do NOT put general descriptive tags ("Blonde", "Big
Tits") on every clip, or they'll each spuriously become their own Act
row. General descriptors belong on the `level:"movie"` entry instead,
which represents the work as a whole.

`src/viewer/main.js` has query helpers (`movies()`, `scenesFor()`,
`clipsFor()`, `actNames()`, `clipsByAct()`, `highlights()`) that group by
these fields at render time — no separate "series" collection, just
filters over the flat `DATA.videos` array, same pattern as the existing
`byCat()`. The homepage filter bar (All/Movies/Scenes/Clips) and the
Movie detail page (`renderMovieDetail`, reachable via `openMovie(title)`
or `#movie/<title>`) are driven entirely by these fields.

## Auth & security (run once, in Supabase SQL Editor)

The following migrations MUST be applied to the live Supabase project — they
close real security holes (anonymous forgery of moderation decisions / fake
upload metadata / unbounded view-count inflation). If they haven't been run
yet against the production project, the RLS policies in `schema-moderation.sql`
and `schema-uploads.sql` are still wide open to anonymous writes:

1. `supabase/schema-auth-tighten.sql` — restricts `moderation` and `uploads`
   table INSERTs to signed-in (`authenticated`) users only. Without this,
   any visitor can POST directly to PostgREST and forge an "approve"/"remove"
   moderation decision, or inject fake upload rows into the catalog, with no
   auth at all.
2. `supabase/schema-views-dedupe.sql` — adds `client_id` to `views` and caps
   inserts to one per (video, client) per day, closing unbounded view-count
   spam (mirrors the existing `schema-likes-fix.sql` pattern).

Both the manager (moderation) and creator (upload) apps now require signing
in via magic link before their write actions will succeed — `/api/upload.js`
also verifies the caller's Supabase access token server-side before accepting
a file, so the "sign in required" UI gate can no longer be bypassed by
POSTing to the endpoint directly.

`/api/upload.js` requires these Vercel env vars: `BUNNY_STORAGE_KEY` (already
required), plus `SUPABASE_URL` and `SUPABASE_KEY` (falls back to the hardcoded
publishable values in the repo if unset — fine for now since the publishable
key is not a secret, but set them explicitly if the project URL/key ever changes).

## Gotchas that have bitten us

- "I uploaded but don't see them live" → the **30-day Pull Zone cache**. Purge it.
- "Purged but still old" → the HTML in **Bunny storage** is old; re-upload the 4 files.
- "Video 404s" → filename mismatch between catalog `src` and Bunny storage.
- Don't trust sequential numbering — list the storage zone and match exactly.
