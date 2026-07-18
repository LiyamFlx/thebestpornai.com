# StreamHub Platform — CLAUDE.md

Self-contained social video platform (viewer / creator / manager). Live at
**https://www.thebestpornai.com**. Adult content site.

## ⚠️ How the live site is served

The site is served directly from **Vercel** with media assets hosted on **Cloudflare R2** (after migrating away from the suspended Bunny CDN/Storage):

```
thebestpornai.com ──► Vercel (hosting HTML/JS pages and Serverless APIs)
media requests    ──► Cloudflare R2 Bucket (streamhub-media)
```

- **Vercel deploys**: `git push origin main` auto-deploys via GitHub integration. Alternatively, manual deploys can be pushed using `npx vercel --prod --yes`.
- **Media Asset Sync**: All matched local video files from the `media/` subdirectories are uploaded to Cloudflare R2 under the `media/` path prefix.

---

## Deploy Checklist (to update the live site)

1. Edit the catalog in `src/shared/catalog.js` (see "Adding videos" below).
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
This script scans local subdirectories under `media/`, matches them against `src/shared/catalog.js` entries, checks if they already exist in R2 using a fast HEAD request, and streams missing files to the bucket.

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
structure), and **inserts them straight into `src/shared/catalog.js`** (a
`catalog.js.bak` is written first). Then:

```bash
npm run build                                  # sanity check
git add -A && git commit -m "publish batch" && git push   # → live via Vercel
```

Flags: `--category`, `--tags "a,b"`, `--creator c1`, `--concurrency 8`,
`--dry-run` (scan + report only, no upload, no edit — always dry-run a big batch
first). Re-running is safe: already-published files are skipped. IDs auto-
increment past the current max, so no collisions.

### Manual path (single video / precise control)

1. Move the `.mp4` into a `media/` subfolder.
2. Add one entry to the `videos: [...]` array in `src/shared/catalog.js`:
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
