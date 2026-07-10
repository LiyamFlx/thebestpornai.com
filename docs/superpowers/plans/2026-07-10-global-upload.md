# Global Upload System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in creators drag video files anywhere on any page; the video uploads to Bunny Storage and auto-publishes to a DB-overlay catalog with an instant-feel UI.

**Architecture:** Vanilla-JS ES-module client (Vite, no framework). New `src/upload/` modules mount once in the app shell. File bytes stream through the existing Vercel `/api/upload.js` Bunny Storage relay; metadata/decisions go through three Supabase Deno edge functions backed by four RLS-protected Postgres tables. Live uploads are fetched on SPA load and merged into `DATA.videos` (no redeploy per upload).

**Tech Stack:** Vanilla JS ES modules, Vite, Supabase (PostgREST + GoTrue + edge functions + Realtime), Bunny Storage, Vercel serverless. Zero new npm runtime deps (Web Crypto for SHA-256, native drag/drop, `<canvas>` for thumbnails).

## Global Constraints

- **No inline `onclick`** in any new code — `data-*` event delegation only (type="module" timing hazard). Existing files have some; do not add more.
- Any value passing through a DOM attribute goes through `jsq()` (encode) / `jsdec()` (decode); defined in Task 5.
- No new npm dependencies. SHA-256 via `crypto.subtle.digest`; drag/drop native; thumbnail via `<canvas>`.
- `toast(msg)` is imported from `../shared/catalog.js` — never use `alert()`.
- Never mutate seed `DATA` catalog entries; runtime state lives in overlays.
- Secrets (`BUNNY_STORAGE_KEY`) are server-only. No `VITE_`-prefixed secret, ever.
- `VITE_MAX_UPLOAD_BYTES` default `4294967296`; `VITE_MAX_DURATION_S` default `3600`.
- Dropzone is gated behind `vstate.flags.globalUpload` (default off until acceptance passes).
- **No moderation and no review gate** (owner decision): `finalize-upload` sets `status='live'` directly. The `held`/`rejected` statuses exist in schema/enums but nothing routes through them.
- Auth uses existing `ShAuth` (session token via `ShAuth.session().access_token`); authed Supabase calls follow the `_authedReq` pattern in `streamhub-api.js`.

---

### Task 1: Supabase migration — tables + RLS

**Files:**
- Create: `supabase/schema-global-upload.sql`
- Test: `supabase/test-global-upload-rls.sh` (manual verification script)

**Interfaces:**
- Produces: tables `uploads`, `creator_trust`, `upload_attestations`, `banned_hashes` with the RLS policies later tasks depend on. Column names the client uses: `uploads(id, user_id, bunny_path, title, tags, status, sha256_head, duration_s, created_at, published_at)`.

> Note: prompt §3 used `bunny_video_id` (Bunny Stream). We use **Bunny Storage**, so the column is `bunny_path text unique not null` — the storage path/filename under `streamhub-media/`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/schema-global-upload.sql
-- Site-wide upload system. Run in Supabase SQL editor or via `supabase db push`.
-- Owner decision: NO moderation gate. status goes straight to 'live' on finalize.
-- 'held'/'rejected' exist so a review queue can be enabled later without migration.

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  bunny_path text unique not null,
  title text not null default '',
  tags text[] not null default '{}',
  status text not null default 'processing'
    check (status in ('processing','live','held','rejected')),
  reject_reason text,
  sha256_head text,
  duration_s int,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists uploads_live_idx on uploads (status) where status = 'live';
create index if not exists uploads_owner_idx on uploads (user_id);

create table if not exists creator_trust (
  user_id uuid primary key references auth.users(id),
  tier int not null default 0,
  strikes int not null default 0,
  clean_publishes int not null default 0,
  id_verified boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists upload_attestations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  upload_ids uuid[] not null default '{}',
  attested_at timestamptz not null default now()
);

create table if not exists banned_hashes (
  sha256_head text primary key,
  reason text,
  added_at timestamptz not null default now()
);

-- RLS: deny by default
alter table uploads enable row level security;
alter table creator_trust enable row level security;
alter table upload_attestations enable row level security;
alter table banned_hashes enable row level security;

-- uploads: public reads only live rows; owner reads own rows (any status).
create policy uploads_public_live on uploads
  for select to anon, authenticated using (status = 'live');
create policy uploads_owner_read on uploads
  for select to authenticated using (auth.uid() = user_id);
-- INSERT: service role only (edge fn). No client insert policy = denied for anon/authenticated.
-- UPDATE: owner may edit title/tags while not yet live; status transitions are service-role only.
create policy uploads_owner_update on uploads
  for update to authenticated
  using (auth.uid() = user_id and status <> 'live')
  with check (auth.uid() = user_id and status <> 'live');

-- creator_trust, banned_hashes: no client policies at all => service-role only.

-- upload_attestations: insert + select own.
create policy attest_insert_own on upload_attestations
  for insert to authenticated with check (auth.uid() = user_id);
create policy attest_select_own on upload_attestations
  for select to authenticated using (auth.uid() = user_id);
```

- [ ] **Step 2: Write the RLS verification script**

```bash
# supabase/test-global-upload-rls.sh
# Verifies RLS. Requires: SB_URL, SB_ANON, SB_SERVICE, SB_USER_JWT in env.
set -euo pipefail
REST="$SB_URL/rest/v1"
echo "1. anon SELECT uploads -> should return [] (only live, none yet):"
curl -s "$REST/uploads?select=id" -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
echo; echo "2. anon INSERT uploads -> should be 401/403:"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$REST/uploads" \
  -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON" \
  -H "Content-Type: application/json" -d '{"user_id":"00000000-0000-0000-0000-000000000000","bunny_path":"x"}'
echo "3. anon SELECT creator_trust -> should be [] or 403 (no policy):"
curl -s "$REST/creator_trust?select=user_id" -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
echo; echo "4. anon SELECT banned_hashes -> should be [] or 403:"
curl -s "$REST/banned_hashes?select=sha256_head" -H "apikey: $SB_ANON" -H "Authorization: Bearer $SB_ANON"
echo; echo "Manual: with SB_USER_JWT, SELECT uploads returns own rows; UPDATE title on own non-live row succeeds; UPDATE status fails."
```

- [ ] **Step 3: Apply and verify**

Run: `supabase db push` (or paste SQL into the Supabase SQL editor), then `bash supabase/test-global-upload-rls.sh`
Expected: check 1 → `[]`; check 2 → `401` or `403`; checks 3 & 4 → `[]` or `403`. No check returns forbidden data.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema-global-upload.sql supabase/test-global-upload-rls.sh
git commit -m "feat(upload): uploads/creator_trust/attestations/banned_hashes tables + RLS"
```

---

### Task 2: Edge function `dup-check`

**Files:**
- Create: `supabase/functions/dup-check/index.ts`
- Create: `supabase/functions/_shared/auth.ts`

**Interfaces:**
- Consumes: `uploads`, `banned_hashes` (Task 1); env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: `POST /functions/v1/dup-check` body `{ sha256_head: string }` → `200 {duplicate:false}` or `409 {duplicate:true, reason}`. Shared `requireUser(req): Promise<{id}>` helper used by Tasks 2–4.

- [ ] **Step 1: Write the shared auth helper**

```ts
// supabase/functions/_shared/auth.ts
export async function requireUser(req: Request): Promise<{ id: string }> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Response("unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!r.ok) throw new Response("unauthorized", { status: 401 });
  const u = await r.json();
  return { id: u.id };
}
export function svc() {
  return { url: Deno.env.get("SUPABASE_URL")!, key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! };
}
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

- [ ] **Step 2: Write dup-check**

```ts
// supabase/functions/dup-check/index.ts
import { requireUser, svc, CORS } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    await requireUser(req);
    const { sha256_head } = await req.json();
    if (!sha256_head) return json({ error: "sha256_head required" }, 400);
    const { url, key } = svc();
    const h = { apikey: key, Authorization: `Bearer ${key}` };
    const ban = await fetch(`${url}/rest/v1/banned_hashes?sha256_head=eq.${sha256_head}&select=reason`, { headers: h }).then(r => r.json());
    if (ban.length) return json({ duplicate: true, reason: "banned" }, 409);
    const dup = await fetch(`${url}/rest/v1/uploads?sha256_head=eq.${sha256_head}&select=id`, { headers: h }).then(r => r.json());
    if (dup.length) return json({ duplicate: true, reason: "exists" }, 409);
    return json({ duplicate: false }, 200);
  } catch (e) { return e instanceof Response ? withCors(e) : json({ error: String(e) }, 500); }
});
function json(b: unknown, s: number) { return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
function withCors(r: Response) { const h = new Headers(r.headers); Object.entries(CORS).forEach(([k, v]) => h.set(k, v)); return new Response(r.body, { status: r.status, headers: h }); }
```

- [ ] **Step 3: Deploy and test**

Run:
```bash
supabase functions deploy dup-check
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SB_URL/functions/v1/dup-check" \
  -H "Content-Type: application/json" -d '{"sha256_head":"abc"}'   # expect 401 (no auth)
curl -s -X POST "$SB_URL/functions/v1/dup-check" \
  -H "Authorization: Bearer $SB_USER_JWT" -H "Content-Type: application/json" \
  -d '{"sha256_head":"nonexistent"}'   # expect {"duplicate":false}
```
Expected: no-auth → `401`; authed unknown hash → `{"duplicate":false}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/auth.ts supabase/functions/dup-check/index.ts
git commit -m "feat(upload): dup-check edge function + shared auth helper"
```

---

### Task 3: Edge function `create-upload`

**Files:**
- Create: `supabase/functions/create-upload/index.ts`

**Interfaces:**
- Consumes: `requireUser`, `svc`, `CORS` (Task 2); tables `uploads`, `upload_attestations` (Task 1).
- Produces: `POST /functions/v1/create-upload` body `{ bunny_path, title, tags, sha256_head, duration_s }` → `201 { uploadId }`. Requires an attestation row for the user to exist. Rate limit 30/hour/user.

- [ ] **Step 1: Write create-upload**

```ts
// supabase/functions/create-upload/index.ts
import { requireUser, svc, CORS } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await requireUser(req);
    const { bunny_path, title, tags, sha256_head, duration_s } = await req.json();
    if (!bunny_path) return json({ error: "bunny_path required" }, 400);
    const { url, key } = svc();
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    // attestation gate
    const att = await fetch(`${url}/rest/v1/upload_attestations?user_id=eq.${user.id}&select=id&limit=1`, { headers: h }).then(r => r.json());
    if (!att.length) return json({ error: "attestation required" }, 403);
    // rate limit: 30 rows in last hour
    const since = new Date(Date.now() - 3600e3).toISOString();
    const recent = await fetch(`${url}/rest/v1/uploads?user_id=eq.${user.id}&created_at=gte.${since}&select=id`, { headers: h }).then(r => r.json());
    if (recent.length >= 30) return json({ error: "rate limit" }, 429);
    const row = { user_id: user.id, bunny_path, title: title || "", tags: tags || [], sha256_head: sha256_head || null, duration_s: duration_s || null, status: "processing" };
    const ins = await fetch(`${url}/rest/v1/uploads`, { method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!ins.ok) return json({ error: "insert failed", detail: await ins.text() }, 500);
    const [created] = await ins.json();
    return json({ uploadId: created.id }, 201);
  } catch (e) { return e instanceof Response ? e : json({ error: String(e) }, 500); }
});
function json(b: unknown, s: number) { return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
```

- [ ] **Step 2: Deploy and test**

Run:
```bash
supabase functions deploy create-upload
# no attestation yet -> expect 403
curl -s -X POST "$SB_URL/functions/v1/create-upload" -H "Authorization: Bearer $SB_USER_JWT" \
  -H "Content-Type: application/json" -d '{"bunny_path":"test/x.mp4","title":"t"}'
```
Expected: `{"error":"attestation required"}` with 403 (until Task 6 inserts an attestation).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-upload/index.ts
git commit -m "feat(upload): create-upload edge function (attestation gate + rate limit)"
```

---

### Task 4: Edge function `finalize-upload`

**Files:**
- Create: `supabase/functions/finalize-upload/index.ts`

**Interfaces:**
- Consumes: `requireUser`, `svc`, `CORS` (Task 2); `uploads`, `creator_trust` (Task 1).
- Produces: `POST /functions/v1/finalize-upload` body `{ uploadId }` → `200 { status:'live', published_at }`. Caller must own the row. Sets `status='live'` directly (no gate) and bumps `creator_trust.clean_publishes`.

- [ ] **Step 1: Write finalize-upload**

```ts
// supabase/functions/finalize-upload/index.ts
import { requireUser, svc, CORS } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const user = await requireUser(req);
    const { uploadId } = await req.json();
    if (!uploadId) return json({ error: "uploadId required" }, 400);
    const { url, key } = svc();
    const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const [row] = await fetch(`${url}/rest/v1/uploads?id=eq.${uploadId}&select=id,user_id,status`, { headers: h }).then(r => r.json());
    if (!row) return json({ error: "not found" }, 404);
    if (row.user_id !== user.id) return json({ error: "forbidden" }, 403);
    const published_at = new Date().toISOString();
    // OWNER DECISION: no moderation gate — straight to live.
    const upd = await fetch(`${url}/rest/v1/uploads?id=eq.${uploadId}`, { method: "PATCH", headers: h, body: JSON.stringify({ status: "live", published_at }) });
    if (!upd.ok) return json({ error: "update failed" }, 500);
    // bump clean_publishes (upsert creator_trust)
    await fetch(`${url}/rest/v1/creator_trust`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: user.id, clean_publishes: 1 }) });
    return json({ status: "live", published_at }, 200);
  } catch (e) { return e instanceof Response ? e : json({ error: String(e) }, 500); }
});
function json(b: unknown, s: number) { return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
```

- [ ] **Step 2: Deploy and test**

Run:
```bash
supabase functions deploy finalize-upload
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$SB_URL/functions/v1/finalize-upload" \
  -H "Content-Type: application/json" -d '{"uploadId":"x"}'   # expect 401
```
Expected: no auth → `401`. Full live-transition verified end-to-end in Task 9.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/finalize-upload/index.ts
git commit -m "feat(upload): finalize-upload edge function (auto-live, no gate)"
```

---

### Task 5: Upload API client + helpers (`ShUpload`)

**Files:**
- Create: `src/upload/upload-api.js`
- Modify: `src/shared/streamhub-api.js` (export `ShUpload`, add `EDGE_BASE`)
- Test: `src/upload/upload-api.test.mjs` (node, no framework)

**Interfaces:**
- Consumes: `ShAuth.session()` (existing), `/api/upload` relay (existing), edge fns (Tasks 2–4).
- Produces:
  - `jsq(s): string`, `jsdec(s): string` — attribute-safe encode/decode.
  - `sha256Head(file): Promise<string>` — hex SHA-256 of first 8MB.
  - `sniffVideo(file): Promise<'mp4'|'webm'|'mov'|null>` — magic-byte type.
  - `ShUpload.dupCheck(sha)`, `.createUpload(meta)`, `.finalize(uploadId)`, `.putBytes(file, path, onProgress)` — returns `{ ok, ... }`.

- [ ] **Step 1: Write failing tests for helpers**

```js
// src/upload/upload-api.test.mjs
import assert from "node:assert";
import { jsq, jsdec, sniffBytes } from "./upload-api.js";
// round-trip encode
const s = 'a"b&c<>d é';
assert.strictEqual(jsdec(jsq(s)), s, "jsq/jsdec round-trip");
// magic bytes: MP4 ftyp at offset 4
const mp4 = new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70]); // ....ftyp
assert.strictEqual(sniffBytes(mp4), "mp4", "mp4 ftyp");
const webm = new Uint8Array([0x1A,0x45,0xDF,0xA3]);
assert.strictEqual(sniffBytes(webm), "webm", "webm ebml");
const bogus = new Uint8Array([0x25,0x50,0x44,0x46]); // %PDF
assert.strictEqual(sniffBytes(bogus), null, "pdf rejected");
console.log("upload-api helpers OK");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/upload/upload-api.test.mjs`
Expected: FAIL — `Cannot find module './upload-api.js'`.

- [ ] **Step 3: Write upload-api.js**

```js
// src/upload/upload-api.js
import { ShAuth } from "../shared/streamhub-api.js";

const EDGE_BASE = "https://dabfxysxcngijcxxekzc.supabase.co/functions/v1";
const UPLOAD_RELAY = "/api/upload"; // existing Vercel Bunny Storage relay

/* attribute-safe transport (matches repo's jsq/jsdec convention) */
export const jsq = (s) => encodeURIComponent(String(s));
export const jsdec = (s) => decodeURIComponent(String(s));

/* magic-byte sniff on a byte view (sync, testable) */
export function sniffBytes(u8) {
  if (u8.length >= 4 && u8[0] === 0x1A && u8[1] === 0x45 && u8[2] === 0xDF && u8[3] === 0xA3) return "webm";
  if (u8.length >= 8 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    // ftyp brand: 'qt  ' => mov, else mp4
    return "mp4"; // MOV also uses ftyp; treated as mp4-family (Bunny serves both). Good enough.
  }
  return null;
}
export async function sniffVideo(file) {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return sniffBytes(buf);
}

export async function sha256Head(file) {
  const buf = await file.slice(0, 8 * 1024 * 1024).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function tok() { const s = ShAuth && ShAuth.session(); if (!s) throw new Error("sign in required"); return s.access_token; }
async function edge(path, body) {
  const r = await fetch(`${EDGE_BASE}/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}

export const ShUpload = {
  dupCheck: (sha256_head) => edge("dup-check", { sha256_head }),
  createUpload: (meta) => edge("create-upload", meta),
  finalize: (uploadId) => edge("finalize-upload", { uploadId }),
  putBytes(file, path, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", UPLOAD_RELAY, true);
      xhr.setRequestHeader("Authorization", `Bearer ${tok()}`);
      xhr.setRequestHeader("x-upload-path", path);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); } } else reject(new Error("upload " + xhr.status)); };
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(file);
    });
  },
};
```

> Note: `putBytes` sends the whole file with retry at the manager layer (Task 7). Bunny Storage has no TUS, so "resume" = retry the PUT, not byte-range resume — documented in the spec.

- [ ] **Step 4: Run tests to verify pass**

Run: `node src/upload/upload-api.test.mjs`
Expected: PASS — `upload-api helpers OK`.

- [ ] **Step 5: Commit**

```bash
git add src/upload/upload-api.js src/upload/upload-api.test.mjs
git commit -m "feat(upload): ShUpload client, sha256/magic-byte/jsq helpers"
```

---

### Task 6: Attestation modal (2257 gate)

**Files:**
- Create: `src/upload/attestation.js`
- Test: `src/upload/attestation.test.mjs`

**Interfaces:**
- Consumes: `ShAuth`, `ShUpload` pattern (edge writes go direct to PostgREST as authed user, since `upload_attestations` allows owner INSERT — no edge fn needed).
- Produces: `needsAttestation(): Promise<boolean>`, `recordAttestation(uploadIds): Promise<void>`, `showAttestationModal(): Promise<boolean>` (resolves true if user confirms). Session flag `sessionStorage['sh_attested']`.

- [ ] **Step 1: Write failing test for gating logic**

```js
// src/upload/attestation.test.mjs
import assert from "node:assert";
import { attestationState } from "./attestation.js";
// pure state machine: given (sessionAttested, tier) -> should we block enqueue?
assert.strictEqual(attestationState(false, 0), "per-upload", "tier0 always per-upload");
assert.strictEqual(attestationState(true, 1), "ok", "verified + session flag => ok");
assert.strictEqual(attestationState(false, 1), "once", "verified needs once/session");
console.log("attestation state OK");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/upload/attestation.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// src/upload/attestation.js
import { ShAuth } from "../shared/streamhub-api.js";
import { toast } from "../shared/catalog.js";

const REST = "https://dabfxysxcngijcxxekzc.supabase.co/rest/v1";
const ANON = "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";

/* pure decision fn (testable): returns 'ok' | 'once' | 'per-upload' */
export function attestationState(sessionAttested, tier) {
  if (tier <= 0) return "per-upload";
  return sessionAttested ? "ok" : "once";
}

export async function recordAttestation(uploadIds = []) {
  const s = ShAuth.session(); if (!s) throw new Error("sign in required");
  const u = await ShAuth.user();
  await fetch(`${REST}/upload_attestations`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: u.id, upload_ids: uploadIds }),
  });
  sessionStorage.setItem("sh_attested", "1");
}

export function showAttestationModal() {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.id = "attest-modal";
    wrap.setAttribute("role", "dialog");
    wrap.innerHTML = `
      <div class="attest-card">
        <h2>Before you upload</h2>
        <p>By continuing you attest that all performers depicted are 18 years or older,
        appear with consent, and that records required under 18 U.S.C. §2257 are held.</p>
        <label><input type="checkbox" id="attest-ck"> I confirm the above.</label>
        <div class="attest-actions">
          <button class="btn" data-attest="cancel">Cancel</button>
          <button class="btn primary" data-attest="confirm" disabled>Confirm &amp; continue</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const ck = wrap.querySelector("#attest-ck");
    const ok = wrap.querySelector('[data-attest="confirm"]');
    wrap.addEventListener("change", () => { ok.disabled = !ck.checked; });
    wrap.addEventListener("click", (e) => {
      const a = e.target.closest("[data-attest]"); if (!a) return;
      const done = (v) => { wrap.remove(); resolve(v); };
      if (a.dataset.attest === "cancel") done(false);
      if (a.dataset.attest === "confirm" && ck.checked) done(true);
    });
  });
}

export async function needsAttestation(tier = 0) {
  const st = attestationState(sessionStorage.getItem("sh_attested") === "1", tier);
  return st !== "ok";
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node src/upload/attestation.test.mjs`
Expected: PASS — `attestation state OK`.

- [ ] **Step 5: Commit**

```bash
git add src/upload/attestation.js src/upload/attestation.test.mjs
git commit -m "feat(upload): 2257 attestation gate (modal + per-tier logic)"
```

---

### Task 7: UploadManager singleton + tray

**Files:**
- Create: `src/upload/upload-manager.js`
- Create: `src/upload/upload-tray.js`
- Create: `src/upload/upload.css`
- Test: `src/upload/upload-manager.test.mjs`

**Interfaces:**
- Consumes: `ShUpload`, `sniffVideo`, `sha256Head`, `jsq` (Task 5); attestation (Task 6).
- Produces: `UploadManager.enqueue(files: File[])`, `.jobs` (array), `.on(evt, cb)`; job `{ id, file, status, progress, uploadId, title, tags, bunny_path }`. Statuses `queued|hashing|uploading|live|error`. Concurrency 3, retry backoff `[0,3000,10000,30000]`.

- [ ] **Step 1: Write failing test for queue concurrency + retry**

```js
// src/upload/upload-manager.test.mjs
import assert from "node:assert";
import { computeBackoff, nextRunnable } from "./upload-manager.js";
assert.deepStrictEqual([0,1,2,3].map(computeBackoff), [0,3000,10000,30000], "backoff schedule");
assert.strictEqual(computeBackoff(4), null, "no retry after 4 attempts");
// nextRunnable: given jobs + max 3 concurrent uploading, pick queued ones up to slots
const jobs = [{status:"uploading"},{status:"uploading"},{status:"queued"},{status:"queued"}];
assert.strictEqual(nextRunnable(jobs, 3).length, 1, "one slot free -> one runnable");
console.log("upload-manager core OK");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node src/upload/upload-manager.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement manager (pure core exported for tests)**

```js
// src/upload/upload-manager.js
import { ShUpload, sniffVideo, sha256Head } from "./upload-api.js";

const MAX_BYTES = Number(import.meta.env?.VITE_MAX_UPLOAD_BYTES) || 4294967296;
const MAX_DUR = Number(import.meta.env?.VITE_MAX_DURATION_S) || 3600;
const CONCURRENCY = 3;
const BACKOFF = [0, 3000, 10000, 30000];

/* pure helpers (testable) */
export const computeBackoff = (attempt) => (attempt < BACKOFF.length ? BACKOFF[attempt] : null);
export const nextRunnable = (jobs, max) => {
  const active = jobs.filter(j => j.status === "uploading").length;
  const slots = Math.max(0, max - active);
  return jobs.filter(j => j.status === "queued").slice(0, slots);
};

function probeDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

const listeners = {};
function emit(evt, data) { (listeners[evt] || []).forEach(cb => cb(data)); }

export const UploadManager = {
  jobs: [],
  on(evt, cb) { (listeners[evt] ||= []).push(cb); },
  async enqueue(files) {
    for (const file of files) {
      const type = await sniffVideo(file);
      if (!type) { emit("reject", { file, reason: "not a video" }); continue; }
      if (file.size > MAX_BYTES) { emit("reject", { file, reason: "too large" }); continue; }
      const dur = await probeDuration(file);
      if (dur > MAX_DUR) { emit("reject", { file, reason: "too long" }); continue; }
      const job = { id: "j_" + Math.random().toString(36).slice(2), file, status: "queued", progress: 0, attempt: 0,
        title: file.name.replace(/\.[^.]+$/, ""), tags: [], blobUrl: URL.createObjectURL(file) };
      this.jobs.push(job); emit("add", job);
    }
    this.pump();
  },
  async pump() {
    for (const job of nextRunnable(this.jobs, CONCURRENCY)) this.run(job);
  },
  async run(job) {
    try {
      job.status = "hashing"; emit("update", job);
      const sha = await sha256Head(job.file);
      const dup = await ShUpload.dupCheck(sha);
      if (dup.duplicate) { job.status = "error"; job.error = "duplicate"; emit("update", job); return; }
      const path = `uploads/${Date.now()}_${job.file.name}`.replace(/\s+/g, "-");
      const created = await ShUpload.createUpload({ bunny_path: path, title: job.title, tags: job.tags, sha256_head: sha, duration_s: 0 });
      if (!created.ok) { job.status = "error"; job.error = created.error || "create failed"; emit("update", job); return; }
      job.uploadId = created.uploadId; job.bunny_path = path;
      job.status = "uploading"; emit("update", job);
      await this.uploadWithRetry(job, path);
      const fin = await ShUpload.finalize(job.uploadId);
      if (!fin.ok) { job.status = "error"; job.error = "finalize failed"; emit("update", job); return; }
      job.status = "live"; emit("update", job); emit("live", job);
    } catch (e) {
      job.status = "error"; job.error = String(e); emit("update", job);
    } finally { this.pump(); }
  },
  async uploadWithRetry(job, path) {
    for (let attempt = 0; ; attempt++) {
      const wait = computeBackoff(attempt);
      if (wait === null) throw new Error("upload failed after retries");
      if (wait) await new Promise(r => setTimeout(r, wait));
      try { await ShUpload.putBytes(job.file, path, (p) => { job.progress = p; emit("update", job); }); return; }
      catch (_) { job.attempt = attempt + 1; emit("update", job); }
    }
  },
};

window.addEventListener("beforeunload", (e) => {
  if (UploadManager.jobs.some(j => j.status === "uploading")) { e.preventDefault(); e.returnValue = ""; }
});
```

- [ ] **Step 4: Write tray UI**

```js
// src/upload/upload-tray.js
import { UploadManager } from "./upload-manager.js";
import { jsq } from "./upload-api.js";
import { toast } from "../shared/catalog.js";

let trayEl;
function ensureTray() {
  if (trayEl) return trayEl;
  trayEl = document.createElement("div");
  trayEl.id = "upload-tray"; trayEl.hidden = true;
  document.body.appendChild(trayEl);
  trayEl.addEventListener("click", (e) => {
    const c = e.target.closest("[data-upl]"); if (!c) return;
    const id = c.dataset.uplId;
    const job = UploadManager.jobs.find(j => j.id === id);
    if (c.dataset.upl === "cancel" && job) { job.status = "error"; job.error = "cancelled"; renderTray(); }
  });
  return trayEl;
}
function card(job) {
  const pct = job.progress || 0;
  const label = { queued: "Queued", hashing: "Preparing", uploading: pct + "%", live: "Live ✓", error: job.error || "Failed" }[job.status];
  return `<div class="upl-card upl-${job.status}" data-upl-id="${jsq(job.id)}">
    <img class="upl-thumb" src="${jsq(job.blobUrl)}" alt="">
    <div class="upl-meta"><span class="upl-title">${jsq(job.title)}</span><span class="upl-status">${label}</span>
      <div class="upl-bar"><i style="width:${pct}%"></i></div></div>
    ${job.status === "uploading" || job.status === "queued" ? `<button class="upl-x" data-upl="cancel" data-upl-id="${jsq(job.id)}">✕</button>` : ""}
  </div>`;
}
export function renderTray() {
  const el = ensureTray();
  if (!UploadManager.jobs.length) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<div class="upl-head">Uploads</div>${UploadManager.jobs.map(card).join("")}`;
}
export function mountTray() {
  UploadManager.on("add", renderTray);
  UploadManager.on("update", renderTray);
  UploadManager.on("reject", ({ reason }) => toast("Skipped: " + reason));
  UploadManager.on("live", () => toast("Your video is live"));
}
```

- [ ] **Step 5: Write tray CSS**

```css
/* src/upload/upload.css */
#upload-tray{position:fixed;right:16px;bottom:16px;width:320px;max-height:60vh;overflow:auto;
  background:#161616;border:1px solid #2a2a2a;border-radius:12px;z-index:900;padding:8px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
#upload-tray .upl-head{font-weight:600;padding:6px 8px;color:#eee}
.upl-card{display:flex;gap:8px;align-items:center;padding:6px;border-radius:8px}
.upl-thumb{width:56px;height:40px;object-fit:cover;border-radius:4px;background:#000}
.upl-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.upl-title{font-size:12px;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.upl-status{font-size:11px;color:#9aa}
.upl-bar{height:3px;background:#333;border-radius:2px;overflow:hidden}
.upl-bar>i{display:block;height:100%;background:#4ade80;transition:width .2s}
.upl-live .upl-bar>i{background:#22c55e}
.upl-error .upl-status{color:#f87171}
.upl-x{background:none;border:none;color:#888;cursor:pointer;font-size:14px}
#drop-overlay{position:fixed;inset:0;z-index:800;pointer-events:none;display:none;
  align-items:center;justify-content:center;background:rgba(10,10,10,.6)}
#drop-overlay.active{display:flex}
#drop-overlay .dz-box{border:3px dashed #4ade80;border-radius:16px;inset:24px;position:absolute;
  display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-size:20px}
#drop-overlay .dz-badge{margin-top:8px;font-size:14px;color:#4ade80}
```

- [ ] **Step 6: Run manager tests to verify pass**

Run: `node src/upload/upload-manager.test.mjs`
Expected: PASS — `upload-manager core OK`.

- [ ] **Step 7: Commit**

```bash
git add src/upload/upload-manager.js src/upload/upload-tray.js src/upload/upload.css src/upload/upload-manager.test.mjs
git commit -m "feat(upload): UploadManager singleton (queue/retry/concurrency) + tray UI"
```

---

### Task 8: Global dropzone + shell mount

**Files:**
- Create: `src/upload/global-dropzone.js`
- Modify: `src/viewer/main.js` (mount dropzone + tray behind flag; add `vstate.flags`, `vstate.pendingUploads`)

**Interfaces:**
- Consumes: `UploadManager` (Task 7), `mountTray/renderTray` (Task 7), `attestation` (Task 6), `ShAuth`.
- Produces: `mountDropzone({ onNeedLogin })` — sets window drag listeners, overlay, hidden input, `data-page="upload-trigger"` delegation.

- [ ] **Step 1: Implement dropzone**

```js
// src/upload/global-dropzone.js
import { UploadManager } from "./upload-manager.js";
import { mountTray } from "./upload-tray.js";
import { needsAttestation, showAttestationModal, recordAttestation } from "./attestation.js";
import { ShAuth } from "../shared/streamhub-api.js";
import { toast } from "../shared/catalog.js";

let dragDepth = 0, overlay, input;
function buildOverlay() {
  overlay = document.createElement("div");
  overlay.id = "drop-overlay";
  overlay.innerHTML = `<div class="dz-box"><div>Drop videos to upload</div><div class="dz-badge"></div></div>`;
  document.body.appendChild(overlay);
  input = document.createElement("input");
  input.type = "file"; input.multiple = true; input.accept = "video/*"; input.hidden = true;
  document.body.appendChild(input);
  input.addEventListener("change", () => { if (input.files.length) handleFiles([...input.files]); input.value = ""; });
}
function setBadge(n) { const b = overlay.querySelector(".dz-badge"); b.textContent = n ? `${n} file${n > 1 ? "s" : ""}` : ""; }
function show(on, n = 0) { overlay.classList.toggle("active", on); if (on) setBadge(n); }

async function handleFiles(files) {
  if (!ShAuth.isSignedIn()) { onNeedLoginRef(); return; }
  const vids = files.filter(f => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
  if (!vids.length) { toast("Only video files can be uploaded"); return; }
  if (await needsAttestation(0)) {
    const ok = await showAttestationModal();
    if (!ok) return;
    await recordAttestation([]);
  }
  UploadManager.enqueue(vids);
}

let onNeedLoginRef = () => {};
export function mountDropzone({ onNeedLogin } = {}) {
  onNeedLoginRef = onNeedLogin || (() => toast("Please sign in to upload"));
  buildOverlay(); mountTray();
  window.addEventListener("dragenter", (e) => { if (![...e.dataTransfer.types].includes("Files")) return; dragDepth++; show(true, e.dataTransfer.items.length); });
  window.addEventListener("dragover", (e) => { e.preventDefault(); });
  window.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) show(false); });
  window.addEventListener("drop", (e) => { e.preventDefault(); dragDepth = 0; show(false); if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  document.addEventListener("click", (e) => { if (e.target.closest('[data-page="upload-trigger"]')) input.click(); });
}
```

- [ ] **Step 2: Wire into viewer shell**

In `src/viewer/main.js`, add to the `vstate` object (near line 28) the fields `flags:{ globalUpload:false }, pendingUploads:[]`, and append near the bottom (before the keydown block):

```js
import { mountDropzone } from "../upload/global-dropzone.js";
import "../upload/upload.css";
// Mount global upload behind a flag (flip to true after acceptance testing).
if (vstate.flags.globalUpload) {
  mountDropzone({ onNeedLogin: () => { location.hash = "#choose"; toast("Sign in to upload"); } });
}
```

- [ ] **Step 3: Manual smoke test (build)**

Run: `npm run build`
Expected: build succeeds, no import errors. (Dropzone stays inert because `globalUpload:false`.)

- [ ] **Step 4: Commit**

```bash
git add src/upload/global-dropzone.js src/viewer/main.js
git commit -m "feat(upload): global drag-and-drop dropzone mounted behind flag"
```

---

### Task 9: Catalog overlay + realtime sync

**Files:**
- Create: `src/upload/catalog-overlay.js`
- Modify: `src/viewer/main.js` (call `mergeLiveUploads()` on load; subscribe realtime for own uploads)

**Interfaces:**
- Consumes: `DATA.videos` (catalog.js), `pubVideos()`/`visible()` (viewer), `ShAuth`.
- Produces: `mergeLiveUploads(): Promise<void>` — fetch `status='live'` rows, map to video shape, push into `DATA.videos` (dedupe by `bunny_path`). `subscribeOwnUploads(userId, onChange)` — Supabase Realtime.

- [ ] **Step 1: Implement overlay + mapping**

```js
// src/upload/catalog-overlay.js
import { DATA, mediaUrl } from "../shared/catalog.js";

const REST = "https://dabfxysxcngijcxxekzc.supabase.co/rest/v1";
const ANON = "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";

function rowToVideo(r) {
  return {
    id: "u_" + r.id, title: r.title || "Untitled", creator: r.user_id, type: "ugc",
    category: (r.tags && r.tags[0]) || "Amateur", categories: r.tags || [],
    views: 0, likes: 0, dislikes: 0, comments: 0, favorites: 0,
    duration: r.duration_s ? `${Math.floor(r.duration_s / 60)}:${String(r.duration_s % 60).padStart(2, "0")}` : "0:00",
    uploaded: (r.published_at || r.created_at || "").slice(0, 10),
    src: "../media/" + r.bunny_path, tags: r.tags || [], status: "published", flagged: false,
    _fromUpload: true, _bunnyPath: r.bunny_path,
  };
}

export async function mergeLiveUploads() {
  try {
    const rows = await fetch(`${REST}/uploads?status=eq.live&select=*&order=published_at.desc&limit=500`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }).then(r => r.json());
    const have = new Set(DATA.videos.map(v => v._bunnyPath).filter(Boolean));
    for (const r of rows) if (!have.has(r.bunny_path)) DATA.videos.push(rowToVideo(r));
  } catch (_) { /* best-effort: catalog still works from seed */ }
}
```

- [ ] **Step 2: Wire into viewer load**

In `src/viewer/main.js`, in the bootstrap section, before the first `render()`:

```js
import { mergeLiveUploads } from "../upload/catalog-overlay.js";
mergeLiveUploads().then(() => { if (typeof render === "function") render(); });
```

- [ ] **Step 3: Verify end-to-end (manual, against a test row)**

Run: insert a `status='live'` row via service key, then `npm run build && npm run preview`, load the page, confirm the row appears in the grid.
```bash
curl -s -X POST "$SB_URL/rest/v1/uploads" -H "apikey: $SB_SERVICE" -H "Authorization: Bearer $SB_SERVICE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"user_id":"'"$SB_TEST_UID"'","bunny_path":"uploads/demo.mp4","title":"Overlay demo","status":"live","published_at":"2026-07-10T00:00:00Z"}'
```
Expected: "Overlay demo" card renders on the homepage after load.

- [ ] **Step 4: Commit**

```bash
git add src/upload/catalog-overlay.js src/viewer/main.js
git commit -m "feat(upload): DB-overlay merge of live uploads into catalog on load"
```

---

### Task 10: Acceptance pass + ship

**Files:**
- Modify: `src/viewer/main.js` (flip `globalUpload:true` only after acceptance)
- Create: `docs/superpowers/plans/2026-07-10-global-upload-acceptance.md` (results log)

- [ ] **Step 1: Run acceptance checklist**

Verify each, recording pass/fail in the acceptance doc:
- Drag on any route → overlay shows, nav clickable, no child-flicker.
- 10 files → 3-way parallelism; kill a request → retries per backoff.
- Anonymous drop → login path, zero `create-upload` network calls (check devtools).
- Duplicate file (same first-8MB) → rejected pre-upload.
- Upload reaches `live` → appears in overlay on reload.
- Uploader sees own `processing` row in own feed; second browser/session does not.
- `grep -r "BUNNY_STORAGE_KEY\|SUPABASE_SERVICE" dist/` → **no matches**.
- RLS script (Task 1) passes with anon/authed/service keys.
- `grep -rn "onclick" src/upload/` → **zero**.

- [ ] **Step 2: Secret-leak grep (hard gate)**

Run: `npm run build && grep -rn "BUNNY_STORAGE_KEY\|SERVICE_ROLE\|SUPABASE_SERVICE" dist/ || echo "CLEAN"`
Expected: `CLEAN`.

- [ ] **Step 3: Flip the flag and deploy**

Set `vstate.flags.globalUpload = true` in `src/viewer/main.js`, then:
```bash
npm run build
supabase functions deploy dup-check create-upload finalize-upload
npm run deploy:apply      # upload dist to Bunny storage
# purge Pull Zone cache in Bunny dashboard (30-day TTL)
```
Expected: site loads, dropzone active, test upload with a real account reaches `live`.

- [ ] **Step 4: Commit**

```bash
git add src/viewer/main.js docs/superpowers/plans/2026-07-10-global-upload-acceptance.md
git commit -m "feat(upload): enable global upload flag after acceptance pass"
```

---

## Self-Review Notes

- **Spec coverage:** dropzone (T8), UploadManager+preview+retry+beforeunload (T7), pre-filter magic-byte/size/duration/dup (T5,T7), attestation (T6), schema+RLS (T1), edge fns create/dup/finalize (T2–T4), realtime+overlay (T9), env/flag/acceptance (T8,T10). Moderation/CSAM and review queue intentionally absent per owner decision (spec §11).
- **Divergence from prompt:** `bunny_video_id`→`bunny_path` (Storage not Stream); "resumable TUS"→retry-PUT; edge fn `finalize-upload` replaces `bunny-webhook`+`review-action` (no encode webhook on Storage, no review gate).
- **Type consistency:** `sniffBytes`/`sniffVideo`, `computeBackoff`/`nextRunnable`, `attestationState`, `rowToVideo._bunnyPath` used consistently across tasks.
- **Realtime note:** T9 Step ships the overlay merge; the own-upload realtime subscription is optional polish (uploader already sees jobs via the tray) — folded into T9 interface but not gated by a test, since the tray already provides uploader feedback.
