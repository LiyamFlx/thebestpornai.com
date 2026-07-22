import { DATA, esc, creatorName, fmt, mediaUrl } from "../../shared/catalog.js";
import { pubVerticalVideos } from "../catalog-queries.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { renderCommentList } from "../comments.js";
import { likeVideo } from "../actions.js";

// Global pointer to track the current active observer and feed players
let feedObserver = null;
let currentActiveVideo = null;

// Data-saver users on a metered connection: skip video autoplay in the feed
// and show the poster only, so scrolling never silently burns their data cap.
function isDataSaverMode(){
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return !!c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

export function renderFeed() {
  const videos = pubVerticalVideos();
  if (!videos.length) {
    return `<div class="empty">
      <div class="empty-emoji">📱</div>
      <div class="empty-msg">No vertical videos published yet.</div>
    </div>`;
  }

  // Generate scroll-snap viewport container
  const itemsHtml = videos.map((v, index) => {
    const c = DATA.creators.find(x => x.id === v.creator) || { name: "Unknown", id: "", verified: false };
    const live = vstate.live[v.id] || { like: 0, dislike: 0 };
    const isLiked = vstate.favorites.includes(v.id);

    return `
      <div class="feed-item" data-index="${index}" data-video-id="${v.id}">
        <!-- Video element (src is loaded dynamically by the observer for memory management) -->
        <video class="feed-video" loop playsinline muted data-src="${mediaUrl(v.src)}" poster="${mediaUrl(v.thumb)}"></video>
        
        <!-- Video Details Overlay (Bottom) -->
        <div class="feed-overlay">
          <div class="feed-creator-row">
            <span class="feed-creator" onclick="openCreator('${jsq(c.id)}')">@${esc(c.name)}</span>
            ${c.verified ? '<span class="verified-badge">✓</span>' : ''}
          </div>
          <div class="feed-title">${esc(v.title)}</div>
          ${v.category ? `<div class="feed-category"><span class="vtag-cat">${esc(v.category)}</span></div>` : ''}
        </div>

        <!-- Engagement Action Sidebar (Right) -->
        <div class="feed-sidebar">
          <!-- Creator Avatar -->
          <div class="feed-avatar" onclick="openCreator('${jsq(c.id)}')">${esc((c.name || "?")[0])}</div>

          <!-- Like Button -->
          <div class="feed-action">
            <button class="feed-btn ${isLiked ? 'liked' : ''}" onclick="likeVideo(${v.id})" aria-label="Like video">❤️</button>
            <span class="feed-label" id="feedLike_${v.id}">${fmt(v.likes + live.like)}</span>
          </div>

          <!-- Comments Button -->
          <div class="feed-action">
            <button class="feed-btn" onclick="openFeedComments(${v.id})" aria-label="View comments">💬</button>
            <span class="feed-label" id="feedComment_${v.id}">${DATA.comments.filter(m => m.video === v.id).length}</span>
          </div>

          <!-- Share Button -->
          <div class="feed-action">
            <button class="feed-btn" onclick="shareVideo(${v.id})" aria-label="Share video">↗️</button>
            <span class="feed-label">Share</span>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="feed-container" id="feedContainer">
      ${itemsHtml}
    </div>

    <!-- Feed Comments Backdrop -->
    <div class="feed-comments-backdrop" id="feedCommentsBackdrop" onclick="closeFeedComments()"></div>

    <!-- Feed Comments Slide-up Drawer -->
    <div class="feed-comments-drawer" id="feedCommentsDrawer">
      <div class="feed-comments-header">
        <span>Comments</span>
        <button class="feed-comments-close" onclick="closeFeedComments()">✕</button>
      </div>
      <div class="feed-comments-body" id="feedCommentsBody"></div>
      <div class="feed-comments-footer" id="feedCommentsFooter"></div>
    </div>
  `;
}

/* IntersectionObserver to handle autoplay, lazy preloading, and tearing down offscreen videos */
export function attachFeedObserver() {
  const container = document.getElementById("feedContainer");
  if (!container) return;

  const items = Array.from(container.querySelectorAll(".feed-item"));
  const videos = pubVerticalVideos();

  if (feedObserver) {
    feedObserver.disconnect();
  }

  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      const index = parseInt(el.dataset.index, 10);
      const videoEl = el.querySelector(".feed-video");
      const videoId = parseInt(el.dataset.videoId, 10);

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        currentActiveVideo = videoId;
        const dataSaver = isDataSaverMode();

        // 1. Play active video (skipped on data-saver — poster stays put)
        if (videoEl && !dataSaver) {
          if (!videoEl.src) {
            videoEl.src = videoEl.dataset.src;
          }
          // Attempt playback with audio, fallback to muted if blocked
          videoEl.play().catch(() => {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          });
        }

        // 2. Manage memory / preload adjacent (active-1 to active+2)
        items.forEach((item, idx) => {
          const itemVid = item.querySelector(".feed-video");
          if (!itemVid) return;

          const isNear = !dataSaver && idx >= index - 1 && idx <= index + 2;
          if (isNear) {
            if (!itemVid.src) {
              itemVid.src = itemVid.dataset.src;
              itemVid.load();
            }
          } else {
            // Tear down player completely to free hardware decoders
            if (itemVid.src) {
              itemVid.removeAttribute("src");
              itemVid.load();
            }
          }
        });
      } else {
        // Pause offscreen videos
        if (videoEl) {
          videoEl.pause();
        }
      }
    });
  }, {
    threshold: 0.5,
    root: container
  });

  items.forEach(item => feedObserver.observe(item));
  attachFeedGestures(container);
}

/* Double-tap-to-like: a single delegated listener on the container (rebound
   each render alongside the observer, same lifecycle) rather than one per
   item. Ignores taps that land on the sidebar/overlay controls so it doesn't
   fight their own onclick handlers. Fires a short haptic pulse on supported
   devices as the like's tactile confirmation. */
const DOUBLE_TAP_MS = 300;
let _lastTapTime = 0;
let _lastTapItem = null;

function attachFeedGestures(container){
  container.removeEventListener("pointerup", onFeedPointerUp);
  container.addEventListener("pointerup", onFeedPointerUp);
}

function onFeedPointerUp(e){
  if (e.target.closest(".feed-sidebar, .feed-creator-row, .feed-category")) return;
  const item = e.target.closest(".feed-item");
  if (!item) return;

  const now = Date.now();
  const isDoubleTap = item === _lastTapItem && (now - _lastTapTime) < DOUBLE_TAP_MS;
  _lastTapTime = isDoubleTap ? 0 : now;
  _lastTapItem = isDoubleTap ? null : item;
  if (!isDoubleTap) return;

  const videoId = parseInt(item.dataset.videoId, 10);
  if (!videoId) return;
  likeVideo(videoId);
  if (navigator.vibrate) navigator.vibrate(15);
}

// Window actions for comments drawer in the feed. Guarded so importing this
// module outside a browser (e.g. Node test runner) doesn't throw.
if (typeof window !== "undefined") {
window.openFeedComments = function(videoId) {
  const drawer = document.getElementById("feedCommentsDrawer");
  const backdrop = document.getElementById("feedCommentsBackdrop");
  const body = document.getElementById("feedCommentsBody");
  const footer = document.getElementById("feedCommentsFooter");
  if (!drawer || !body || !footer) return;

  const v = DATA.videos.find(x => x.id === videoId);
  if (!v) return;

  body.innerHTML = renderCommentList(v);
  footer.innerHTML = `
    <input class="fld" id="feedCbox" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')submitFeedComment(${v.id})"/>
    <button class="btn" onclick="submitFeedComment(${v.id})">Post</button>
  `;

  drawer.classList.add("open");
  if (backdrop) backdrop.classList.add("show");
};

window.closeFeedComments = function() {
  const drawer = document.getElementById("feedCommentsDrawer");
  const backdrop = document.getElementById("feedCommentsBackdrop");
  if (drawer) drawer.classList.remove("open");
  if (backdrop) backdrop.classList.remove("show");
};

window.submitFeedComment = async function(videoId) {
  const box = document.getElementById("feedCbox");
  if (!box || !box.value.trim()) return;

  const bodyVal = box.value.trim();
  box.value = "";

  try {
    // Reuse shared addComment mechanism
    if (window.addComment) {
      await window.addComment(videoId, bodyVal);
      // Refresh drawer
      const v = DATA.videos.find(x => x.id === videoId);
      if (v) {
        const body = document.getElementById("feedCommentsBody");
        if (body) body.innerHTML = renderCommentList(v);
        // Update comments badge on the feed sidebar in-place
        const commentLabel = document.getElementById(`feedComment_${videoId}`);
        if (commentLabel) {
          commentLabel.textContent = DATA.comments.filter(m => m.video === videoId).length;
        }
      }
    }
  } catch (e) {
    console.error("Failed to post comment", e);
  }
};
}
