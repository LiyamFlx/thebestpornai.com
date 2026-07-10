# Global Upload — Acceptance Results

**Date:** 2026-07-10 · **Branch:** `feat/global-upload`

## Automated checks (run locally — PASS)

| Check | Result |
|---|---|
| Unit tests (`upload-api`, `attestation`, `upload-manager`) | ✅ all pass |
| `npm run build` | ✅ succeeds, all upload modules bundled |
| Secret leak in `dist/` (`BUNNY_STORAGE_KEY`/`SERVICE_ROLE`/`SUPABASE_SERVICE`) | ✅ CLEAN |
| Inline `onclick` in `src/upload/` | ✅ 0 |

## Acceptance criteria requiring a live environment (owner to verify after deploy)

- [ ] Drag on any route → overlay shows, nav clickable, no child-flicker
- [ ] 10 files → 3-way parallelism; killed request retries per backoff [0,3s,10s,30s]
- [ ] Anonymous drop → login path (`#choose`), zero `create-upload` network calls
- [ ] Duplicate file (same first-8MB SHA) → rejected pre-upload
- [ ] Upload reaches `live` → appears in overlay on reload
- [ ] Uploader sees own row; second session does not (RLS: public sees only `status='live'`)
- [ ] RLS script passes with anon/authed/service keys (`supabase/test-global-upload-rls.sh`)

## Known limitations / honest notes (read before enabling the flag)

1. **⚠️ NO MODERATION GATE (owner decision).** Every upload auto-publishes to
   `live` with no human review. `finalize-upload` sets `status='live'` directly.
   `held`/`rejected` statuses exist in schema but nothing routes through them.
2. **⚠️ `/api/upload.js` auth is currently DISABLED.** The relay has
   `verifyUser()` wrapped in a try/catch that only warns (`TEMP: Auth ... removed
   to unblock creator uploads`). So the "no anonymous upload" guarantee rests on
   the **client gate** + the **edge functions** (which DO require auth), NOT the
   byte relay. A script POSTing directly to `/api/upload` can still push a file
   to Bunny storage — but it cannot create a catalog `uploads` row without a
   valid session (edge fn), so it won't appear on the site. **Recommend
   re-enabling relay auth** (uncomment `verifyUser`) before flipping the flag.
3. **Realtime is uploader-session-only.** The live site is static HTML cached in
   Bunny (30-day TTL); DB-overlay merge runs in the SPA on load. Other visitors
   see new uploads on their next page load, not pushed live.
4. **`creator_trust.clean_publishes` upsert overwrites to 1** rather than
   incrementing (PostgREST upsert can't do `col = col + 1`). Stat is inaccurate
   on repeat publishes. Nothing reads it yet (no tier gating). Fix later with an
   RPC if trust tiers get wired.
5. **Uploader display name shows "Unknown"** — DB rows store `user_id` (UUID) in
   `creator`, and `creatorName()` has no matching creator profile. Cosmetic;
   proper creator profiles for uploaders are out of scope.
6. **"Resumable" = retry-with-re-PUT, not TUS byte-range resume** (Bunny Storage
   has no TUS). A dropped upload restarts from 0 on retry.

## Deploy checklist (owner runs — needs credentials I don't have)

```bash
# 1. DB migration
supabase db push          # applies supabase/schema-global-upload.sql
# verify RLS:
SB_URL=... SB_ANON=... SB_SERVICE=... SB_USER_JWT=... bash supabase/test-global-upload-rls.sh

# 2. edge functions (set secrets first)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=...
supabase functions deploy dup-check create-upload finalize-upload

# 3. (recommended) re-enable auth in api/upload.js, then build
#    then flip vstate.flags.globalUpload = true in src/viewer/main.js
npm run build

# 4. deploy dist to Bunny storage + purge cache
npm run deploy:apply      # needs BUNNY_STORAGE_KEY
#    then Bunny dashboard -> Pull Zone -> Purge Cache

# 5. smoke test with a real signed-in account: drag a video, confirm it reaches 'live'
```

The dropzone ships **inert** (`globalUpload: false`) until step 3's flip, so
merging this branch is safe before the backend is provisioned.
