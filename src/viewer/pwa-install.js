/**
 * Mobile PWA Install Experience
 * Handles Android / Chromium beforeinstallprompt and iOS Safari "Add to Home Screen" guidance.
 */

const DISMISS_DAYS = 7;
let deferredInstallPrompt = null;

function isStandalone() {
  return (
    (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" && navigator.standalone === true)
  );
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/i.test(ua);
  return isIos && isSafari && !isStandalone();
}

function isDismissed() {
  try {
    const saved = localStorage.getItem("pwa_install_dismissed");
    if (!saved) return false;
    const elapsedDays = (Date.now() - parseInt(saved, 10)) / (1000 * 60 * 60 * 24);
    return elapsedDays < DISMISS_DAYS;
  } catch (_) {
    return false;
  }
}

function dismissBanner(banner) {
  try {
    localStorage.setItem("pwa_install_dismissed", Date.now().toString());
  } catch (_) {}
  if (banner) {
    banner.classList.add("pwa-banner-hiding");
    setTimeout(() => banner.remove(), 300);
  }
}

export function initPwaInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Register service worker if supported
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  // If already installed as PWA or user dismissed recently, exit
  if (isStandalone() || isDismissed()) return;

  // 1. Android / Chromium native install prompt capture
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showAndroidInstallBanner();
  });

  // 2. iOS Safari instructions banner on mobile
  if (isIosSafari() && window.innerWidth <= 768) {
    setTimeout(showIosInstallBanner, 3000); // polite delay after page load
  }
}

function showAndroidInstallBanner() {
  if (document.getElementById("pwaInstallBanner")) return;

  const banner = document.createElement("aside");
  banner.id = "pwaInstallBanner";
  banner.className = "pwa-install-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Install thebestpornai application");

  banner.innerHTML = `
    <div class="pwa-install-content">
      <img class="pwa-install-icon" src="/favicon-64.png" alt="" width="36" height="36" />
      <div class="pwa-install-text">
        <strong>Install thebestpornai</strong>
        <span>Faster streaming, 4K player &amp; zero browser bars.</span>
      </div>
    </div>
    <div class="pwa-install-actions">
      <button type="button" class="pwa-btn-install" id="pwaInstallAction">Install</button>
      <button type="button" class="pwa-btn-dismiss" id="pwaDismissAction" aria-label="Dismiss">✕</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById("pwaInstallAction")?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      banner.remove();
    } else {
      dismissBanner(banner);
    }
    deferredInstallPrompt = null;
  });

  document.getElementById("pwaDismissAction")?.addEventListener("click", () => {
    dismissBanner(banner);
  });
}

function showIosInstallBanner() {
  if (document.getElementById("pwaInstallBanner") || isDismissed()) return;

  const banner = document.createElement("aside");
  banner.id = "pwaInstallBanner";
  banner.className = "pwa-install-banner pwa-ios-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Add to Home Screen");

  banner.innerHTML = `
    <div class="pwa-install-content">
      <img class="pwa-install-icon" src="/favicon-64.png" alt="" width="36" height="36" />
      <div class="pwa-install-text">
        <strong>Install App on iPhone / iPad</strong>
        <span>Tap <svg class="pwa-inline-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share and select <strong>"Add to Home Screen"</strong></span>
      </div>
    </div>
    <div class="pwa-install-actions">
      <button type="button" class="pwa-btn-dismiss" id="pwaDismissAction" aria-label="Dismiss">✕</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById("pwaDismissAction")?.addEventListener("click", () => {
    dismissBanner(banner);
  });
}
