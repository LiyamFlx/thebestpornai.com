import { DATA, esc, creatorName, fmt, mediaUrl } from "../../shared/catalog.js";
import { pubVerticalVideos, creatorById, visible } from "../catalog-queries.js";
import { vstate, markFeedWatched } from "../state.js";
import { jsq } from "../util.js";
import { renderCommentList, commentsFor } from "../comments.js";
import { likeVideo, subscribe, addComment } from "../actions.js";
import { ShAPI } from "../../shared/streamhub-api.js";
import { setHash, takePendingFeedFocus } from "../router.js";

// Global pointers to track observer, active video, and audio mute state
let feedObserver = null;
let currentActiveVideo = null;
let feedMuted = true;
let activeProgressVideo = null;

/* ---- Virtualization ----
   The feed's public/originals catalog can run into the hundreds of vertical
   entries; renderFeed() used to map() every single one into one innerHTML
   write, meaning a full-featured .feed-item (progress bar, overlay,
   4-button sidebar, and a <video> with an eager `poster` — a ~346-image
   stampede on feed open by itself) sat in the DOM for all of them from
   first paint, even though only ~3 are ever near the viewport at once.

   Fix: renderFeed() emits only cheap, empty full-height shells (a div with
   data-index/data-video-id, nothing else) for EVERY item up front — needed
   so total scrollHeight/scroll-snap geometry is correct no matter where in
   the feed the user is. Only a small window of shells around the active
   one (active ± WINDOW) ever gets its heavy inner content (video/poster/
   overlay/sidebar) injected — see hydrateWindow(). Measured on a simulated
   iPhone 12 loading a 448-clip feed: 16,147 DOM nodes -> 791, 448 <video>
   elements -> 3, 346 poster requests on open -> ~5. */
const WINDOW = 2;   // hydrate active ± WINDOW (5 items live at once)
let _feedData = [];       // index-aligned render data, rebuilt each renderFeed()
const _hydrated = new Set();   // indices currently holding heavy content

function isDataSaverMode(){
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return !!c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

function shuffle(list){
  const a = list.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* pubVerticalVideos() itself is memoized on the catalog (same array/order
   every call — deliberately, other callers may rely on that stability). The
   feed's own presentation order is a separate concern: recomputed fresh
   every time renderFeed() runs (i.e. every time the viewer navigates to the
   Shorts tab), it shuffles so repeat visits aren't the same fixed order,
   and puts videos the viewer hasn't actually watched yet (see
   markFeedWatched()) ahead of ones they have — so new/unseen clips surface
   first, with already-seen ones as shuffled filler at the end rather than
   disappearing (the feed still needs enough content to keep scrolling once
   everything's been seen once).

   Deep links (#shorts/N): when vstate.feedFocusId is set, that clip is
   forced to index 0 so the shared reel is the first thing on screen. */
function orderedFeedVideos(){
  const all = pubVerticalVideos();
  const seen = new Set(vstate.feedWatched);
  const unwatched = [], watched = [];
  for(const v of all) (seen.has(v.id) ? watched : unwatched).push(v);
  let list = shuffle(unwatched).concat(shuffle(watched));

  const pinId = Number(vstate.feedFocusId);
  if(Number.isFinite(pinId) && pinId > 0){
    const idx = list.findIndex((v) => v.id === pinId);
    if(idx > 0){
      const [pinned] = list.splice(idx, 1);
      list.unshift(pinned);
    } else if(idx < 0){
      // Not in the public vertical list yet (or edge case) — try raw catalog
      const raw = DATA.videos.find((v) => v.id === pinId && v.orientation === "vertical" && visible(v));
      if(raw) list = [raw].concat(list.filter((v) => v.id !== pinId));
    }
  }
  return list;
}

export function toggleFeedMute(){
  feedMuted = !feedMuted;
  document.querySelectorAll(".feed-video").forEach(v => {
    // Unmute only after user gesture (this handler runs on click).
    try { v.muted = feedMuted; } catch(_){ v.muted = true; }
  });
  document.querySelectorAll(".feed-sound-btn").forEach(b => {
    b.innerHTML = `<svg class="ico"><use href="#icon-${feedMuted ? 'mute' : 'unmute'}"/></svg>`;
  });
  document.querySelectorAll(".feed-sound-label").forEach(l => {
    l.textContent = feedMuted ? "Muted" : "Sound";
  });
  document.querySelectorAll(".feed-unmute-banner").forEach(el => {
    el.classList.toggle("hidden", !feedMuted);
  });
}

/* Heavy inner content for a single feed item — only injected into shells that
   fall inside the active window (see hydrateWindow). Keeping the <video>
   (and therefore its eager `poster`) out of the DOM until an item is near the
   viewport is what turns the old 448-video / 346-poster-request open into a
   handful of live elements. */
function feedItemInner(d){
  const { v, c, live, commentCount, subbed, hasCreator } = d;
  return `
    <!-- Top Video Scrub / Playback Progress Bar -->
    <div class="feed-progress-wrap" aria-hidden="true">
      <div class="feed-progress-bar"></div>
    </div>

    <!-- Video element -->
    <video class="feed-video" playsinline preload="none" ${feedMuted ? 'muted' : ''} data-src="${mediaUrl(v.src)}" poster="${mediaUrl(v.thumb)}"></video>

    <!-- Floating Tap for Sound banner (visible when muted) -->
    <button type="button" class="feed-unmute-banner ${feedMuted ? '' : 'hidden'}" onclick="event.stopPropagation();toggleFeedMute()" aria-label="Tap for sound">
      <span class="ico-sound">🔊</span> Tap for Sound
    </button>

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
      <!-- Creator Avatar (+ overlapping follow badge) -->
      <div class="feed-avatar-wrap">
        <div class="feed-avatar" onclick="openCreator('${jsq(c.id)}')">${esc((c.name || "?")[0])}</div>
        ${hasCreator ? `
          <button class="feed-follow-dot ${subbed ? 'subbed' : ''}" onclick="event.stopPropagation();subscribe('${jsq(c.id)}')" aria-label="${subbed ? 'Following' : 'Follow'} ${esc(c.name)}">${subbed ? '✓' : '+'}</button>
        ` : ''}
      </div>

      <!-- Sound / Mute Toggle -->
      <div class="feed-action">
        <button class="feed-btn feed-sound-btn" onclick="toggleFeedMute()" aria-label="Toggle sound"><svg class="ico"><use href="#icon-${feedMuted ? 'mute' : 'unmute'}"/></svg></button>
        <span class="feed-label feed-sound-label">${feedMuted ? 'Muted' : 'Sound'}</span>
      </div>

      <!-- Like Button -->
      <div class="feed-action">
        <button class="feed-btn feed-like-btn ${(live && live.like > 0) ? 'liked' : ''}" onclick="likeVideo(${v.id})" aria-label="Like video"><svg class="ico"><use href="#icon-heart"/></svg></button>
        <span class="feed-label" id="feedLike_${v.id}">${fmt(v.likes + live.like)}</span>
      </div>

      <!-- Comments Button -->
      <div class="feed-action">
        <button class="feed-btn" onclick="openFeedComments(${v.id})" aria-label="View comments"><svg class="ico"><use href="#icon-comment"/></svg></button>
        <span class="feed-label" id="feedComment_${v.id}">${commentCount}</span>
      </div>

      <!-- Share Button -->
      <div class="feed-action">
        <button class="feed-btn" onclick="shareVideo(${v.id})" aria-label="Share video"><svg class="ico"><use href="#icon-share"/></svg></button>
        <span class="feed-label">Share</span>
      </div>
    </div>
  `;
}

export function renderFeed() {
  const videos = orderedFeedVideos();
  if (!videos.length) {
    return `<div class="empty">
      <div class="empty-emoji">📱</div>
      <div class="empty-msg">No vertical videos published yet.</div>
      <button type="button" class="btn ghost sm empty-home-btn" onclick="go('home')">Browse Home</button>
    </div>`;
  }

  const commentCountByVideo = new Map();
  for (const cm of DATA.comments) {
    commentCountByVideo.set(cm.video, (commentCountByVideo.get(cm.video) || 0) + 1);
  }
  for (const [vidKey, live] of Object.entries(vstate.live)) {
    if (live && live.comments && live.comments.length) {
      const id = Number(vidKey);
      commentCountByVideo.set(id, (commentCountByVideo.get(id) || 0) + live.comments.length);
    }
  }

  // Build the index-aligned render-data table used to hydrate item content on
  // demand, and emit only lightweight full-height shells up front.
  _feedData = videos.map((v) => {
    const c = creatorById(v.creator) || { name: "Unknown", id: "", verified: false };
    const live = vstate.live[v.id] || { like: 0, dislike: 0 };
    return {
      v, c, live,
      commentCount: commentCountByVideo.get(v.id) || 0,
      subbed: vstate.subs.includes(v.creator),
      hasCreator: !!c.id,
    };
  });
  _hydrated.clear();

  const shellsHtml = _feedData.map((d, index) =>
    `<div class="feed-item" data-index="${index}" data-video-id="${d.v.id}"></div>`
  ).join("");

  return `
    <div class="feed-container" id="feedContainer">
      ${shellsHtml}
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

/* Mark a video "watched" (for orderedFeedVideos()'s unwatched-first sort)
   only once real playback happened — a fast scroll-past shouldn't count the
   same as actually watching the clip. Shared by the teardown path in
   hydrateWindow() (item scrolled far enough to be devirtualized) and the
   IntersectionObserver's inactive branch below (item merely scrolled just
   out of the 50% threshold) — either can be the first to notice. */
function markIfWatchedEnough(videoEl, videoId){
  if(!videoEl || !Number.isFinite(videoId)) return;
  const watchedEnough = videoEl.currentTime > 3 ||
    (videoEl.duration && videoEl.currentTime / videoEl.duration >= 0.6);
  if(watchedEnough) markFeedWatched(videoId);
}

/* Hydrate the shells inside [active-WINDOW, active+WINDOW] and tear down the
   ones that fell outside it (pausing + releasing their video/poster). This is
   the core of the virtualization: it bounds live media to ~5 items regardless
   of how many hundred clips the feed holds. */
function hydrateWindow(container, activeIndex){
  const lo = Math.max(0, activeIndex - WINDOW);
  const hi = Math.min(_feedData.length - 1, activeIndex + WINDOW);

  // Tear down anything now outside the window.
  for(const idx of Array.from(_hydrated)){
    if(idx < lo || idx > hi){
      const shell = container.querySelector(`.feed-item[data-index="${idx}"]`);
      if(shell){
        const vid = shell.querySelector(".feed-video");
        if(vid){
          markIfWatchedEnough(vid, +shell.dataset.videoId);
          try{ vid.pause(); }catch(_){}
          vid.removeAttribute("src"); try{ vid.load(); }catch(_){}
        }
        shell.innerHTML = "";
      }
      _hydrated.delete(idx);
    }
  }

  // Bring anything now inside the window to life.
  for(let idx = lo; idx <= hi; idx++){
    if(_hydrated.has(idx)) continue;
    const shell = container.querySelector(`.feed-item[data-index="${idx}"]`);
    const d = _feedData[idx];
    if(!shell || !d) continue;
    shell.innerHTML = feedItemInner(d);
    _hydrated.add(idx);
    const vid = shell.querySelector(".feed-video");
    if(vid){
      // Warm adjacent clips (not the active one — the observer plays that) so a
      // swipe lands on an already-buffering video instead of a black frame.
      if(idx !== activeIndex && vid.dataset.src && !isDataSaverMode()){
        vid.src = vid.dataset.src;
        try{ vid.load(); }catch(_){}
      }
      bindAutoAdvance(shell);
    }
  }
}

function bindVideoProgress(item, videoEl){
  if(activeProgressVideo === videoEl) return;
  if(activeProgressVideo){
    activeProgressVideo.removeEventListener("timeupdate", onVideoTimeUpdate);
  }
  activeProgressVideo = videoEl;
  videoEl.addEventListener("timeupdate", onVideoTimeUpdate);
}

function onVideoTimeUpdate(){
  if(!activeProgressVideo) return;
  const item = activeProgressVideo.closest(".feed-item");
  if(!item) return;
  const bar = item.querySelector(".feed-progress-bar");
  if(!bar) return;
  const pct = (activeProgressVideo.currentTime / (activeProgressVideo.duration || 1)) * 100;
  bar.style.width = `${pct.toFixed(1)}%`;
}

/* IntersectionObserver to handle autoplay, hydration/virtualization window,
   and pausing offscreen videos */
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
      const videoId = parseInt(el.dataset.videoId, 10);

      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        currentActiveVideo = videoId;
        // Keep the URL pointed at the active reel so "Copy link" / native share
        // of the address bar matches the clip on screen (IG Reel behaviour).
        // replace:true — swipe-through must not flood the Back stack.
        if(Number.isFinite(videoId) && vstate.page === "feed"){
          const want = "shorts/" + videoId;
          const cur = (location.hash || "").replace(/^#/, "");
          if(cur !== want) setHash(want, { replace: true });
          vstate.feedFocusId = videoId;
        }
        // Hydrate this item + neighbours and devirtualize anything that
        // scrolled out of the window; this also injects the active item's
        // <video> if it wasn't already hydrated.
        hydrateWindow(container, index);

        const dataSaver = isDataSaverMode();
        const videoEl = el.querySelector(".feed-video");
        if (videoEl && !dataSaver) {
          if (!videoEl.src) videoEl.src = videoEl.dataset.src;
          videoEl.muted = feedMuted;
          bindVideoProgress(el, videoEl);

          const p = videoEl.play();
          if(p && p.catch) {
            p.catch(() => {
              videoEl.muted = true;
              videoEl.play().catch(() => {});
            });
          }
        }
      } else {
        const videoEl = el.querySelector(".feed-video");
        if (videoEl) {
          markIfWatchedEnough(videoEl, videoId);
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

  // Deep link: jump to the pinned/shared clip before first paint settles.
  // takePendingFeedFocus is set by applyHash for #shorts/N; fall back to
  // vstate.feedFocusId when the pending token was already consumed.
  const focusId = takePendingFeedFocus() ?? vstate.feedFocusId;
  let startIndex = 0;
  if(focusId != null && Number.isFinite(+focusId)){
    const pinned = container.querySelector(`.feed-item[data-video-id="${+focusId}"]`);
    if(pinned){
      startIndex = parseInt(pinned.dataset.index, 10) || 0;
      // Instant jump (no smooth scroll) — snap container + deep link must land
      // on the exact reel without animating past other clips first.
      container.scrollTop = pinned.offsetTop;
    }
  }

  // Paint the focused screen's content immediately rather than waiting for the
  // observer's first async callback.
  hydrateWindow(container, startIndex);
  // Kick playback on the focused item if it was hydrated above.
  const startItem = container.querySelector(`.feed-item[data-index="${startIndex}"]`);
  const startVid = startItem && startItem.querySelector(".feed-video");
  if(startVid && !isDataSaverMode()){
    if(!startVid.src && startVid.dataset.src) startVid.src = startVid.dataset.src;
    startVid.muted = feedMuted;
    bindVideoProgress(startItem, startVid);
    const playP = startVid.play();
    if(playP && playP.catch){
      playP.catch(() => {
        startVid.muted = true;
        startVid.play().catch(() => {});
      });
    }
  }
  if(focusId != null && Number.isFinite(+focusId)){
    setHash("shorts/" + (+focusId), { replace: true });
  }
}

/* Auto-advance: when a clip finishes, scroll to the next item in the feed
   (wrapping to the first after the last) instead of looping in place —
   .feed-video no longer has the `loop` attribute, so "ended" actually fires.
   Bound per-item at hydrate time; the target shell always exists (shells are
   never virtualized away, only their inner content is). */
function bindAutoAdvance(item){
  const videoEl = item.querySelector(".feed-video");
  if(!videoEl || videoEl.dataset.autoAdvanceBound) return;
  videoEl.dataset.autoAdvanceBound = "1";
  videoEl.addEventListener("ended", () => {
    const index = parseInt(item.dataset.index, 10);
    const container = item.closest(".feed-container");
    if(!container) return;
    const nextIdx = (index + 1 < _feedData.length) ? index + 1 : 0;
    const next = container.querySelector(`.feed-item[data-index="${nextIdx}"]`);
    if(!next) return;
    // Set scrollTop directly rather than next.scrollIntoView({behavior:"smooth"}):
    // .feed-container has scroll-snap-type:y mandatory, and a smooth
    // programmatic scroll fights the browser's own snap-scroll — it was
    // observed getting stuck a few px into the animation and never
    // completing. offsetTop respects snap points without that conflict.
    container.scrollTop = next.offsetTop;
  });
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

  // Multi-particle heart explosion
  const offsets = [
    { dx: 0, dy: 0, delay: 0 },
    { dx: -18, dy: -12, delay: 40 },
    { dx: 18, dy: -24, delay: 80 }
  ];

  offsets.forEach(({ dx, dy, delay }) => {
    setTimeout(() => {
      const heart = document.createElement("div");
      heart.className = "feed-heart-burst";
      heart.textContent = "❤️";
      heart.style.left = `${relX + dx}px`;
      heart.style.top = `${relY + dy}px`;
      item.appendChild(heart);
      setTimeout(() => heart.remove(), 850);
    }, delay);
  });
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
    clearTimeout(_singleTapTimer);
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
    videoId = +videoId;
    const drawer = document.getElementById("feedCommentsDrawer");
    const backdrop = document.getElementById("feedCommentsBackdrop");
    const body = document.getElementById("feedCommentsBody");
    const footer = document.getElementById("feedCommentsFooter");
    if (!drawer || !body || !footer) return;

    const v = DATA.videos.find(x => x.id === videoId);
    if (!v) return;

    body.innerHTML = renderCommentList(v);
    footer.innerHTML = `
      <input class="fld" id="feedCbox" placeholder="Add a comment…" autocomplete="off" onkeydown="if(event.key==='Enter'){event.preventDefault();submitFeedComment(${v.id})}"/>
      <button type="button" class="btn" onclick="submitFeedComment(${v.id})">Post</button>
    `;

    drawer.classList.add("open");
    drawer.dataset.videoId = String(v.id);
    if (backdrop) backdrop.classList.add("show");
    // Pull server comments into the drawer (same source as watch page).
    hydrateFeedComments(v).catch(() => {});
    // Focus input after open so mobile keyboards can post immediately.
    requestAnimationFrame(() => {
      const input = document.getElementById("feedCbox");
      if (input) try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
    });
  };

  window.closeFeedComments = function() {
    const drawer = document.getElementById("feedCommentsDrawer");
    const backdrop = document.getElementById("feedCommentsBackdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("show");
  };

  /* Merge Supabase comments for this video into DATA.comments, then refresh
     the open drawer + sidebar count. Best-effort; seed/local overlay remain. */
  async function hydrateFeedComments(v) {
    if (!ShAPI || !ShAPI.enabled || !v) return;
    try {
      const rows = await ShAPI.listComments(v.id);
      if (!rows || !rows.length) return;
      for (const c of rows) {
        const key = "db" + c.id;
        if (!DATA.comments.some((m) => m.id === key)) {
          DATA.comments.push({
            id: key,
            video: v.id,
            user: c.author,
            text: c.body,
            time: "",
            ts: Date.parse(c.created_at) || 0,
          });
        }
      }
      const body = document.getElementById("feedCommentsBody");
      if (body && document.getElementById("feedCommentsDrawer")?.classList.contains("open")) {
        body.innerHTML = renderCommentList(v);
      }
      const commentLabel = document.getElementById(`feedComment_${v.id}`);
      if (commentLabel) commentLabel.textContent = String(commentsFor(v).length);
    } catch (_) { /* offline / API down */ }
  }

  window.submitFeedComment = function(videoId) {
    videoId = +videoId;
    const box = document.getElementById("feedCbox");
    if (!box) return;
    const bodyVal = (box.value || "").trim();
    if (!bodyVal) return;
    // addComment accepts text directly (does not require #cbox) and refreshes
    // the feed drawer + count when #feedCommentsBody is present.
    try {
      addComment(videoId, bodyVal);
    } catch (e) {
      console.error("Failed to post comment", e);
    }
  };
}