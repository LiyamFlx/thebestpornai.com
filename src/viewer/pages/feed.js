import { DATA, esc, fmt, mediaUrl } from "../../shared/catalog.js";
import { pubVerticalVideos, creatorById, visible } from "../catalog-queries.js";
import { vstate, markFeedWatched } from "../state.js";

import { renderCommentList, commentsFor } from "../comments.js";
import { likeVideo, subscribe, addComment, openCreator, shareVideo, go, patchVoteUi } from "../actions.js";
import { storedVoteFor, writeStoredVote } from "../../shared/vote-logic.js";
import { ShAPI } from "../../shared/streamhub-api.js";
import { setHash, takePendingFeedFocus } from "../router.js";

let feedObserver = null;
let currentActiveVideo = null;
let activeIndex = -1;
let feedMuted = true;
let activeProgressVideo = null;
let activeProgressBar = null;
let _progressRaf = null;
let _lastProgressTs = 0;
let _tapSoundTimer = null;
let _resumeOnVisible = false;
let _boundContainer = null;
let _boundRoot = null;
const PROGRESS_MIN_MS = 50;

let tapSoundSeen = false;
try {
  tapSoundSeen = !!(
    localStorage.getItem("tap_for_sound_seen") ||
    localStorage.getItem("tap_for_sound_dismissed")
  );
} catch (_) {}

function markTapSoundSeen() {
  if (tapSoundSeen) return;
  tapSoundSeen = true;
  try {
    localStorage.setItem("tap_for_sound_seen", "true");
    localStorage.setItem("tap_for_sound_dismissed", "true");
  } catch (_) {}
  hideUnmuteBanners();
}

function hideUnmuteBanners() {
  document.querySelectorAll(".feed-unmute-banner").forEach((el) => el.classList.add("hidden"));
}

// Virtualization: every item is an empty full-height shell (keeps scroll-snap geometry exact);
// only active ± WINDOW shells hold real content. 448-clip feed: 16k DOM nodes -> ~800, 448 <video> -> 5.
const WINDOW = 2;
let _feedVideos = [];
let _baseCommentCounts = new Map();
const _hydrated = new Set();

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

// Fresh order per visit: unwatched shuffled first, watched shuffled after; deep-linked clip pinned to 0.
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
      const raw = DATA.videos.find((v) => v.id === pinId && v.orientation === "vertical" && visible(v));
      if(raw) list = [raw].concat(list.filter((v) => v.id !== pinId));
    }
  }
  return list;
}

function syncMuteUi(){
  const icon = `<svg class="ico"><use href="#icon-${feedMuted ? "mute" : "unmute"}"/></svg>`;
  document.querySelectorAll(".feed-sound-btn").forEach((b) => { b.innerHTML = icon; });
  document.querySelectorAll(".feed-sound-label").forEach((l) => { l.textContent = feedMuted ? "Unmute" : "Mute"; });
}

function setAllMuted(muted){
  document.querySelectorAll(".feed-video").forEach((v) => {
    try { v.muted = muted; } catch (_) { v.muted = true; }
  });
}

export function toggleFeedMute(){
  feedMuted = !feedMuted;
  markTapSoundSeen();
  setAllMuted(feedMuted);
  syncMuteUi();
  hideUnmuteBanners();
  if(!feedMuted){
    const v = activeVideoEl();
    if(v && v.paused && v.dataset.userPaused !== "1") playVideo(v);
  }
}

// Only NotAllowedError means "unmuted autoplay blocked"; AbortError is just a superseded play() during fast swipes.
function playVideo(videoEl){
  if(!videoEl) return null;
  if(!videoEl.getAttribute("src") && videoEl.dataset.src) videoEl.src = videoEl.dataset.src;
  videoEl.muted = feedMuted;
  let p;
  try { p = videoEl.play(); } catch (_) { return null; }
  if(p && p.catch){
    p.catch((err) => {
      if(!err || err.name !== "NotAllowedError" || videoEl.muted) return;
      feedMuted = true;
      setAllMuted(true);
      syncMuteUi();
      if(videoEl.isConnected) videoEl.play().catch(() => {});
    });
  }
  return p;
}

function itemView(v){
  const c = creatorById(v.creator) || { name: "Unknown", id: "", verified: false };
  const stored = storedVoteFor(v.id);
  let live = vstate.live[v.id];
  if(!live && stored) live = vstate.live[v.id] = { like: 0, dislike: 0 };
  if(live && !live.myVote && stored) live.myVote = stored;
  live = live || { like: 0, dislike: 0 };
  const liveComments = (live.comments && live.comments.length) || 0;
  return {
    v, c, live,
    commentCount: (_baseCommentCounts.get(v.id) || 0) + liveComments,
    subbed: vstate.subs.includes(v.creator),
    hasCreator: !!c.id,
  };
}

function feedItemInner(d){
  const { v, c, live, commentCount, subbed, hasCreator } = d;
  const liked = live.myVote === "like";
  return `
    <div class="feed-progress-wrap" aria-hidden="true">
      <div class="feed-progress-bar"></div>
    </div>

    <video class="feed-video" playsinline preload="none" ${feedMuted ? "muted" : ""} data-src="${mediaUrl(v.src)}" poster="${mediaUrl(v.thumb)}"></video>

    <button type="button" class="feed-unmute-banner ${feedMuted && !tapSoundSeen ? "" : "hidden"}" data-action="toggleMute" aria-label="Tap to unmute">
      <span class="ico-sound">🔊</span> Tap to Unmute
    </button>

    <div class="feed-state-badge" aria-hidden="true"></div>

    <div class="feed-overlay">
      <div class="feed-creator-row">
        <span class="feed-creator" data-action="openCreator" data-creator="${esc(c.id)}">@${esc(c.name)}</span>
        ${c.verified ? '<span class="verified-badge">✓</span>' : ""}
      </div>
      <div class="feed-title">${esc(v.title)}</div>
      ${v.category ? `<div class="feed-category"><span class="vtag-cat">${esc(v.category)}</span></div>` : ""}
    </div>

    <div class="feed-sidebar">
      <div class="feed-avatar-wrap">
        <div class="feed-avatar" data-action="openCreator" data-creator="${esc(c.id)}">${esc((c.name || "?")[0])}</div>
        ${hasCreator ? `
          <button type="button" class="feed-follow-dot ${subbed ? "subbed" : ""}" data-action="subscribe" data-creator="${esc(c.id)}" aria-label="${subbed ? "Following" : "Follow"} ${esc(c.name)}">${subbed ? "✓" : "+"}</button>
        ` : ""}
      </div>

      <div class="feed-action">
        <button type="button" class="feed-btn feed-sound-btn" data-action="toggleMute" aria-label="Toggle sound"><svg class="ico"><use href="#icon-${feedMuted ? "mute" : "unmute"}"/></svg></button>
        <span class="feed-label feed-sound-label">${feedMuted ? "Unmute" : "Mute"}</span>
      </div>

      <div class="feed-action">
        <button type="button" class="feed-btn feed-like-btn ${liked ? "liked" : ""}" data-action="like" data-video="${v.id}" aria-label="Like video" aria-pressed="${liked}"><svg class="ico"><use href="#icon-heart"/></svg></button>
        <span class="feed-label" id="feedLike_${v.id}">${fmt((v.likes || 0) + (live.like || 0))}</span>
      </div>

      <div class="feed-action">
        <button type="button" class="feed-btn" data-action="comments" data-video="${v.id}" aria-label="View comments"><svg class="ico"><use href="#icon-comment"/></svg></button>
        <span class="feed-label" id="feedComment_${v.id}">${commentCount}</span>
      </div>

      <div class="feed-action">
        <button type="button" class="feed-btn" data-action="share" data-video="${v.id}" aria-label="Share video"><svg class="ico"><use href="#icon-share"/></svg></button>
        <span class="feed-label">Share</span>
      </div>
    </div>
  `;
}

export function renderFeed() {
  const videos = orderedFeedVideos();
  if (!videos.length) {
    _feedVideos = [];
    _hydrated.clear();
    return `<div class="empty">
      <div class="empty-emoji">📱</div>
      <div class="empty-msg">You’re all caught up on Shorts! Explore full 4K scenes on the homepage.</div>
      <button type="button" class="btn ghost sm empty-home-btn" data-action="goHome">Explore Home</button>
    </div>`;
  }

  _baseCommentCounts = new Map();
  for (const cm of DATA.comments) {
    _baseCommentCounts.set(cm.video, (_baseCommentCounts.get(cm.video) || 0) + 1);
  }

  _feedVideos = videos;
  _hydrated.clear();
  activeIndex = -1;

  let shellsHtml = "";
  for (let i = 0; i < videos.length; i++) {
    shellsHtml += `<div class="feed-item" data-index="${i}" data-video-id="${videos[i].id}"></div>`;
  }

  return `
    <div class="feed-container" id="feedContainer">
      ${shellsHtml}
    </div>

    <div class="feed-comments-backdrop" id="feedCommentsBackdrop" data-action="closeComments"></div>

    <div class="feed-comments-drawer" id="feedCommentsDrawer" role="dialog" aria-modal="true" aria-label="Comments">
      <div class="feed-comments-header">
        <span>Comments</span>
        <button type="button" class="feed-comments-close" data-action="closeComments" aria-label="Close comments">✕</button>
      </div>
      <div class="feed-comments-body" id="feedCommentsBody"></div>
      <div class="feed-comments-footer" id="feedCommentsFooter"></div>
    </div>
  `;
}

// A fast scroll-past must not count as watched.
function markIfWatchedEnough(videoEl, videoId){
  if(!videoEl || !Number.isFinite(videoId)) return;
  const watchedEnough = videoEl.currentTime > 3 ||
    (videoEl.duration && videoEl.currentTime / videoEl.duration >= 0.6);
  if(watchedEnough) markFeedWatched(videoId);
}

function shellAt(container, idx){
  const el = container.children[idx];
  if(el && el.dataset.index === String(idx)) return el;
  return container.querySelector(`.feed-item[data-index="${idx}"]`);
}

function activeVideoEl(){
  const container = _boundContainer || document.getElementById("feedContainer");
  if(!container || activeIndex < 0) return null;
  const shell = shellAt(container, activeIndex);
  return shell ? shell.querySelector(".feed-video") : null;
}

function isCommentsOpen(){
  const drawer = document.getElementById("feedCommentsDrawer");
  return !!(drawer && drawer.classList.contains("open"));
}

function hydrateWindow(container, active){
  const lo = Math.max(0, active - WINDOW);
  const hi = Math.min(_feedVideos.length - 1, active + WINDOW);

  for(const idx of Array.from(_hydrated)){
    if(idx >= lo && idx <= hi) continue;
    const shell = shellAt(container, idx);
    if(shell){
      const vid = shell.querySelector(".feed-video");
      if(vid){
        markIfWatchedEnough(vid, +shell.dataset.videoId);
        if(vid === activeProgressVideo) stopProgressLoop();
        try{ vid.pause(); }catch(_){}
        vid.removeAttribute("src");
        try{ vid.load(); }catch(_){}
      }
      shell.innerHTML = "";
    }
    _hydrated.delete(idx);
  }

  const dataSaver = isDataSaverMode();
  for(let idx = lo; idx <= hi; idx++){
    const shell = shellAt(container, idx);
    const v = _feedVideos[idx];
    if(!shell || !v) continue;
    if(!_hydrated.has(idx)){
      shell.innerHTML = feedItemInner(itemView(v));
      _hydrated.add(idx);
      bindVideoEvents(shell);
    }
    if(idx === active) continue;
    const vid = shell.querySelector(".feed-video");
    if(!vid) continue;
    if(!vid.paused){ try{ vid.pause(); }catch(_){} }
    // preload="none" + load() buffers nothing, so the preload hint must be raised before assigning src.
    if(dataSaver || Math.abs(idx - active) !== 1 || vid.getAttribute("src")) continue;
    vid.preload = idx > active ? "auto" : "metadata";
    vid.src = vid.dataset.src;
    try{ vid.load(); }catch(_){}
  }
}

function activateIndex(container, index){
  const shell = shellAt(container, index);
  if(!shell) return;
  const videoId = parseInt(shell.dataset.videoId, 10);
  const changed = index !== activeIndex;
  activeIndex = index;
  currentActiveVideo = videoId;

  if(Number.isFinite(videoId) && vstate.page === "feed"){
    const want = "/shorts/" + videoId;
    if(location.pathname !== want) setHash("shorts/" + videoId, { replace: true });
    vstate.feedFocusId = videoId;
  }

  hydrateWindow(container, index);
  hydrateFeedVote(_feedVideos[index]);

  const videoEl = shell.querySelector(".feed-video");
  if(!videoEl) return;
  if(changed) delete videoEl.dataset.userPaused;
  bindVideoProgress(shell, videoEl);
  if(!isDataSaverMode() && videoEl.dataset.userPaused !== "1") playVideo(videoEl);
}

function stopProgressLoop(){
  if(_progressRaf){
    cancelAnimationFrame(_progressRaf);
    _progressRaf = null;
  }
  activeProgressVideo = null;
  activeProgressBar = null;
  _lastProgressTs = 0;
}

function paintProgress(){
  const v = activeProgressVideo;
  if(!v || !activeProgressBar || !v.duration) return;
  activeProgressBar.style.width = `${((v.currentTime / v.duration) * 100).toFixed(1)}%`;
}

function tickProgress(now){
  const v = activeProgressVideo;
  if(!v || !v.isConnected){
    _progressRaf = null;
    return;
  }
  if(v.paused || !_lastProgressTs || (now - _lastProgressTs) >= PROGRESS_MIN_MS){
    paintProgress();
    _lastProgressTs = now;
  }
  _progressRaf = v.paused ? null : requestAnimationFrame(tickProgress);
}

function startProgressLoop(){
  if(!_progressRaf) _progressRaf = requestAnimationFrame(tickProgress);
}

function bindVideoProgress(item, videoEl){
  if(!videoEl || activeProgressVideo === videoEl) return;
  if(_progressRaf){ cancelAnimationFrame(_progressRaf); _progressRaf = null; }
  activeProgressVideo = videoEl;
  activeProgressBar = item.querySelector(".feed-progress-bar");
  _lastProgressTs = 0;
  startProgressLoop();
}

function bindVideoEvents(shell){
  const videoEl = shell.querySelector(".feed-video");
  if(!videoEl || videoEl.dataset.eventsBound) return;
  videoEl.dataset.eventsBound = "1";

  videoEl.addEventListener("play", () => {
    if(videoEl === activeProgressVideo) startProgressLoop();
  });
  videoEl.addEventListener("seeked", () => {
    if(videoEl === activeProgressVideo) paintProgress();
  });

  // Auto-advance (no `loop` attribute). Direct scrollTop, not smooth scrollIntoView: smooth scroll fights mandatory snap.
  videoEl.addEventListener("ended", () => {
    const container = shell.closest(".feed-container");
    if(!container) return;
    const index = parseInt(shell.dataset.index, 10);
    markFeedWatched(parseInt(shell.dataset.videoId, 10));
    const nextIdx = index + 1 < _feedVideos.length ? index + 1 : 0;
    if(nextIdx === index || isCommentsOpen()){
      videoEl.currentTime = 0;
      playVideo(videoEl);
      return;
    }
    const next = shellAt(container, nextIdx);
    if(next) container.scrollTop = next.offsetTop;
  });
}

const FEED_ACTIONS = {
  toggleMute: () => toggleFeedMute(),
  openCreator: (el) => { if(el.dataset.creator) openCreator(el.dataset.creator); },
  subscribe: (el) => { if(el.dataset.creator) subscribe(el.dataset.creator); },
  like: (el, id) => { if(Number.isFinite(id)) likeVideo(id); },
  comments: (el, id) => { if(Number.isFinite(id)) openFeedComments(id); },
  share: (el, id) => { if(Number.isFinite(id)) shareVideo(id); },
  closeComments: () => closeFeedComments(),
  postComment: (el, id) => { if(Number.isFinite(id)) submitFeedComment(id); },
  goHome: () => go("home"),
};

function onFeedActionClick(e){
  const el = e.target.closest("[data-action]");
  if(!el || !el.closest("#feedContainer, #feedCommentsDrawer, #feedCommentsBackdrop")) return;
  const handler = FEED_ACTIONS[el.dataset.action];
  if(!handler) return;
  e.stopPropagation();
  handler(el, Number(el.dataset.video));
}

function onVisibilityChange(){
  const v = activeVideoEl();
  if(!v) return;
  if(document.hidden){
    _resumeOnVisible = !v.paused;
    v.pause();
  } else if(_resumeOnVisible){
    _resumeOnVisible = false;
    if(v.dataset.userPaused !== "1") playVideo(v);
  }
}

function scrollToIndex(idx){
  const container = _boundContainer;
  if(!container || idx < 0 || idx >= _feedVideos.length) return;
  const shell = shellAt(container, idx);
  if(shell) container.scrollTop = shell.offsetTop;
}

function onFeedKeydown(e){
  if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.key === "Escape"){
    if(isCommentsOpen()){ e.preventDefault(); closeFeedComments(); }
    return;
  }
  const t = e.target;
  if(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if(isCommentsOpen() || activeIndex < 0) return;
  switch(e.key){
    case "ArrowDown":
      e.preventDefault();
      scrollToIndex(activeIndex + 1);
      break;
    case "ArrowUp":
      e.preventDefault();
      scrollToIndex(activeIndex - 1);
      break;
    case " ":
      if(t && t.tagName === "BUTTON") return;
      e.preventDefault();
      togglePlayback(shellAt(_boundContainer, activeIndex));
      break;
    case "m":
    case "M":
      toggleFeedMute();
      break;
  }
}

export function detachFeedObserver(){
  if(feedObserver){
    feedObserver.disconnect();
    feedObserver = null;
  }
  stopProgressLoop();
  if(_boundContainer) _boundContainer.removeEventListener("pointerup", onFeedPointerUp);
  if(_boundRoot) _boundRoot.removeEventListener("click", onFeedActionClick);
  _boundContainer = null;
  _boundRoot = null;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  document.removeEventListener("keydown", onFeedKeydown);
  clearTimeout(_singleTapTimer);
  clearTimeout(_tapSoundTimer);
  _singleTapTimer = null;
  _tapSoundTimer = null;
  _lastTapItem = null;
  _lastTapTime = 0;
  _resumeOnVisible = false;
  currentActiveVideo = null;
  activeIndex = -1;
}

export function attachFeedObserver() {
  const container = document.getElementById("feedContainer");
  if (!container) return;

  detachFeedObserver();

  const root = container.parentElement;
  _boundContainer = container;
  _boundRoot = root;

  feedObserver = new IntersectionObserver((entries) => {
    let best = null;
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
      } else {
        const videoEl = entry.target.querySelector(".feed-video");
        if (videoEl) {
          markIfWatchedEnough(videoEl, parseInt(entry.target.dataset.videoId, 10));
          videoEl.pause();
        }
      }
    }
    if (best) activateIndex(container, parseInt(best.target.dataset.index, 10));
  }, {
    threshold: 0.5,
    root: container
  });

  for (const item of container.children) feedObserver.observe(item);
  container.addEventListener("pointerup", onFeedPointerUp);
  if (root) root.addEventListener("click", onFeedActionClick);
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("keydown", onFeedKeydown);
  if (!tapSoundSeen) _tapSoundTimer = setTimeout(markTapSoundSeen, 4000);

  const focusId = takePendingFeedFocus() ?? vstate.feedFocusId;
  const hasFocus = focusId != null && Number.isFinite(+focusId);
  let startIndex = 0;
  if (hasFocus) {
    const pinned = container.querySelector(`.feed-item[data-video-id="${+focusId}"]`);
    if (pinned) {
      startIndex = parseInt(pinned.dataset.index, 10) || 0;
      container.scrollTop = pinned.offsetTop;
    }
  }

  activateIndex(container, startIndex);

  if (hasFocus) {
    const startVideo = _feedVideos[startIndex];
    if (startVideo && location.pathname !== "/shorts/" + startVideo.id) {
      setHash("shorts/" + startVideo.id, { replace: true });
    }
  }
}

const DOUBLE_TAP_MS = 300;
let _lastTapTime = 0;
let _lastTapItem = null;
let _singleTapTimer = null;

function spawnHeartBurst(item, x, y){
  const rect = item.getBoundingClientRect();
  const relX = x - rect.left;
  const relY = y - rect.top;
  const offsets = [
    { dx: 0, dy: 0, delay: 0 },
    { dx: -18, dy: -12, delay: 40 },
    { dx: 18, dy: -24, delay: 80 }
  ];
  offsets.forEach(({ dx, dy, delay }) => {
    setTimeout(() => {
      if(!item.isConnected) return;
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
  void badge.offsetWidth;
  badge.classList.add("show");
  setTimeout(() => badge.classList.remove("show"), 650);
}

function togglePlayback(item){
  const videoEl = item && item.querySelector(".feed-video");
  if(!videoEl) return;
  if(videoEl.paused){
    delete videoEl.dataset.userPaused;
    const p = playVideo(videoEl);
    if(p && p.then) p.then(() => showPlaybackBadge(item, "▶"), () => {});
    else showPlaybackBadge(item, "▶");
  } else {
    videoEl.dataset.userPaused = "1";
    videoEl.pause();
    showPlaybackBadge(item, "⏸");
  }
}

function isLiked(videoId){
  const L = vstate.live[videoId];
  return ((L && L.myVote) || storedVoteFor(videoId)) === "like";
}

function onFeedPointerUp(e){
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (e.target.closest("[data-action], .feed-sidebar, .feed-creator-row, .feed-category, .feed-comments-drawer")) return;
  const item = e.target.closest(".feed-item");
  if (!item) return;

  const now = Date.now();
  const isDoubleTap = item === _lastTapItem && (now - _lastTapTime) < DOUBLE_TAP_MS;

  if (isDoubleTap) {
    clearTimeout(_singleTapTimer);
    _singleTapTimer = null;
    _lastTapTime = 0;
    _lastTapItem = null;
    const videoId = parseInt(item.dataset.videoId, 10);
    if (Number.isFinite(videoId)) {
      // Double-tap only ever likes (never un-likes), matching IG/TikTok.
      if (!isLiked(videoId)) likeVideo(videoId);
      spawnHeartBurst(item, e.clientX, e.clientY);
      if (navigator.vibrate) navigator.vibrate(20);
    }
  } else {
    _lastTapTime = now;
    _lastTapItem = item;
    clearTimeout(_singleTapTimer);
    _singleTapTimer = setTimeout(() => {
      _singleTapTimer = null;
      togglePlayback(item);
    }, DOUBLE_TAP_MS);
  }
}

function findVideo(videoId){
  return _feedVideos.find((x) => x.id === videoId) || DATA.videos.find((x) => x.id === videoId);
}

function refreshFeedComments(v){
  const drawer = document.getElementById("feedCommentsDrawer");
  const body = document.getElementById("feedCommentsBody");
  if (body && drawer && drawer.classList.contains("open") && drawer.dataset.videoId === String(v.id)) {
    body.innerHTML = renderCommentList(v);
  }
  const label = document.getElementById(`feedComment_${v.id}`);
  if (label) label.textContent = String(commentsFor(v).length);
}

function openFeedComments(videoId) {
  videoId = +videoId;
  const drawer = document.getElementById("feedCommentsDrawer");
  const backdrop = document.getElementById("feedCommentsBackdrop");
  const body = document.getElementById("feedCommentsBody");
  const footer = document.getElementById("feedCommentsFooter");
  if (!drawer || !body || !footer) return;

  const v = findVideo(videoId);
  if (!v) return;

  drawer.dataset.videoId = String(v.id);
  body.innerHTML = renderCommentList(v);
  footer.innerHTML = `
    <input class="fld" id="feedCbox" placeholder="Add a comment…" autocomplete="off" enterkeyhint="send" aria-label="Add a comment"/>
    <button type="button" class="btn" data-action="postComment" data-video="${v.id}">Post</button>
  `;
  const cbox = footer.querySelector("#feedCbox");
  if (cbox) {
    cbox.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.isComposing) {
        ev.preventDefault();
        submitFeedComment(v.id);
      }
    });
  }

  drawer.classList.add("open");
  if (backdrop) backdrop.classList.add("show");
  hydrateFeedComments(v).catch(() => {});
  // Auto-focus only with a fine pointer: on touch it pops the keyboard over the list.
  if (cbox && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    requestAnimationFrame(() => {
      try { cbox.focus({ preventScroll: true }); } catch (_) { cbox.focus(); }
    });
  }
}

function closeFeedComments() {
  const drawer = document.getElementById("feedCommentsDrawer");
  const backdrop = document.getElementById("feedCommentsBackdrop");
  if (drawer) {
    drawer.classList.remove("open");
    const active = document.activeElement;
    if (active && drawer.contains(active)) active.blur();
  }
  if (backdrop) backdrop.classList.remove("show");
}

const _voteHydrated = new Set();
async function hydrateFeedVote(v) {
  if (!v || !ShAPI || !ShAPI.enabled || _voteHydrated.has(v.id)) return;
  _voteHydrated.add(v.id);
  const L = vstate.live[v.id] = vstate.live[v.id] || { like: 0, dislike: 0 };
  const before = L.myVote || null;
  try {
    const [counts, mine] = await Promise.all([ShAPI.likeCounts(v.id), ShAPI.myVote(v.id)]);
    if ((L.myVote || null) !== before) return;
    L.like = counts.like || 0;
    L.dislike = counts.dislike || 0;
    L.myVote = mine || storedVoteFor(v.id);
    writeStoredVote(v.id, L.myVote);
    patchVoteUi(v, L);
  } catch (_) {
    _voteHydrated.delete(v.id);
  }
}

async function hydrateFeedComments(v) {
  if (!ShAPI || !ShAPI.enabled || !v) return;
  try {
    const rows = await ShAPI.listComments(v.id);
    if (!rows || !rows.length) return;
    const known = new Set();
    for (const m of DATA.comments) known.add(m.id);
    let added = false;
    for (const c of rows) {
      const key = "db" + c.id;
      if (known.has(key)) continue;
      known.add(key);
      added = true;
      // TODO(invariant): DATA mutation — move to a vstate.live overlay once comments.js/commentsFor() reads one.
      DATA.comments.push({
        id: key,
        video: v.id,
        user: c.author,
        text: c.body,
        time: "",
        ts: Date.parse(c.created_at) || 0,
      });
    }
    if (added) refreshFeedComments(v);
  } catch (_) { /* offline / API down */ }
}

function submitFeedComment(videoId) {
  videoId = +videoId;
  const box = document.getElementById("feedCbox");
  if (!box) return;
  const bodyVal = (box.value || "").trim();
  if (!bodyVal) return;
  let result;
  try {
    result = addComment(videoId, bodyVal);
  } catch (e) {
    console.error("Failed to post comment", e);
    return;
  }
  box.value = "";
  Promise.resolve(result).then(
    () => { const v = findVideo(videoId); if (v) refreshFeedComments(v); },
    (e) => {
      console.error("Failed to post comment", e);
      if (box.isConnected && !box.value) box.value = bodyVal;
    }
  );
}

if (typeof window !== "undefined") {
  window.toggleFeedMute = toggleFeedMute;
  window.openFeedComments = openFeedComments;
  window.closeFeedComments = closeFeedComments;
  window.submitFeedComment = submitFeedComment;
}