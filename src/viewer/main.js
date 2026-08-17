import { toast, DATA, loadFullCatalog } from "../shared/catalog.js";
import { ShAuth } from "../shared/streamhub-api.js";
import { ageGate } from "../shared/age-gate.js";
import { mergeLiveUploads } from "../upload/catalog-overlay.js";

import { vstate } from "./state.js";
import { applyHash, initRouter, promoteVideoQuery, markCatalogReady } from "./router.js";
import { render } from "./render.js";
import {
  go,
  goSearch,
  focusSearch,
  openVideo,
  closeWatch,
  openMovie,
  openCreator,
  setHomeFilter,
  setHomeCategory,
  setHomeSort,
  setSearchSort,
  setHomeExpandCats,
  setLibraryTab,
  searchTag,
  clearSearch,
  loadMore,
  toggleFav,
  toggleLater,
  download,
  likeVideo,
  dislikeVideo,
  subscribe,
  addComment,
  likeComment,
  setCommentSort,
  loadMoreComments,
  shareVideo,
  reportVideo,
  doSearch,
  stepWatch,
  toggleAutoplaySetting,
  signOutUser,
} from "./actions.js";
import { refreshManifest, syncManifestOnLoad } from "./manifest-sync.js";
import { initMobileChrome } from "./mobile-chrome.js";
import { toggleCatMenu } from "./pages/home.js";
import {
  switchWatchTab,
  filterUpNext,
  openShareSheet,
  openSettingsSheet,
  openSaveSheet,
  closeSheet,
  changeSpeedV2,
  copyVideoLinkV2,
  copyEmbedCodeV2,
  downloadWithFeedback,
  toggleDescSheetMobile,
  toggleDescExpandDesktop,
} from "./player-controls-v2.js";

// Keep the session alive on load (refresh the token if near expiry)
if (typeof ShAuth !== "undefined") ShAuth.ensureFresh();
ageGate();

// Parse initial URL route on load (?video=N from blog CTAs → #video/N first)
promoteVideoQuery();
applyHash();

// Initialize router change listener
initRouter(render);

// Initial bootstrap render
render();

// Mobile chrome: header collapse-on-scroll, tap-to-expand search, sort dropdown,
// and the watch-page action overflow menu (all no-ops above the mobile breakpoint).
initMobileChrome();


// Swap the inline seed for the full catalog as soon as its code-split chunk
// lands (off the critical path), then re-render so every video is available.
const fullCatalogLoaded = loadFullCatalog().then(() => {
  applyHash();
  render();
});

// Fetch live database catalog updates and remote manifest uploads
const manifestSynced = syncManifestOnLoad().then(() => {
  return mergeLiveUploads().then(() => {
    render();
  });
});

// A #video/N id might live in the static catalog, the remote manifest, or a
// live upload — three independent async sources. Only give up on resolving
// an initial deep link (see the !_catalogReady branch in router.js) once ALL
// of them have settled, otherwise a manifest-only video looks "not found"
// before the manifest has even finished loading.
Promise.allSettled([fullCatalogLoaded, manifestSynced]).then(() => {
  markCatalogReady();
  applyHash();
});

// Window bridge for inline onclick handlers and legacy integrations
Object.assign(window, {
  go,
  goSearch,
  focusSearch,
  openVideo,
  closeWatch,
  toggleFav,
  toggleLater,
  download,
  likeVideo,
  dislikeVideo,
  subscribe,
  addComment,
  likeComment,
  shareVideo,
  reportVideo,
  doSearch,
  render,
  toast,
  setHomeFilter,
  setHomeCategory,
  toggleCatMenu,
  setHomeSort,
  setSearchSort,
  setHomeExpandCats,
  setLibraryTab,
  searchTag,
  clearSearch,
  openMovie,
  openCreator,
  setCommentSort,
  loadMore,
  loadMoreComments,
  refreshManifest,
  stepWatch,
  toggleAutoplaySetting,
  signOutUser,
  switchWatchTab,
  filterUpNext,
  openShareSheet,
  openSettingsSheet,
  openSaveSheet,
  closeSheet,
  changeSpeedV2,
  copyVideoLinkV2,
  copyEmbedCodeV2,
  downloadWithFeedback,
  toggleDescSheetMobile,
  toggleDescExpand: toggleDescExpandDesktop,
  toggleDescExpandDesktop,
  cancelUpNextAdvance: () => window.cancelUpNextAdvance?.(),
  playUpNextNow: (id) => window.playUpNextNow?.(id),
});

// Keyboard navigation (Watch page): Left/Right cycle public videos,
// Up/Down step volume, M mutes, F toggles fullscreen, Esc closes an open
// sheet or exits fullscreen.
document.addEventListener("keydown", (e) => {
  if (
    document.activeElement &&
    (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
  ) {
    return;
  }

  // Esc needs to work even off the watch page (e.g. closing a sheet left
  // open), everything else below is watch-page-only.
  if (e.key === "Escape") {
    const openSheet = document.querySelector(".sheet-backdrop:not([hidden])");
    if (openSheet) { window.closeSheet(openSheet.id); return; }
    // Exit fullscreen first (if active), then close the player back to
    // wherever the user was browsing — don't rely on the browser's native
    // post-fullscreen scroll restore, it's inconsistent.
    if (document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
    if (vstate.page === "watch") closeWatch();
    return;
  }

  if (vstate.page !== "watch") return;

  const key = e.key;
  const keyLower = key.toLowerCase();

  // Play / Pause: Space or K
  if (key === " " || e.code === "Space" || keyLower === "k") {
    e.preventDefault();
    window.togglePlayPauseV2?.();
    return;
  }

  // Seek: Left/Right arrows (5s) or J/L (10s)
  if (key === "ArrowLeft") {
    e.preventDefault();
    if (e.shiftKey) stepWatch(-1);
    else window.skipTime?.(-5);
    return;
  }
  if (key === "ArrowRight") {
    e.preventDefault();
    if (e.shiftKey) stepWatch(1);
    else window.skipTime?.(5);
    return;
  }
  if (keyLower === "j") {
    e.preventDefault();
    window.skipTime?.(-10);
    return;
  }
  if (keyLower === "l") {
    e.preventDefault();
    window.skipTime?.(10);
    return;
  }

  // Next / Prev video: N / P
  if (keyLower === "n") {
    e.preventDefault();
    stepWatch(1);
    return;
  }
  if (keyLower === "p") {
    e.preventDefault();
    stepWatch(-1);
    return;
  }

  // Percentage seek: numbers 0-9
  if (/^[0-9]$/.test(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    window.seekToPercent?.(Number(key) * 10);
    return;
  }

  // Playback speed: < (,) or > (.)
  if (key === "<" || key === ",") {
    e.preventDefault();
    window.stepSpeed?.(-1);
    return;
  }
  if (key === ">" || key === ".") {
    e.preventDefault();
    window.stepSpeed?.(1);
    return;
  }

  // Volume: Up/Down arrows
  if (key === "ArrowUp" || key === "ArrowDown") {
    e.preventDefault();
    window.adjustVolumeV2?.(key === "ArrowUp" ? 0.05 : -0.05);
    return;
  }

  // Mute: M
  if (keyLower === "m") {
    e.preventDefault();
    window.toggleMuteV2?.();
    return;
  }

  // Fullscreen: F
  if (keyLower === "f") {
    e.preventDefault();
    window.toggleFullscreenV2?.();
    return;
  }

  // Theater Mode: T
  if (keyLower === "t") {
    e.preventDefault();
    window.toggleTheaterMode?.();
    return;
  }

  // Picture in Picture: I
  if (keyLower === "i") {
    e.preventDefault();
    window.togglePiP?.();
    return;
  }
});

// The Vertical Feed is a scroll-snap container, so the browser's default
// ArrowUp/ArrowDown behavior (scroll the focused/hovered scrollable element
// by a line) silently advances it one slide — arrow keys were never meant to
// control this feed, only swipe/wheel/touch. Block just those two keys here.
document.addEventListener("keydown", (e) => {
  if (vstate.page !== "feed") return;
  if (
    document.activeElement &&
    (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
  ) {
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
  }
});

// The watch page renders two genuinely different layouts (mobile tabs vs.
// desktop full stack — see pages/watch.js), decided once per render() call
// via a matchMedia check.
if (window.matchMedia) {
  const watchBreakpoint = window.matchMedia("(max-width:760px)");
  const onWatchBreakpointChange = () => { if (vstate.page === "watch") render(); };
  if (watchBreakpoint.addEventListener) watchBreakpoint.addEventListener("change", onWatchBreakpointChange);
  else if (watchBreakpoint.addListener) watchBreakpoint.addListener(onWatchBreakpointChange);
}

// Close category and sort dropdown popovers when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".cat-more")) {
    document.querySelectorAll(".cat-more.open").forEach(el => el.classList.remove("open"));
  }
  if (!e.target.closest(".sort-control-wrap")) {
    document.querySelectorAll(".sort-control-wrap.open").forEach(el => el.classList.remove("open"));
  }
});

// Delegated navigation and action listeners for data-nav, data-lib-tab, data-action
let searchDebounceTimer = null;
document.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) {
    const p = navEl.getAttribute("data-nav");
    if (p) {
      e.preventDefault();
      go(p);
    }
    return;
  }
  const tabEl = e.target.closest("[data-lib-tab]");
  if (tabEl) {
    const t = tabEl.getAttribute("data-lib-tab");
    if (t) setLibraryTab(t);
    return;
  }
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const act = actionEl.getAttribute("data-action");
  if (act === "search-go") {
    clearTimeout(searchDebounceTimer);
    doSearch();
  } else if (act === "search-nav") {
    goSearch();
  } else if (act === "back") {
    if (history.length > 1) history.back();
    else go("home");
  } else if (act === "upload") {
    window.location.href = "/creator/index.html?page=upload";
  }
});

document.addEventListener("input", (e) => {
  if (e.target && e.target.matches && e.target.matches('[data-action="search-input"]')) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      doSearch();
    }, 250);
  }
});

import { initPwaInstall } from "./pwa-install.js";
initPwaInstall();