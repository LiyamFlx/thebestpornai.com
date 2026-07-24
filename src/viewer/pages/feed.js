import { DATA, esc, creatorName, fmt, mediaUrl } from "../../shared/catalog.js";
import { pubVerticalVideos } from "../catalog-queries.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { renderCommentList, commentsFor } from "../comments.js";
import { likeVideo } from "../actions.js";

// Global pointers to track observer, active video, and audio mute state
let feedObserver = null;
let currentActiveVideo = null;
let feedMuted = true;

// O(1) creator lookup, built once at module load — same pattern as watch.js.
// TODO: if watch.js and feed.js both need this, it belongs in shared/catalog.js
// as a single exported map rather than two independently-built copies.
const CREATOR_BY_ID = new Map(DATA.creators.map(c => [c.id, c]));

function isDataSaverMode(){
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return !!c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

export function toggleFeedMute(){
  feedMuted = !feedMuted;
  document.querySelectorAll(".feed-video").forEach(v => {
    v.muted = feedMuted;
  });
  document.querySelectorAll(".feed-sound-btn").forEach(b => {
    b.textContent = feedMuted ? "🔇" : "🔊";
  });
  document.querySelectorAll(".feed-sound-label").forEach(l => {
    l.textContent = feedMuted ? "Muted" : "Sound";
  });
}

export function renderFeed() {
  const videos = pubVerticalVideos();
  if (!videos.length) {
    return `<div class="empty">
      <div class="empty-emoji">📱</div>
      <div class="empty-msg">No vertical videos published yet.</div>
    </div>`;
  }

  // Precomputed once per render: O(comments) instead of re-scanning the full
  // comments array for every single video below (was O(videos * comments) —
  // on a feed with hundreds of videos and thousands of comments that's
  // millions of comparisons per render).
  const commentCountByVideo = new Map();
  for (const cm of DATA.comments) {
    commentCountByVideo.set(cm.video, (commentCountByVideo.get(cm.video) || 0) + 1);
  }
  // Fold in locally-added comments living in the vstate.live overlay (see
  // comments.js's commentsFor()) so a comment posted from the feed drawer
  // shows up in the sidebar count immediately, not just after a reload.
  for (const [vidKey, live] of Object.entries(vstate.live)) {
    if (live && live.comments && live.comments.length) {
      const id = Number(vidKey);
      commentCountByVideo.set(id, (commentCountByVideo.get(id) || 0) + live.comments.length);
    }
  }

  // Generate scroll-snap viewport container
  const itemsHtml = videos.map((v, index) => {
    const c = CREATOR_BY_ID.get(v.creator) || { name: "Unknown", id: "", verified: false };
    const live = vstate.live[v.id] || { like: 0, dislike: 0 };
    // No `isLiked` here on purpose: .liked is owned by vote()/likeVideo() in
    // actions.js, which patches the DOM directly right after a click in the
    // current session (see feedBtn.classList.add("liked") there). There's no
    // durable per-user "already liked" flag anywhere in vstate to source an
    // initial-render value from — likeVideo() is an uncapped counter, not a
    // toggle. Previously this read vstate.favorites (a different feature,
    // driven by toggleFav) which was simply wrong. If persisted liked-state
    // across reloads is wanted, that's a new vstate.liked Set + a guard in
    // vote() — a feature addition, not a fix, so not added here.
    const commentCount = commentCountByVideo.get(v.id) || 0;

    return `
      <div class="feed-item" data-index="${index}" data-video-id="${v.id}">
        <!-- Video element -->
        <video class="feed-video" loop playsinline ${feedMuted ? 'muted' : ''} data-src="${mediaUrl(v.src)}" poster="${mediaUrl(v.thumb)}"></video>
        
        <!-- Play / Pause / Playback State Toast Badge Overlay -->
        <div class="feed-state-badge" aria-hidden="true"></div>

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

          <!-- Sound / Mute Toggle -->
          <div class="feed-action">
            <button class="feed-btn feed-sound-btn" onclick="toggleFeedMute()" aria-label="Toggle sound">${feedMuted ? '🔇' : '🔊'}</button>
            <span class="feed-label feed-sound-label">${feedMuted ? 'Muted' : 'Sound'}</span>
          </div>

          <!-- Like Button -->
          <div class="feed-action">
            <button class="feed-btn" onclick="likeVideo(${v.id})" aria-label="Like video">❤️</button>
            <span class="feed-label" id="feedLike_${v.id}">${fmt(v.likes + live.like)}</span>
          </div>

          <!-- Comments Button -->
          <div class="feed-action">
            <button class="feed-btn" onclick="openFeedComments(${v.id})" aria-label="View comments">💬</button>
            <span class="feed-label" id="feedComment_${v.id}">${commentCount}</span>
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

/* IntersectionObserver to handle autoplay, preloading, and pausing offscreen videos */
export function attachFeedObserver() {
  const container = document.getElementById("feedContainer");
  if (!container) return;

  const items = Array.from(container.querySelectorAll(".feed-item"));

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

        // Play active video
        if (videoEl && !dataSaver) {
          if (!videoEl.src) {
            videoEl.src = videoEl.dataset.src;
          }
          videoEl.muted = feedMuted;
          const p = videoEl.play();
          if(p && p.catch) {
            p.catch(() => {
              // If un-muted playback is blocked by browser policy, fall back to muted
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            });
          }
        }

        // Memory management: preload adjacent, tear down distant
        items.forEach((item, idx) => {
          const itemVid = item.querySelector(".feed-video");
          if (!itemVid) return;

          const isNear = !dataSaver && idx >= index - 1 && idx <= index + 1;
          if (isNear) {
            if (!itemVid.src && itemVid.dataset.src) {
              itemVid.src = itemVid.dataset.src;
              try { itemVid.load(); } catch(_){}
            }
          } else if (idx < index - 2 || idx > index + 2) {
            if (itemVid.src) {
              itemVid.pause();
              itemVid.removeAttribute("src");
              try { itemVid.load(); } catch(_){}
            }
          }
        });
      } else {
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

/* Double-tap-to-like & Tap-to-Pause Gestures */
const DOUBLE_TAP_MS = 300;
let _lastTapTime = 0;
let _lastTapItem = null;
let _singleTapTimer = null;

function attachFeedGestures(container){
  container.removeEventListener("pointerup", onFeedPointerUp);
  container.addEventListener("pointerup", onFeedPointerUp);
}

function spawnHeartBurst(item, x, y){
  const rect = item.getBoundingClientRect();
  const relX = x - rect.left;
  const relY = y - rect.top;
  
  const heart = document.createElement("div");
  heart.className = "feed-heart-burst";
  heart.textContent = "❤️";
  heart.style.left = `${relX}px`;
  heart.style.top = `${relY}px`;
  
  item.appendChild(heart);
  setTimeout(() => heart.remove(), 800);
}

function showPlaybackBadge(item, text){
  const badge = item.querySelector(".feed-state-badge");
  if(!badge) return;
  badge.textContent = text;
  badge.classList.remove("show");
  void badge.offsetWidth; // trigger reflow
  badge.classList.add("show");
  setTimeout(() => badge.classList.remove("show"), 650);
}

function onFeedPointerUp(e){
  if (e.target.closest(".feed-sidebar, .feed-creator-row, .feed-category, .feed-comments-drawer")) return;
  const item = e.target.closest(".feed-item");
  if (!item) return;

  const now = Date.now();
  const isDoubleTap = item === _lastTapItem && (now - _lastTapTime) < DOUBLE_TAP_MS;

  if (isDoubleTap) {
    clearTimeout(_singleTapTimer);
    _lastTapTime = 0;
    _lastTapItem = null;
    const videoId = parseInt(item.dataset.videoId, 10);
    if (Number.isFinite(videoId)) {
      likeVideo(videoId);
      spawnHeartBurst(item, e.clientX, e.clientY);
      if (navigator.vibrate) navigator.vibrate(20);
    }
  } else {
    _lastTapTime = now;
    _lastTapItem = item;
    // Cancel any pending toggle from a prior, unrelated tap before scheduling this one.
    clearTimeout(_singleTapTimer);
    // Delay must be >= DOUBLE_TAP_MS: firing earlier (the old 220ms) meant a
    // legitimate double-tap landing in the 220–300ms gap would still register
    // as a like, but only after the single-tap play/pause toggle had already
    // fired — producing a spurious pause/play flicker on real double-taps.
    _singleTapTimer = setTimeout(() => {
      const videoEl = item.querySelector(".feed-video");
      if(!videoEl) return;
      if(videoEl.paused){
        videoEl.play().then(() => showPlaybackBadge(item, "▶")).catch(()=>{});
      } else {
        videoEl.pause();
        showPlaybackBadge(item, "⏸");
      }
    }, DOUBLE_TAP_MS);
  }
}

// Window actions for comments drawer & sound toggle
if (typeof window !== "undefined") {
  window.toggleFeedMute = toggleFeedMute;

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
      if (window.addComment) {
        await window.addComment(videoId, bodyVal);
        const v = DATA.videos.find(x => x.id === videoId);
        if (v) {
          const body = document.getElementById("feedCommentsBody");
          if (body) body.innerHTML = renderCommentList(v);
          const commentLabel = document.getElementById(`feedComment_${videoId}`);
          if (commentLabel) {
            commentLabel.textContent = commentsFor(v).length;
          }
        }
      }
    } catch (e) {
      console.error("Failed to post comment", e);
    }
  };
}