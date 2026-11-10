/* ============================================================
   AGE GATE — 18+ self-certification interstitial.
   Blocks the page behind a full-screen overlay until the visitor confirms
   they are 18+. Persists the confirmation in localStorage so it only shows
   once per browser. Call ageGate() as early as possible in each app's entry
   point, before any content-rendering code runs.
   ============================================================ */

import logoUrl from "./assets/logo.webp";

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
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "ag-title");
  overlay.innerHTML = `
    <style>
      #age-gate-overlay{position:fixed;inset:0;z-index:99999;background:rgba(5,5,8,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
        display:flex;align-items:center;justify-content:center;padding:24px;
        font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
      #age-gate-overlay .ag-card{max-width:440px;width:100%;text-align:center;
        background:#121318;border:1px solid rgba(255,255,255,.12);border-radius:20px;
        padding:36px 28px;box-shadow:0 24px 64px rgba(0,0,0,.75);}
      #age-gate-overlay .ag-logo{height:36px;width:auto;margin:0 auto 22px;display:block;}
      #age-gate-overlay h1{color:#FFF;font-size:22px;font-weight:800;letter-spacing:-.3px;margin:0 0 12px;line-height:1.25;}
      #age-gate-overlay p{color:rgba(255,255,255,.7);font-size:13.5px;line-height:1.55;margin:0 0 26px;}
      #age-gate-overlay .ag-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
      #age-gate-overlay button{border:none;border-radius:10px;padding:12px 28px;
        font-size:14px;font-weight:700;cursor:pointer;transition:transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;}
      #age-gate-overlay .ag-enter{background:linear-gradient(135deg,#E50914,#b80710);color:#FFF;
        box-shadow:0 4px 20px rgba(229,9,20,.4);}
      #age-gate-overlay .ag-enter:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(229,9,20,.6);}
      #age-gate-overlay .ag-enter:active{transform:scale(.98);}
      #age-gate-overlay .ag-exit{background:rgba(255,255,255,.05);color:rgba(255,255,255,.75);
        border:1px solid rgba(255,255,255,.18)!important;}
      #age-gate-overlay .ag-exit:hover{background:rgba(255,255,255,.1);color:#FFF;border-color:rgba(255,255,255,.35)!important;transform:translateY(-1px);}
      #age-gate-overlay .ag-exit:active{transform:scale(.98);}
      #age-gate-overlay .ag-fine{color:rgba(255,255,255,.45);font-size:11px;margin-top:22px;line-height:1.5;}
      #age-gate-overlay .ag-fine a{color:rgba(255,255,255,.8);text-decoration:underline;text-underline-offset:2px;}
      #age-gate-overlay .ag-fine a:hover{color:#FFF;}
    </style>
    <div class="ag-card">
      <img class="ag-logo" src="${logoUrl}" alt="thebestpornai" width="160" height="40"/>
      <h1 id="ag-title">You must be 18 or older to enter</h1>
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

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmAge();
    } else if (e.key === "Escape") {
      e.preventDefault();
      exitSite();
    }
  };

  function cleanup() {
    document.removeEventListener("keydown", onKey);
    document.documentElement.style.overflow = "";
    overlay.remove();
  }

  function confirmAge() {
    markAgeVerified();
    cleanup();
  }

  function exitSite() {
    cleanup();
    window.location.href = "https://www.google.com";
  }

  enterBtn.addEventListener("click", confirmAge);
  exitBtn.addEventListener("click", exitSite);
  document.addEventListener("keydown", onKey);

  // Focus the primary action for accessibility
  setTimeout(() => enterBtn.focus(), 50);
}

export { ageGate };
