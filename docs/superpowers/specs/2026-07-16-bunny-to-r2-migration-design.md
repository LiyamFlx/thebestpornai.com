# Migration: Bunny CDN → Cloudflare R2

**Date:** 2026-07-16
**Goal:** Stop paying Bunny CDN. Move video storage/delivery to Cloudflare R2 (free at current scale), and serve the static site from Vercel (already builds there), then cancel Bunny.

## Context / Why

Bunny currently does two jobs for this project:

1. **Video storage + delivery** — files live in Bunny Storage zone `streamhub-media`
   (`storage.bunnycdn.com/streamhub-media`), served via pull zone
   `streamhub-media.b-cdn.net`.
2. **Static site hosting** — a Bunny pull zone serves the built static site. Vercel
   (`x-flxx.vercel.app`) already runs the same site for the `/api/*` functions.

The site itself loads fine; the motivation is **cost**, not an outage. Library is
**small (< 50 GB)**, content is **legal adult**, user **has Cloudflare** and **can
still log into Bunny** to copy files out.

At < 50 GB, R2 is effectively **$0/month**: 10 GB storage free (then $0.015/GB),
and **egress is free/unlimited** — the main reason to pick R2 over Bunny/B2.

## Constraints

- Legal adult content only. Cloudflare R2 permits legal adult content; keep existing
  2257/DMCA compliance (already in site footer). No illegal categories.
- Zero data loss: copy all existing media out of Bunny before canceling.
- Minimize code churn — R2 is S3-compatible, so the upload relay changes are small.

## Bunny touchpoints (complete inventory)

| # | File | What it does | Change |
|---|------|--------------|--------|
| 1 | `src/shared/catalog.js:11` | `MEDIA_BASE` delivery URL | Point to R2 custom domain |
| 2 | `api/upload.js` | PUT file bytes → Bunny Storage; `STORAGE_BASE`, `CDN_BASE`, `BUNNY_STORAGE_KEY` | Rewrite to S3 PUT → R2 |
| 3 | `api/save-upload.js` | GET/PUT `manifest.json` on Bunny Storage | Rewrite to S3 GET/PUT → R2 |
| 4 | `supabase/functions/create-upload/index.ts` | stores `bunny_path` field | Keep column name OR rename to `media_path` (DB migration) |
| 5 | `scripts/add-bunny-folder.js` | admin: list Bunny Storage folder | Rewrite to list R2 (S3 ListObjects) — low priority |
| 6 | Vercel env `BUNNY_STORAGE_KEY` | Bunny auth | Replace with R2 S3 creds (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`) |

## Target architecture

```
Browser
  ├── static site .......... served by Vercel (was: Bunny pull zone)   [Part 2]
  ├── /api/upload .......... Vercel fn → S3 PUT → R2 bucket             [Part 1]
  ├── /api/save-upload ..... Vercel fn → S3 GET/PUT manifest.json → R2  [Part 1]
  └── video playback ....... media.<domain> (R2 custom domain)         [Part 1]
```

## Plan (3 parts)

### Part 1 — Video storage/delivery: Bunny → R2  (core of the migration)

1. **Provision** (user, in Cloudflare dashboard):
   - Create R2 bucket, e.g. `streamhub-media`.
   - Add a **custom domain** for public delivery, e.g. `media.<yourdomain>` (gives a
     clean public URL and free egress). Bucket public access via that domain only.
   - Create an **R2 API token** (S3 credentials): Access Key ID + Secret.
2. **Copy existing files** Bunny → R2 with `rclone` (one config each side, one
   `rclone copy`). Includes all `/media/*` and `manifest.json`.
3. **Code changes:**
   - `catalog.js:11` — `MEDIA_BASE` → `https://media.<yourdomain>`.
   - `api/upload.js` — replace Bunny PUT with an S3 `PutObject` to R2 (aws4 signing
     or `@aws-sdk/client-s3`). Return the R2 public URL.
   - `api/save-upload.js` — replace Bunny GET/PUT of `manifest.json` with S3
     Get/Put against R2.
   - `scripts/add-bunny-folder.js` — optional, rewrite to S3 ListObjects (can defer).
4. **Vercel env vars:** add R2 creds; remove `BUNNY_STORAGE_KEY` after cutover.
5. **Verify:** upload a test video through the live flow; confirm it lands in R2 and
   plays back from `media.<yourdomain>`; confirm existing catalog videos still play.

### Part 2 — Static site host: Bunny → Vercel  (optional, recommended)

The site already builds on Vercel. Point the production domain's DNS at Vercel and
serve the whole static site there, eliminating the second Bunny zone. The
`API_BASE` absolute-URL workaround in `upload-api.js` becomes unnecessary once the
site and `/api/*` share one origin (can simplify later; not required for cutover).

### Part 3 — Cancel Bunny

After R2 serves media and (optionally) Vercel serves the site, disable the Bunny
storage + pull zones and stop billing. Keep a local backup of the media copy first.

## Decisions to confirm during planning

- **Custom domain name** for R2 delivery (`media.<yourdomain>`?).
- **`bunny_path` DB column:** keep the name (zero migration) or rename to
  `media_path` (cleaner, needs a Supabase migration). Recommend: keep for now.
- **S3 client:** hand-rolled aws4 signing (no deps) vs `@aws-sdk/client-s3`
  (simpler, adds a dependency). Recommend `@aws-sdk/client-s3` for correctness.
- **Do Part 2 now or later?** Part 1 stops most of the cost; Part 2 can follow.

## Success criteria

- New uploads land in R2 and play back from the R2 domain.
- All pre-existing catalog videos play (files copied, `MEDIA_BASE` swapped).
- No remaining runtime dependency on `*.bunnycdn.com` / `*.b-cdn.net`.
- Bunny zones canceled; monthly cost ≈ $0.
