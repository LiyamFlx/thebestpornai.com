import { toast, DATA } from "../shared/catalog.js";
import { ShAuth } from "../shared/streamhub-api.js";
import { ageGate } from "../shared/age-gate.js";
import { mergeLiveUploads } from "../upload/catalog-overlay.js";

import { vstate, onWatch } from "./state.js";
import { applyHash, initRouter } from "./router.js";
import { render } from "./render.js";
import {
  go,
  focusSearch,
  openVideo,
  openMovie,
  openCreator,
  setHomeFilter,
  setHomeCategory,
  setHomeSort,
  searchTag,
  loadMore,
  toggleFav,
  toggleLater,
  download,
  likeVideo,
  dislikeVideo,
  subscribe,
  addComment,
  setCommentSort,
  loadMoreComments,
  shareVideo,
  reportVideo,
  doSearch,
  stepWatch,
} from "./actions.js";
import { refreshManifest, syncManifestOnLoad } from "./manifest-sync.js";

// Keep the session alive on load (refresh the token if near expiry)
if (typeof ShAuth !== "undefined") ShAuth.ensureFresh();
ageGate();

// Parse initial URL route on load
applyHash();

// Initialize router change listener
initRouter(render);

// Initial bootstrap render
render();


// Fetch live database catalog updates and remote manifest uploads
syncManifestOnLoad().then(() => {
  mergeLiveUploads().then(() => {
    render();
  });
});

// Window bridge for inline onclick handlers and legacy integrations
Object.assign(window, {
  go,
  focusSearch,
  openVideo,
  toggleFav,
  toggleLater,
  download,
  likeVideo,
  dislikeVideo,
  subscribe,
  addComment,
  shareVideo,
  reportVideo,
  doSearch,
  render,
  toast,
  setHomeFilter,
  setHomeCategory,
  setHomeSort,
  searchTag,
  openMovie,
  openCreator,
  setCommentSort,
  loadMore,
  loadMoreComments,
  refreshManifest,
  stepWatch,
});

// Keyboard navigation (Watch page Arrow keys cycling public videos)
document.addEventListener("keydown", (e) => {
  if (
    document.activeElement &&
    (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
  ) {
    return;
  }
  if (vstate.page !== "watch") return;

  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    stepWatch(e.key === "ArrowRight" ? 1 : -1);
  }
});

// Register /sw.js — currently a KILL SWITCH that unregisters any old service
// worker and wipes its caches (the old SW was serving stale content). Once
// browsers have run it, the site is served fresh from the network every time.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}