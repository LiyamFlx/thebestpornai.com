// src/upload/attestation.js
// 2257 attestation gate. Blocking modal on first enqueue per session.
import { ShAuth } from "../shared/streamhub-api.js";

const REST = "https://dabfxysxcngijcxxekzc.supabase.co/rest/v1";
const ANON = "sb_publishable_moBiV9AidT0XkL-L6wilYw_Jfn25YDr";

/* pure decision fn (testable): returns 'ok' | 'once' | 'per-upload' */
export function attestationState(sessionAttested, tier) {
  if (tier <= 0) return "per-upload";
  return sessionAttested ? "ok" : "once";
}

export async function recordAttestation(uploadIds = []) {
  const s = ShAuth.session();
  if (!s) throw new Error("sign in required");
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
        appear with consent, and that records required under 18 U.S.C. &sect;2257 are held.</p>
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
      const a = e.target.closest("[data-attest]");
      if (!a) return;
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
