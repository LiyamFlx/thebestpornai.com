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
2. Run the deploy helper (recommended):
   ```bash
   # Dry run first (safe, shows exactly what will be uploaded)
   npm run deploy

   # Actually upload (requires BUNNY_STORAGE_KEY in env)
   npm run deploy:apply
   ```
   The script (`deploy.js`) builds if needed, walks `dist/`, and uploads every file
   while preserving the folder structure expected by the live site.

   Manual fallback (if you prefer curl):
   ```bash
   npm run build
   # then upload each file under dist/ to https://storage.bunnycdn.com/streamhub-media/...
   ```

3. **Purge the Pull Zone cache** (30-day TTL — site won't update otherwise):
   Bunny dashboard → CDN → Pull Zone `streamhub-media` → Purge Cache → empty tag → Purge.
   (The deploy script always reminds you of this step.)

4. (Optional) `git commit && git push` to keep GitHub/Vercel in sync.

**Catalog-only fast path**: Edit only `src/shared/catalog.js`, run `npm run build`, then upload the full `dist/` (or just the changed hashed JS chunk + the HTML files that reference it). The deploy script handles this automatically.

**Always verify after deploy**:
```bash
curl -I https://streamhub-media.b-cdn.net/index.html
# and spot-check a couple of video pages + a new asset
```

## Bunny credentials & API

- **Storage Zone:** `streamhub-media`  (id 6077029, region DE)
- **Storage API base:** `https://storage.bunnycdn.com/streamhub-media`
- **CDN (read) base:** `https://streamhub-media.b-cdn.net`  ← this is `MEDIA_BASE`
- **Storage password** (read/write) lives in the Bunny dashboard → Storage → FTP & API
  Access. Do NOT hardcode it in the repo.

**Recommended way to upload:** Use `npm run deploy` / `npm run deploy:apply` (see above). It handles the recursive upload for you.

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
   **Or generate + insert these automatically** for every file already in a Bunny
   folder, instead of hand-typing entries:
   ```bash
   BUNNY_STORAGE_KEY=xxx npm run add-videos -- "folder name" --category "..." --tags "a,b" --patch
   ```
   `--patch` writes directly into `src/shared/catalog.js`. **Always sanity-check
   the result immediately after** — see "Known incident" below for why this step
   is non-negotiable, not optional:
   ```bash
   node -e "
   const fs = require('fs');
   const src = fs.readFileSync('src/shared/catalog.js', 'utf8')
     .replace('const DATA = {', 'global.DATA = {')
     .replace(/export \{[^}]*\};?\s*\$/, '');
   eval(src);
   console.log('videos:', DATA.videos.length);
   console.log('flags:', DATA.flags.length);   // should be unchanged (5) unless you meant to touch a flag
   "
   ```
   If `videos:` didn't grow by exactly the number of files in the folder, or
   `flags:` changed at all, **stop** — the insertion landed in the wrong array.
   Inspect `git diff src/shared/catalog.js` before building/deploying.
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
- Default branch is `main` (GitHub default branch and local git both point here;
  `master` was deleted 2026-07-09). Pushing to it triggers Vercel (but not the
  live domain) — **if Vercel's dashboard still lists `master` as the Production
  Branch, update it to `main`** (Project Settings → Git); the CLI/API field for
  this is `link.productionBranch` on `/v9/projects/{id}` but there's no simple
  CLI command to patch it — use the dashboard.

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
3. `supabase/schema-comments-favorites-fix.sql` — adds `client_id` to
   `comments` and caps inserts to one per (video, client) per minute, blunting
   comment-flood spam. Also documents (does not fix) that `favorites` DELETE
   is `using (true)` and stays that way: this app has no real auth session
   for anonymous actions, so RLS has no trustworthy signal to check
   `client_id` against — a client that could forge the delete filter could
   equally forge any RLS check on it. Real per-user delete scoping would
   require migrating favorites to real Supabase auth sessions, same as
   moderation/uploads above.

**Anonymous actions (likes/views/comments/favorites) are rate-limited by
client-supplied `client_id`, not secured by it** — this blunts casual
flooding from the same browser but not a script that rotates fake ids. Only
`moderation` and `uploads` have real RLS security, because those require an
`authenticated` Supabase session.

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
- **"Video count on the homepage hasn't moved in days" (2026-07-09 incident)** →
  `scripts/add-bunny-folder.js`'s `--patch` mode used
  `content.lastIndexOf('  ],')` over the whole `catalog.js` file to find where
  to insert new entries. That finds whichever array *happens to close last in
  the file text* — which was `users:`, right before `flags:` — not
  `DATA.videos` specifically. Every run silently inserted new video objects
  into `DATA.flags`, which nothing ever reads: no error, no crash, just
  content that quietly never appeared. 215 already-uploaded videos across 3
  Bunny folders sat invisible for up to 11 days before this was caught.
  Fixed: the script now finds `videos: [` explicitly and inserts before
  *that* array's own closing bracket. The lesson generalizes beyond this one
  script: **any automated or manual edit to `catalog.js` needs an immediate
  `videos.length` / `flags.length` sanity check** (see "Adding videos" above)
  before you build and deploy — don't assume a patch landed where you meant it
  to just because the command exited without error.
