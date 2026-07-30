# StreamHub Platform — CLAUDE.md

Self-contained social video platform (viewer / creator / manager). Live at
**https://www.thebestpornai.com**. Adult content site.

## ⚠️ How the live site is served

The site is served directly from **Vercel** with media assets hosted on **Cloudflare R2** (after migrating away from the suspended Bunny CDN/Storage):

```
thebestpornai.com ──► Vercel (hosting HTML/JS pages and Serverless APIs)
media requests    ──► Cloudflare R2 Bucket (streamhub-media)
```

- **Vercel deploys**: `git push origin main` triggers `.github/workflows/deploy.yml`, which builds and deploys straight to production via the Vercel CLI (not Vercel's own GitHub integration, which has intermittently left pushes as preview-only) and verifies `www.thebestpornai.com` is actually serving the new commit before the workflow succeeds — check `/api/version` or the Actions tab if a deploy needs confirming. Manual deploys can still be pushed with `npx vercel --prod --yes` if needed.
- **Rollback**: if a deploy ships something broken, either run `npx vercel rollback <deployment-url>` (find the last-good URL via `npx vercel ls`), or promote a prior deployment from the Vercel dashboard → Deployments tab → "..." → Promote to Production.
- **Media Asset Sync**: All matched local video files from the `media/` subdirectories are uploaded to Cloudflare R2 under the `media/` path prefix.

---

## Deploy Checklist (to update the live site)

1. Edit the video catalog in `src/shared/catalog-videos.js` (see "Adding videos"
   below). NOTE: the ~4k video entries live in `catalog-videos.js`, which is
   code-split into its own lazily-loaded chunk so the 1.9 MB payload no longer
   blocks first paint. `catalog.js` keeps the helpers, `DATA` (creators,
   comments, etc.) and a small inline SEED of the first entries for instant
   render, then dynamically imports the full list via `loadFullCatalog()`.
2. Run the build to test compile:
   ```bash
   npm run build
   ```
3. Push to GitHub to trigger Vercel deploy:
   ```bash
   git add -A
   git commit -m "update: sync catalog"
   git push origin main
   ```
4. If git/DNS is blocked locally, trigger deployment directly with Vercel CLI:
   ```bash
   npx vercel --prod --yes
   ```
5. Deploying serverless functions and Vite client builds requires having the R2 and Supabase environment keys configured on Vercel:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
   - `R2_ENDPOINT`
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (or `SUPABASE_ANON_KEY`)

---

## Cloudflare R2 details

- **Bucket name:** `streamhub-media`
- **Public Dev-URL (Media base):** `https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev`
- **S3 Endpoint:** `https://f0094d08f5ce974044087c377652c2ad.r2.cloudflarestorage.com` (requires `forcePathStyle: true` inside AWS S3 SDK Client initializations to avoid DNS ENOTFOUND virtual host addressing errors).

### Syncing local catalog videos to R2
To upload local files to R2, execute:
```bash
node scripts/upload-catalog-to-r2.js
```
This script scans local subdirectories under `media/`, matches them against `src/shared/catalog-videos.js` entries, checks if they already exist in R2 using a fast HEAD request, and streams missing files to the bucket.

### Poster thumbnails (card images)

Grid/card thumbnails prefer a lightweight JPEG **poster** over a `<video>` element
— a `<video>` thumb downloads real media bytes and spins a hardware decoder just
to paint one frame (expensive on mobile). `videoCard()` renders `<img>` when an
entry has a `thumb`, and falls back to a lazy `<video>` thumb otherwise, so
posters are optional and can be backfilled incrementally.

- **Backfill existing catalog** (run where the source videos + `ffmpeg` live):
  ```bash
  npm run posters -- --dry-run      # report what's missing, no changes
  npm run posters                   # grab a frame per video, upload to R2, set `thumb`
  ```
  For each entry without a `thumb` it grabs a frame with ffmpeg →
  `media/thumbs/<rel>.jpg`, uploads it to R2 under `media/thumbs/…`, and writes
  `thumb:"../media/thumbs/<rel>.jpg"` onto the entry (a `catalog-videos.js.bak`
  is written first). Idempotent — re-run any time; only missing posters are made.
  Flags: `--concurrency N`, `--limit N`, `--force`.
- **New uploads** get a poster automatically: `publish-folder.js` grabs+uploads a
  poster and sets `thumb` during publish (needs `ffmpeg`; pass `--no-posters` to
  skip, and it degrades gracefully to no-poster if ffmpeg is absent).
- Poster path convention: a video `../media/<rel>.mp4` → poster
  `../media/thumbs/<rel>.jpg` (mirrored under `thumbs/`, extension swapped).
- Generated `media/thumbs/*.jpg` are **local build artifacts** (git-ignored, like
  raw `.mp4`s) — they live on R2, not in the repo.

---

## Adding videos (the catalog)

Videos are streamed from the Cloudflare R2 bucket. `mediaUrl(src)` in `src/shared/catalog.js` points to `https://pub-b281e1d5ecb94a148bd620f8a2fe9d55.r2.dev/media`.

### Fast path — publish a whole folder in one command (recommended for bulk)

Drop videos into a folder under `media/`, then:

```bash
npm run publish -- "media/<folder>" --category "AI" --tags "Big Ass,POV"
# or: node scripts/publish-folder.js "media/<folder>" --category "AI"
```

This does everything in one idempotent pass — scans the folder, **skips anything
already in the catalog or already on R2**, uploads missing files to R2 **in
parallel batches**, generates entries (ffprobe duration, smart tags, movie/scene
structure), and **inserts them straight into `src/shared/catalog-videos.js`** (a
`catalog-videos.js.bak` is written first). Then:

```bash
npm run build                                  # sanity check
git add -A && git commit -m "publish batch" && git push   # → live via Vercel
```

Flags: `--category`, `--tags "a,b"`, `--creator c1`, `--concurrency 8`,
`--dry-run` (scan + report only, no upload, no edit — always dry-run a big batch
first). Re-running is safe: already-published files are skipped. IDs auto-
increment past the current max, so no collisions.

#### Movie/Scene/Clip grouping (organizing a multi-part upload)

The homepage's Movies row and a video's Scenes/Clips grouping (`movies()`,
`scenesFor()`, `clipsFor()` in `src/viewer/catalog-queries.js`) only work for
uploads whose **filenames** use this double-underscore convention — a flat
filename with no `__` gets a plain, ungrouped catalog entry (the normal case
for most uploads):

```
MovieTitle__Full-Movie.mp4              -> the whole movie, one file
MovieTitle__Scene-1.mp4                 -> scene 1's own combined video
MovieTitle__Scene-1__Clip-1.mp4         -> clip 1 within scene 1
MovieTitle__Scene-1__Clip-2.mp4         -> clip 2 within scene 1
MovieTitle__Scene-2__Clip-1.mp4         -> clip 1 within scene 2
MovieTitle__Act-Foreplay__Clip-1.mp4    -> a cross-scene "Act" compilation
MovieTitle__Highlight.mp4               -> a highlight reel
```

- The first `__`-separated segment becomes `movieTitle` (underscores/hyphens
  become spaces).
- `Scene-N` sets `sceneNumber`; a **Clip-N segment alongside it always makes
  the entry a clip** (`level:"clip"`), not a scene — a scene segment with no
  clip segment is the scene's own video (`level:"scene"`). Getting this
  backwards means `clipsFor()` (which filters strictly on `level==="clip"`)
  silently never finds the clip.
- Rename files to this convention **before** running `publish-folder.js` —
  it parses the convention from the filename at publish time
  (`parseStructure()`, duplicated in `scripts/publish-folder.js` and
  `scripts/gen-catalog-from-local.js` — keep both in sync if you touch it).
  There is no supported way to retroactively group already-published, flatly
  named catalog entries into a movie after the fact — the existing ~857
  flat entries in the catalog predate this convention and were left as-is
  rather than guessed at.

### Manual path (single video / precise control)

1. Move the `.mp4` into a `media/` subfolder.
2. Add one entry to the `VIDEOS` array in `src/shared/catalog-videos.js`:
   ```js
   { id:<n>, title:"...", creator:"c1", type:"ugc", category:"Cumshot",
     categories:["Cumshot"], views:0, likes:0, dislikes:0, comments:0, favorites:0,
     duration:"0:10", uploaded:"2026-06-29", src:"../media/<exact subfolder and filename>.mp4",
     tags:["Cumshot","Blowjob"], status:"published", flagged:false }
   ```
3. Sync to R2: `node scripts/upload-catalog-to-r2.js`
4. Deploy: `git push` (auto) or `npx vercel --prod --yes`

---

## Local dev

- Run Vite dev server:
  ```bash
  npm run dev
  ```
- Locally, `MEDIA_BASE` still points at the R2 bucket dev URL, so playback works without needing local files.

---

## Repo hygiene

- **Do not commit raw `.mp4` files.** They belong on R2. The `.vercelignore` ignores the `media/` directory to prevent Vercel from attempting to upload gigabytes of media assets.
- Default branch is `main`.

---

## Auth & security (Supabase SQL Editor)

The following migrations are applied to the live Supabase project:
1. `supabase/schema-auth-tighten.sql` — restricts `moderation` and `uploads` table INSERTs to signed-in (`authenticated`) users.
2. `supabase/schema-views-dedupe.sql` — caps view-count spam to one insert per video/client per day.
3. `supabase/schema-comments-favorites-fix.sql` — caps comment spam to one comment per video/client per minute.

---

## Gotchas

- **DNS / Network ENOTFOUND**: If the terminal environment suffers a DNS block or corporate firewall restriction on port 53, S3 client requests will fail. Avoid virtual host style addressing by specifying `forcePathStyle: true` in `S3Client`.
- **Vercel 12GB upload limits**: If Vite/Vercel attempts to upload a massive amount of data, check `.vercelignore` and ensure `media/` is fully ignored.
