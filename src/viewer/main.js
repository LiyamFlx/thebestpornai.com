import { toast, DATA } from "../shared/catalog.js";
import { ShAuth } from "../shared/streamhub-api.js";
import { ageGate } from "../shared/age-gate.js";
import { mountDropzone } from "../upload/global-dropzone.js";
import { mergeLiveUploads } from "../upload/catalog-overlay.js";
import "../upload/upload.css";

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
  setHomeSort,
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
  doSearch,
} from "./actions.js";
import { refreshManifest, syncManifestOnLoad } from "./manifest-sync.js";
import { promptUploadSignIn } from "./upload-signin.js";
import { pubVideos } from "./catalog-queries.js";

// Keep the session alive on load (refresh the token if near expiry)
if (typeof ShAuth !== "undefined") ShAuth.ensureFresh();
ageGate();

// Parse initial URL route on load
applyHash();

// Initialize router change listener
initRouter(render);

// Initial bootstrap render
render();

// Mount global drag-and-drop upload if enabled
if (vstate.flags.globalUpload) {
  mountDropzone({ onNeedLogin: promptUploadSignIn });
}

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
  doSearch,
  render,
  toast,
  setHomeFilter,
  setHomeSort,
  openMovie,
  openCreator,
  setCommentSort,
  loadMore,
  loadMoreComments,
  refreshManifest,
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
    const list = pubVideos();
    if (!list.length) return;
    const currentIdx = list.findIndex((v) => v.id === vstate.current?.id);
    if (currentIdx === -1) return;
    const step = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (currentIdx + step + list.length) % list.length;
    openVideo(list[nextIdx].id);
  }
});