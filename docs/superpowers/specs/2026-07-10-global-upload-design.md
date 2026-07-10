# StreamHub — Site-wide Drag-and-Drop Upload System (Design)

**Date:** 2026-07-10
**Status:** Awaiting owner review
**Author:** Claude Code (brainstormed with liyamflexer@gmail.com)

## 1. Goal

Let a signed-in creator drag video files anywhere on any page and have them
publish with an "instant feel": an upload card appears immediately, the video
shows in the uploader's own feed right away, and it enters the public catalog
with no manual deploy step.

## 2. Scope decisions (owner-approved, some against recommendation)

These were decided in brainstorming. Recorded here explicitly because two of
them carry risk the owner accepted knowingly.

| Decision | Choice | Notes |
|---|---|---|
| **Upload target** | **Bunny Storage** (existing `/api/upload.js` relay), NOT Bunny Stream | Matches repo; keeps static-HTML serving model. Chunked upload w/ retry gives resilience without a Bunny Stream library. Stream = future milestone. |
| **Moderation / CSAM pipeline** | **NOT built** | Claude declined to author CSAM detection/NCMEC reporting logic (correctness+legal risk). Owner also chose to skip a review gate. |
| **Review gate** | **None — all uploads auto-publish to `live`** | ⚠️ Owner-approved against recommendation. No human step between upload and public. The `held` status column is still created so a queue can be switched on later with no migration, but nothing routes through it. |
| **Backend runtime** | **Supabase edge functions (Deno)** | New deploy target for this repo (`supabase functions deploy`). Auth + DB + functions in one place. |
| **Publish path** | **DB overlay, SPA-merged** | `catalog.js` stays the seed; SPA fetches `status='live'` rows from `uploads` table on load and merges into `DATA.videos`. No per-upload redeploy. |

### Consequences the owner accepted
- **No moderation:** one bad upload is publicly served before anyone reviews it.
- **Realtime is uploader-session-only:** the live site is static HTML cached in
  Bunny (30-day TTL). Realtime status updates only reach a viewer running the
  SPA JS — i.e. the uploader's own tab right after upload. It cannot push into
  cached static pages for other visitors.
- **SEO lag:** crawlers hitting raw static HTML won't see DB-only videos until a
  periodic catalog rebake (scheduled job, decoupled from upload latency).
- **Extra deploy step:** releases now include `supabase functions deploy`.

## 3. Architecture

```
Browser (Vite SPA, any route)
  │
  ├─ global-dropzone.js ── drag/drop + hidden file input ──┐
  │                                                        ▼
  ├─ upload-manager.js (module singleton, survives hash nav)
  │     • client pre-filter: magic-byte sniff, size, duration
  │     • SHA-256(first 8MB) → dup-check edge fn
  │     • create-upload edge fn → returns { uploadId }
  │     • chunked PUT to /api/upload (Bunny Storage relay) w/ retry
  │     • instant preview card in #upload-tray (bottom sheet)
  │     • vstate.pendingUploads overlay (uploader-only)
  │
  ├─ catalog-overlay.js ── fetch live uploads on load, merge into DATA.videos
  │
Supabase
  ├─ edge fn create-upload (auth) → insert uploads row (status=processing)
  ├─ edge fn dup-check     (auth) → banned_hashes / existing sha check
  ├─ edge fn finalize-upload (auth) → set status=live, published_at (no gate)
  └─ Postgres: uploads, creator_trust, upload_attestations, banned_hashes (RLS)

Vercel
  └─ /api/upload.js (existing) — streams file bytes to Bunny Storage
```

**Why two backends:** file bytes keep flowing through the existing Vercel relay
(`/api/upload.js`) because it already streams straight to Bunny Storage with no
body-size wall. Supabase edge functions handle only *metadata + decisions*
(create row, dup-check, finalize) — small JSON calls where the auth+DB colocation
pays off. We do not move file bytes through Supabase.

## 4. Components

### 4.1 `src/upload/global-dropzone.js`
- Mounted once in the app shell (import from each app's `main.js`).
- Window-level `dragenter/dragover/dragleave/drop` with a `dragDepth` counter to
  kill child-element flicker.
- `#drop-overlay`: fixed, full-viewport, `pointer-events:none` until active,
  z-index **below** nav so nav stays clickable. Dashed inset border, "Drop
  videos to upload" label, live file-count badge.
- Hidden `<input type=file multiple accept="video/*">`; any element with
  `data-page="upload-trigger"` opens it (mobile/click fallback).
- Non-video files → silent reject + toast (never `alert`).
- **Auth gate:** no `ShAuth` session → drop opens the login modal, enqueues
  nothing, makes zero network calls.
- Conventions: `data-*` delegation only (no inline `onclick`), `jsq()`/`jsdec()`
  for any value passing through a DOM attribute.

### 4.2 `src/upload/upload-manager.js` (singleton)
Job shape: `{ id, file, status, progress, blobUrl, uploadId, title, tags }`.
Statuses: `queued | hashing | uploading | live | error` (plus `held`/`rejected`
defined but unused — see scope).

- `enqueue(File[])` builds jobs, renders cards immediately.
- **Pre-filter (before any bytes):** magic-byte sniff (MP4 `ftyp`, WebM/EBML
  `1A45DFA3`, MOV `qt`/`ftyp`); max size (`VITE_MAX_UPLOAD_BYTES`, default 4GB);
  max duration via `<video>` metadata probe on the blob (`VITE_MAX_DURATION_S`,
  default 3600). SHA-256 of first 8MB → `dup-check`.
- **Upload:** `create-upload` → chunked `PUT` to `/api/upload` with retry
  backoff `[0, 3s, 10s, 30s]`, 3 concurrent jobs. (Bunny Storage has no TUS;
  "resume" = re-PUT with retry, not byte-range resume. Honest limitation.)
- **Instant preview:** `URL.createObjectURL` + canvas frame grab at 1s for the
  thumbnail; progress ring; cancel; inline title (prefilled from filename) + tag
  editor.
- **Attestation gate:** first enqueue per session shows a blocking 2257
  attestation modal (18+, consent, records held). Store row in
  `upload_attestations`. Verified creators (tier ≥1): once per session; tier 0:
  per upload.
- **beforeunload** warning while any job is `uploading`.

### 4.3 `src/upload/upload-tray.js`
Persistent bottom-sheet `#upload-tray` rendered in the app shell, survives hash
navigation, lists active/recent job cards.

### 4.4 `src/upload/catalog-overlay.js`
On app load: fetch `uploads` where `status='live'` (public RLS allows), map rows
to catalog video shape, merge into `DATA.videos`. The uploader's own
`processing` rows are merged too (owner RLS) so they see their pending video.
Extends existing `visible()`/`pubVideos()` — does not fork them.

## 5. Data model (Supabase migration)

Tables: `uploads`, `creator_trust`, `upload_attestations`, `banned_hashes`
(schema per build prompt §3). **RLS deny-by-default:**
- `uploads`: SELECT — owner sees own rows; public sees `status='live'`. INSERT —
  service-role only (edge fn). UPDATE — owner may change `title`,`tags` while
  `status != 'live'`; status transitions service-role only.
- `creator_trust`, `banned_hashes`: no client access (service role only).
- `upload_attestations`: INSERT own, SELECT own.
Policies written explicitly in the migration; no reliance on defaults.

## 6. Edge functions (Supabase, Deno)
- **`create-upload`** (auth): verify session → verify attestation exists →
  insert `uploads` row (`status='processing'`) → return `{ uploadId }`. Rate
  limit 30/hour/user.
- **`dup-check`** (auth): `{ sha256_head }` → reject if in `banned_hashes` or
  already in `uploads`.
- **`finalize-upload`** (auth): caller owns the row → set `status='live'`,
  `published_at=now()`, `creator_trust.clean_publishes++`. **No moderation, no
  gate** (owner decision). Structured so a future `held` branch slots in here.

`BUNNY_STORAGE_KEY` and any future moderation keys stay server-side only; audit
that no `VITE_`-prefixed env carries a secret.

## 7. Client status sync
Supabase Realtime on `uploads` filtered to own `user_id`; updates tray cards and
`vstate.pendingUploads`/overlay. `live` → toast + card green + merge into public
overlay. (Only reaches the uploader's live SPA session — see §2 consequences.)

## 8. Config / env
```
VITE_MAX_UPLOAD_BYTES=4294967296
VITE_MAX_DURATION_S=3600
BUNNY_STORAGE_KEY=      # server only (already required by /api/upload.js)
SUPABASE_URL= SUPABASE_KEY=   # already used
# feature flag: vstate.flags.globalUpload gates the dropzone mount
```

## 9. Acceptance criteria
- [ ] Drag on any route shows overlay; nav clickable; no child-flicker
- [ ] 10 files upload, 3-way parallel; killed request retries per backoff
- [ ] Anonymous drop → login modal, zero create-upload calls
- [ ] Duplicate (same sha256_head) rejected pre-upload
- [ ] Upload reaches `live` and appears in public overlay on next load
- [ ] Uploader sees own `processing` video in own feed; a second session does not
- [ ] `BUNNY_STORAGE_KEY` absent from `dist` bundles (`grep -r`)
- [ ] RLS verified with anon + authed + service keys on every table
- [ ] Zero inline `onclick` in new code

## 10. Build order
migration → edge functions → upload-manager → dropzone/tray UI → catalog-overlay
+ realtime → tests → deploy (build, `supabase db push`, `supabase functions
deploy`, deploy dist to Bunny, purge cache). Commit per section.

## 11. Explicitly NOT in this build
- CSAM detection, age-estimation classifier, NCMEC reporting, Hive/Thorn
  adapters — declined; requires vendor + legal.
- Human review queue / manager approve-reject flow — owner chose no gate.
- Bunny Stream migration (TUS byte-range resume, encode webhooks, ABR).
