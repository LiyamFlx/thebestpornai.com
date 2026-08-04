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
} from "./actions.js";
import { refreshManifest, syncManifestOnLoad } from "./manifest-sync.js";
import { initMobileChrome } from "./mobile-chrome.js";
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
// Re-run applyHash() first: an initial #video/N outside the seed was
// deliberately left unresolved by router.js until now (see markCatalogReady).
loadFullCatalog().then(() => {
  markCatalogReady();
  applyHash();
  render();
});

// Fetch live database catalog updates and remote manifest uploads
syncManifestOnLoad().then(() => {
  mergeLiveUploads().then(() => {
    render();
  });
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
  setHomeSort,
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

  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    window.togglePlayPauseV2?.();
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    stepWatch(e.key === "ArrowRight" ? 1 : -1);
  } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    window.adjustVolumeV2?.(e.key === "ArrowUp" ? 0.05 : -0.05);
  } else if (e.key.toLowerCase() === "m") {
    window.toggleMuteV2?.();
  } else if (e.key.toLowerCase() === "f") {
    window.toggleFullscreenV2?.();
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
// via a matchMedia check. Without this listener, dragging a desktop window
// narrow (or rotating a tablet) across the 760px breakpoint would leave the
// wrong layout on screen until the user navigated away and back.
if (window.matchMedia) {
  const watchBreakpoint = window.matchMedia("(max-width:760px)");
  const onWatchBreakpointChange = () => { if (vstate.page === "watch") render(); };
  if (watchBreakpoint.addEventListener) watchBreakpoint.addEventListener("change", onWatchBreakpointChange);
  else if (watchBreakpoint.addListener) watchBreakpoint.addListener(onWatchBreakpointChange); // Safari < 14
}

// Register /sw.js — currently a KILL SWITCH that unregisters any old service
// worker and wipes its caches (the old SW was serving stale content). Once
// browsers have run it, the site is served fresh from the network every time.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}