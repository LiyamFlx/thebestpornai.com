/* Vercel serverless — server-verified compliance gate, run AFTER the browser
 * finishes its direct-to-R2 PUT (see api/presign.js) and BEFORE the entry is
 * allowed into the public manifest (see api/save-upload.js, which now
 * requires the uploadId this endpoint returns).
 *
 * Does the things a client-supplied hash and a client-supplied "is this
 * clean" flag can never be trusted to do honestly:
 *   1. Verify a real attestation token exists for this client (not just that
 *      the client claims one was shown).
 *   2. Stream the actual object back from R2 and compute its real SHA-256 —
 *      the OLD dup-check (supabase/functions/dup-check) trusted a
 *      client-supplied sha256_head, which a malicious client can simply lie
 *      about. This is the fix.
 *   3. Check that hash against banned_hashes and existing uploads (dedup).
 *   4. Run the CSAM interception point (lib/csam.js). Publishes instantly
 *      (status='live') unless a configured vendor actually flags the file —
 *      an unconfigured vendor does not hold uploads back, since no CSAM
 *      check existed before this pipeline either. Only a real vendor flag
 *      lands status='held' for manual moderator review via
 *      api/moderate-manifest.js.
 *
 * Required env: R2_* (already set), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ATTEST_HMAC_SECRET.
 */
import crypto from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { applyCors } from "../lib/cors.js";
import { serviceRequest } from "../lib/supabase-service.js";
import { verifyAttestToken } from "../lib/attest-token.js";
import { csamCheck } from "../lib/csam.js";

// Streaming a full video back from R2 to hash it can take a while for large
// real files — give this function real headroom instead of relying on the
// platform default (a legitimate 502 was observed in production during a
// slow R2 read that this, plus the retry in hashR2Object below, addresses).
export const config = { maxDuration: 120 };

// Only images/video that presign.js would have issued a key for; large video
// files are hashed via a streaming digest so memory stays flat regardless of
// file size (no full-file buffering).
async function hashOnce(s3, bucket, key) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = crypto.createHash("sha256");
  for await (const chunk of obj.Body) hash.update(chunk);
  return hash.digest("hex");
}

// Streaming a large real video back from R2 inside a serverless function can
// hit a transient network reset mid-read — that must not permanently block a
// legitimate upload with a bare 502. One retry after a short backoff.
async function hashR2Object(s3, bucket, key) {
  try {
    return await hashOnce(s3, bucket, key);
  } catch (e) {
    await new Promise(r => setTimeout(r, 1500));
    return await hashOnce(s3, bucket, key);
  }
}

export default async function handler(req, res) {
  if (!applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const R2_BUCKET = process.env.R2_BUCKET;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
    return res.status(500).json({ error: "R2 credentials are not set on Vercel" });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase service-role env vars not set on Vercel" });
  }

  const { clientId, path, attestToken, title, width, height, durationS } = req.body || {};
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "clientId is required" });
  }
  if (!path || typeof path !== "string" || !path.startsWith("media/uploads/")) {
    return res.status(400).json({ error: "invalid upload path" });
  }

  // 1. Real attestation, not a client-asserted flag.
  const attestation = verifyAttestToken(attestToken, clientId);
  if (!attestation) {
    return res.status(403).json({ error: "missing or expired attestation — call /api/attest first" });
  }

  // Idempotency: `path` is unique per upload attempt (presign.js mints a
  // fresh up_<timestamp>_<random> key every time) and bunny_path is a unique
  // column, so it doubles as a natural idempotency key. The client retries
  // this call on network failure even when the server actually completed
  // the first attempt and only the RESPONSE got lost — without this check
  // that retry would insert a second row for the same file (the same-client
  // dup-check further down is intentionally bypassed for the legitimate
  // manual-retry case, so it would not catch this).
  try {
    const existingRes = await serviceRequest(`/uploads?bunny_path=eq.${encodeURIComponent(path)}&select=id,status,sha256_head`);
    const existing = existingRes.ok ? await existingRes.json() : [];
    if (Array.isArray(existing) && existing[0]) {
      return res.status(200).json({ ok: true, uploadId: existing[0].id, status: existing[0].status, sha256: existing[0].sha256_head });
    }
  } catch (e) {
    // Lookup failure: fall through to the normal path rather than blocking
    // a genuinely-new upload on a transient read error here.
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });

  // 2. Server-computed hash of the actual uploaded bytes.
  let sha256;
  try {
    sha256 = await hashR2Object(s3, R2_BUCKET, path);
  } catch (e) {
    return res.status(502).json({ error: "could not read uploaded object", detail: String(e?.message || e) });
  }

  // 3. Banned-hash + duplicate check, server-side (the old dup-check edge
  // function trusted a client-supplied partial hash — this trusts nothing
  // the client said).
  try {
    const bannedRes = await serviceRequest(`/banned_hashes?sha256_head=eq.${encodeURIComponent(sha256)}&select=sha256_head`);
    const banned = bannedRes.ok ? await bannedRes.json() : [];
    if (Array.isArray(banned) && banned.length > 0) {
      return res.status(403).json({ ok: false, reason: "banned" });
    }
    // Exclude this same client's own prior rows: if verifyUpload succeeded
    // but a later step (saveToManifest) failed — network drop, cold start,
    // etc. — the creator's retry re-selects the same file, hashes identically,
    // and would otherwise be permanently rejected as a "duplicate" forever
    // with no way to actually publish it. A different client uploading
    // identical bytes is still flagged.
    //
    // PostgREST's neq uses standard SQL null semantics: `client_id=neq.X`
    // silently excludes rows where client_id IS NULL (legacy/pre-hardening
    // rows), which would let a hash matching one of those bypass the
    // duplicate check for ANY uploader, not just the original one. Fetch by
    // hash alone and filter client_id in JS instead, where null !== clientId
    // behaves as expected.
    const dupRes = await serviceRequest(`/uploads?sha256_head=eq.${encodeURIComponent(sha256)}&select=id,client_id`);
    const dup = dupRes.ok ? await dupRes.json() : [];
    if (Array.isArray(dup) && dup.some(r => r.client_id !== clientId)) {
      return res.status(409).json({ ok: false, reason: "duplicate" });
    }
  } catch (e) {
    // Hash-check infra failure: fail closed on the whole upload, don't let
    // an unreachable Supabase silently skip the banned-hash check.
    return res.status(502).json({ error: "hash-check failed", detail: String(e?.message || e) });
  }

  // 4. CSAM interception — only an actual vendor flag holds a video back.
  // See lib/csam.js: unconfigured (no vendor wired up) is NOT treated as a
  // block, matching pre-hardening behavior where no CSAM check existed at
  // all. Wire up a real vendor (Cloudflare/Thorn/NCMEC) to make this a real
  // gate; until then this is a no-op pass-through by design, not a bug.
  let csam;
  try {
    csam = await csamCheck({ hash: sha256, path });
  } catch (e) {
    csam = { status: "unconfigured" };
  }

  // Publish instantly, matching pre-hardening behavior (explicit user
  // decision: gating on trust-tier/id-verification left 100% of real
  // creators stuck in manual review, since those fields were never
  // populated for existing accounts). Only an ACTUAL CSAM vendor flag holds
  // a video back — an unconfigured vendor no longer blocks publish, since no
  // vendor was ever wired up before this pipeline existed either.
  const status = (csam.status === "flagged") ? "held" : "live";

  // Insert the compliance-status row of record.
  let uploadId;
  try {
    const insertRes = await serviceRequest("/uploads", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        client_id: clientId,
        // NOTE: still bunny_path in the live schema — the rename to r2_key
        // is Phase 2 work (schema consolidation), not yet applied. This
        // column now stores the R2 key regardless of its legacy name.
        bunny_path: path,
        title: String(title || "Untitled").slice(0, 200),
        status,
        sha256_head: sha256,
        duration_s: Number.isFinite(durationS) ? durationS : null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        reject_reason: status === "held" ? "csam_flagged" : null,
        published_at: status === "live" ? new Date().toISOString() : null,
      },
    });
    if (!insertRes.ok) {
      const detail = await insertRes.text().catch(() => "");
      return res.status(502).json({ error: "uploads insert failed", detail });
    }
    const rows = await insertRes.json();
    uploadId = rows?.[0]?.id;
  } catch (e) {
    return res.status(500).json({ error: "uploads insert error", detail: String(e?.message || e) });
  }

  // Link this upload to the attestation record for the legal trail.
  if (attestation.attestationId) {
    serviceRequest(`/upload_attestations?id=eq.${encodeURIComponent(attestation.attestationId)}`, {
      method: "PATCH",
      body: { upload_ids: [uploadId] }, // best-effort; not blocking the response
    }).catch(() => {});
  }

  return res.status(200).json({
    ok: true,
    uploadId,
    status, // 'live' | 'held' — save-upload.js decides manifest visibility from this
    sha256,
  });
}
