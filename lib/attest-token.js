/* Signed, short-lived attestation token — proves a client_id completed the
 * consent/attestation step recently, without requiring a DB round-trip on
 * every subsequent upload in the same session. HMAC-SHA256 over a JSON
 * payload, using Node's built-in crypto (no new dependency).
 */
import crypto from "crypto";

const SECRET = process.env.ATTEST_HMAC_SECRET || "";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function sign(payloadB64) {
  return crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

export function issueAttestToken({ clientId, attestationId }) {
  if (!SECRET) throw new Error("ATTEST_HMAC_SECRET not set");
  const payload = { clientId, attestationId, exp: Date.now() + TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyAttestToken(token, expectedClientId) {
  if (!SECRET || !token || typeof token !== "string") return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expectedSig = sign(payloadB64);
  // Constant-time compare to avoid timing side-channels on the signature check.
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()); }
  catch (_) { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null;
  if (expectedClientId && payload.clientId !== expectedClientId) return null;
  return payload;
}
