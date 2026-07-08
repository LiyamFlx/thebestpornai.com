/* ============================================================
   AGE GATE — 18+ self-certification interstitial.
   Blocks the page behind a full-screen overlay until the visitor confirms
   they are 18+. Persists the confirmation in localStorage so it only shows
   once per browser. Call ageGate() as early as possible in each app's entry
   point, before any content-rendering code runs.
   ============================================================ */

import logoUrl from "./assets/logo.png";

const AGE_GATE_KEY = "sh_age_verified";

function isAgeVerified() {
  try {
    const v = localStorage.getItem(AGE_GATE_KEY) || sessionStorage.getItem(AGE_GATE_KEY);
    return v === "1" || v === "true";
  } catch (_) {
    return false;
  }
}

function markAgeVerified() {
  const val = JSON.stringify({ verified: true, at: Date.now() });
  try {
    localStorage.setItem(AGE_GATE_KEY, "1");
    sessionStorage.setItem(AGE_GATE_KEY, "1");
  } catch (_) {}
}

function ageGate(){
  if (isAgeVerified()) return;

  const overlay = document.createElement("div");
  overlay.id = "age-gate-overlay";
  overlay.innerHTML = `
    <style>
      #age-gate-overlay{position:fixed;inset:0;z-index:99999;background:#0A0A0A;
        display:flex;align-items:center;justify-content:center;padding:24px;
        font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;}
      #age-gate-overlay .ag-card{max-width:420px;width:100%;text-align:center;}
      #age-gate-overlay .ag-logo{height:40px;margin-bottom:22px;}
      #age-gate-overlay h1{color:#FFF;font-size:22px;margin:0 0 12px;}
      #age-gate-overlay p{color:#A0A0A0;font-size:14px;line-height:1.5;margin:0 0 26px;}
      #age-gate-overlay .ag-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
      #age-gate-overlay button{border:none;border-radius:8px;padding:12px 28px;
        font-size:14px;font-weight:700;cursor:pointer;}
      #age-gate-overlay .ag-enter{background:#E50914;color:#FFF;}
      #age-gate-overlay .ag-exit{background:transparent;color:#A0A0A0;border:1px solid rgba(255,255,255,.2)!important;}
      #age-gate-overlay .ag-fine{color:#666;font-size:11px;margin-top:22px;}
      #age-gate-overlay .ag-fine a{color:#888;}
    </style>
    <div class="ag-card">
      <img class="ag-logo" src="${logoUrl}" alt="thebestpornai"/>
      <h1>You must be 18 or older to enter</h1>
      <p>This website contains age-restricted material intended for adults only.
         By entering, you confirm that you are at least 18 years old (or the age
         of majority in your jurisdiction) and consent to viewing adult content.</p>
      <div class="ag-btns">
        <button class="ag-enter" id="ag-enter">I am 18+ — Enter</button>
        <button class="ag-exit" id="ag-exit">Exit</button>
      </div>
      <div class="ag-fine">By entering you agree to our
        <a href="/legal/terms.html">Terms</a> and
        <a href="/legal/privacy.html">Privacy Policy</a>.</div>
    </div>`;

  document.documentElement.style.overflow = "hidden";
  document.body.appendChild(overlay);

  const enterBtn = overlay.querySelector("#ag-enter");
  const exitBtn = overlay.querySelector("#ag-exit");

  function confirmAge() {
    markAgeVerified();
    document.documentElement.style.overflow = "";
    overlay.remove();
  }

  enterBtn.addEventListener("click", confirmAge);

  exitBtn.addEventListener("click", () => {
    window.location.href = "https://www.google.com";
  });

  // Keyboard support (Enter = confirm, Escape = exit)
  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmAge();
      document.removeEventListener("keydown", onKey);
    } else if (e.key === "Escape") {
      window.location.href = "https://www.google.com";
    }
  };
  document.addEventListener("keydown", onKey, { once: true });

  // Focus the primary action for accessibility
  setTimeout(() => enterBtn.focus(), 50);
}

export { ageGate };
