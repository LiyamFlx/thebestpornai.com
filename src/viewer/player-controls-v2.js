/* Controller for the redesigned watch-page player overlay (.player-overlay-v2)
   and its surrounding chrome: tabs, sheets (share/settings/save), Up Next
   category filter, description expand/collapse, PiP, theater mode, real
   playback-speed/mute/seek wiring, and auto-advance to the next Up Next
   video on end. Re-attached on every render() since the player element is
   recreated on each innerHTML swap. Supersedes the old player-controls.js
   (.pc-bar) — the redesign's own overlay is now the only control surface. */
import { vstate, persistState } from "./state.js";
import { openVideo, download } from "./actions.js";

function fmtTime(s){
  if(!isFinite(s) || s < 0) return "0:00";
  s = Math.floor(s);
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  const mm = h ? String(m).padStart(2,"0") : String(m);
  return (h ? h+":" : "") + mm + ":" + String(sec).padStart(2,"0");
}

let hideTimer = null;
let advanceTimer = null;
let advanceOverlay = null;
function clearAutoHide(){ clearTimeout(hideTimer); hideTimer = null; }
function clearAutoAdvance(){
  if(advanceTimer) cancelAnimationFrame(advanceTimer);
  advanceTimer = null;
  if(advanceOverlay){ advanceOverlay.remove(); advanceOverlay = null; }
}

export function attachPlayerControlsV2(){
  clearAutoHide();
  clearAutoAdvance();

  const overlay = document.getElementById("playerOverlayV2");
  const wrap = document.querySelector(".player-nav-wrap .player-wrap");
  const video = wrap && wrap.querySelector("video.player");
  if(!overlay || !wrap || !video) return;

  const playBtn = document.getElementById("playPauseBtnV2");
  const playIcon = document.getElementById("playIconV2");
  const playIconSmall = document.getElementById("playIconSmallV2");
  const seek = document.getElementById("ovSeek");
  const currentTimeEl = document.getElementById("ovCurrentTime");
  const durationEl = document.getElementById("ovDuration");
  const muteBtn = document.getElementById("ovMuteBtn");
  const volumeIcon = document.getElementById("ovVolumeIcon");
  const volumeSlider = document.getElementById("ovVolume");

  video.playbackRate = vstate.settings.playbackRate || 1;
  video.volume = vstate.settings.volume ?? 0.5;
  video.muted = !!vstate.settings.muted;
  if(volumeSlider) volumeSlider.value = video.muted ? 0 : video.volume;

  const setPlayIcon = () => {
    const use = video.paused ? '<use href="#icon-play"/>' : '<use href="#icon-pause"/>';
    if(playIcon) playIcon.innerHTML = use;
    if(playIconSmall) playIconSmall.innerHTML = use;
    if(playBtn) playBtn.setAttribute("aria-label", video.paused ? "Play" : "Pause");
  };
  const setMuteIcon = () => {
    if(!volumeIcon) return;
    volumeIcon.innerHTML = (video.muted || video.volume===0) ? '<use href="#icon-mute"/>' : '<use href="#icon-unmute"/>';
    if(muteBtn) muteBtn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
  };
  setPlayIcon(); setMuteIcon();

  video.addEventListener("play", setPlayIcon);
  video.addEventListener("pause", setPlayIcon);

  window.togglePlayPauseV2 = () => {
    if(video.paused || video.ended) video.play().catch(()=>{});
    else video.pause();
  };
  window.skipTime = (secs) => {
    if(!isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(video.currentTime + secs, 0), video.duration);
  };
  window.toggleMuteV2 = () => {
    video.muted = !video.muted;
    if(!video.muted && video.volume===0) video.volume = 0.5;
    if(volumeSlider) volumeSlider.value = video.muted ? 0 : video.volume;
    setMuteIcon();
    vstate.settings.muted = video.muted;
    vstate.settings.volume = video.volume;
    persistState();
  };

  let seeking = false;
  const SEEK_MAX = 1000;
  if(seek){
    seek.addEventListener("input", () => { seeking = true; });
    seek.addEventListener("change", () => {
      if(isFinite(video.duration)) video.currentTime = (seek.value/SEEK_MAX) * video.duration;
      seeking = false;
    });
  }
  if(volumeSlider){
    volumeSlider.addEventListener("input", () => {
      video.volume = +volumeSlider.value;
      video.muted = +volumeSlider.value === 0;
      setMuteIcon();
      vstate.settings.muted = video.muted;
      vstate.settings.volume = video.volume;
      persistState();
    });
  }

  video.addEventListener("timeupdate", () => {
    if(!isFinite(video.duration)) return;
    if(seek && !seeking) seek.value = String((video.currentTime/video.duration) * SEEK_MAX);
    if(currentTimeEl) currentTimeEl.textContent = fmtTime(video.currentTime);
    if(durationEl) durationEl.textContent = fmtTime(video.duration);
  });
  video.addEventListener("loadedmetadata", () => {
    if(durationEl) durationEl.textContent = fmtTime(video.duration);
  });

  // PiP — real browser Picture-in-Picture API.
  const pipBtn = document.getElementById("pipBtn");
  const pipIcon = document.getElementById("pipIcon");
  const pipSupported = document.pictureInPictureEnabled && !video.disablePictureInPicture;
  if(pipBtn){
    if(!pipSupported) pipBtn.style.display = "none";
    else {
      window.togglePiP = async () => {
        try {
          if(document.pictureInPictureElement) await document.exitPictureInPicture();
          else await video.requestPictureInPicture();
        } catch(_){}
      };
      video.addEventListener("enterpictureinpicture", () => { if(pipIcon) pipIcon.innerHTML = '<use href="#icon-expand"/>'; });
      video.addEventListener("leavepictureinpicture", () => { if(pipIcon) pipIcon.innerHTML = '<use href="#icon-compress"/>'; });
    }
  }

  window.toggleFullscreenV2 = () => {
    const target = wrap.closest(".player-container-v2") || wrap;
    if(!document.fullscreenElement) target.requestFullscreen?.().catch(()=>{});
    else document.exitFullscreen?.().catch(()=>{});
  };

  // Theater mode (desktop only): widen the content column.
  const theaterBtn = document.getElementById("theaterBtn");
  if(theaterBtn){
    window.toggleTheaterMode = () => {
      vstate.theaterMode = !vstate.theaterMode;
      const container = document.getElementById("watchDesktopContainer");
      if(container) container.classList.toggle("theater", vstate.theaterMode);
    };
    const container = document.getElementById("watchDesktopContainer");
    if(container) container.classList.toggle("theater", vstate.theaterMode);
  }

  // Auto-hide overlay after idle, only while playing (mirrors player-controls.js).
  const show = () => {
    overlay.classList.add("visible");
    clearAutoHide();
    if(!video.paused) hideTimer = setTimeout(() => overlay.classList.remove("visible"), 3000);
  };
  wrap.addEventListener("mousemove", show);
  wrap.addEventListener("touchstart", show, { passive:true });
  overlay.addEventListener("mouseenter", () => clearAutoHide());
  overlay.addEventListener("mouseleave", show);
  video.addEventListener("pause", () => overlay.classList.add("visible"));
  video.addEventListener("click", () => window.togglePlayPauseV2());
  show();

  attachAutoAdvance(overlay, video);
}

/* "Up next" indicator: on video end, auto-advance to the first Up Next card
   after a 5s countdown (YouTube/Netflix pattern) — without this, every
   watch session dead-ends and needs a manual click. Centered card over the
   final frame (thumbnail + title + countdown ring), with an explicit Cancel
   action rather than "tap anywhere to dismiss". */
function attachAutoAdvance(overlay, video){
  if(!vstate.settings.autoplay) return;
  const nextCard = document.querySelector(".upnext-card[data-video-id]");
  if(!nextCard) return;
  const nextId = +nextCard.dataset.videoId;
  if(!Number.isFinite(nextId)) return;
  const { title = "", creator = "", thumb = "" } = nextCard.dataset;

  const DURATION_MS = 5000;
  const RADIUS = 20;
  const CIRC = 2 * Math.PI * RADIUS;

  video.addEventListener("ended", () => {
    if(advanceOverlay) return;
    advanceOverlay = document.createElement("div");
    advanceOverlay.className = "pc-upnext";
    advanceOverlay.innerHTML = `
      <div class="pc-upnext-card">
        <div class="pc-upnext-thumb">
          ${thumb ? `<img src="${thumb}" alt="" loading="eager"/>` : ``}
          <svg class="pc-upnext-ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle class="pc-upnext-ring-track" cx="24" cy="24" r="${RADIUS}"/>
            <circle class="pc-upnext-ring-fill" cx="24" cy="24" r="${RADIUS}"
              stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
          </svg>
          <svg class="pc-upnext-play ico" aria-hidden="true"><use href="#icon-play"/></svg>
        </div>
        <div class="pc-upnext-info">
          <p class="pc-upnext-label">Up next <span class="pc-upnext-count">5</span>s</p>
          <h3 class="pc-upnext-title">${title}</h3>
          ${creator ? `<p class="pc-upnext-creator">${creator}</p>` : ``}
        </div>
        <button type="button" class="pc-upnext-cancel" aria-label="Cancel autoplay of next video">Cancel</button>
      </div>`;
    overlay.appendChild(advanceOverlay);

    const ringFill = advanceOverlay.querySelector(".pc-upnext-ring-fill");
    const countEl = advanceOverlay.querySelector(".pc-upnext-count");
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const remaining = Math.max(0, DURATION_MS - elapsed);
      if(ringFill) ringFill.style.strokeDashoffset = String(CIRC * (1 - elapsed / DURATION_MS));
      if(countEl) countEl.textContent = String(Math.ceil(remaining / 1000));
      if(elapsed >= DURATION_MS){ advanceTimer = null; openVideo(nextId); return; }
      advanceTimer = requestAnimationFrame(tick);
    };
    advanceTimer = requestAnimationFrame(tick);

    advanceOverlay.querySelector(".pc-upnext-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      clearAutoAdvance();
    });
    advanceOverlay.querySelector(".pc-upnext-card").addEventListener("click", () => {
      clearAutoAdvance();
      openVideo(nextId);
    });
  });
}

/* ---- Tabs (mobile only — desktop has no tabs, both sections always render) ---- */
export function switchWatchTab(tab){
  vstate.watchTab = tab;
  const upnext = document.getElementById("tabPanelUpNext");
  const comments = document.getElementById("tabPanelComments");
  const tabUp = document.getElementById("tab-upnext");
  const tabC = document.getElementById("tab-comments");
  if(upnext) upnext.hidden = tab !== "upnext";
  if(comments) comments.hidden = tab !== "comments";
  if(tabUp) tabUp.classList.toggle("active", tab === "upnext");
  if(tabC) tabC.classList.toggle("active", tab === "comments");
}

/* ---- Up Next category filter ---- */
export function filterUpNext(category){
  document.querySelectorAll("[data-upnext-cat]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.upnextCat === category);
  });
  document.querySelectorAll(".upnext-card").forEach(card => {
    if(!category){ card.style.display = ""; return; }
    // Category isn't in the DOM per-card; re-derive from the data attribute
    // set alongside data-video-id at render time isn't available here, so we
    // filter by matching the chip's category against a data attribute we add
    // to each card below (see upNextCard in watch.js — data-category).
    card.style.display = card.dataset.category === category ? "" : "none";
  });
}

/* ---- Sheets (share / settings / save) ---- */
export function openShareSheet(){ document.getElementById("shareSheet")?.removeAttribute("hidden"); }
export function openSettingsSheet(){ document.getElementById("settingsSheet")?.removeAttribute("hidden"); }
export function openSaveSheet(){ document.getElementById("saveSheet")?.removeAttribute("hidden"); }
export function closeSheet(id){ document.getElementById(id)?.setAttribute("hidden", ""); }

export function changeSpeedV2(val){
  const rate = parseFloat(val);
  vstate.settings.playbackRate = rate;
  const video = document.querySelector(".player-nav-wrap .player-wrap video.player");
  if(video) video.playbackRate = rate;
  const label = document.getElementById("ovSpeedLabel");
  if(label) label.textContent = rate + "x";
  closeSheet("settingsSheet");
  persistState();
}

export function copyVideoLinkV2(id){
  const url = location.href.split("#")[0] + "#video/" + id;
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>window.toast("Link copied"), ()=>window.toast("Link: "+url));
  else window.toast("Link: "+url);
  closeSheet("shareSheet");
}

export function copyEmbedCodeV2(id){
  const url = location.origin + "/viewer/index.html#video/" + id;
  const code = `<iframe src="${url}" frameborder="0" allowfullscreen></iframe>`;
  if(navigator.clipboard) navigator.clipboard.writeText(code).then(()=>window.toast("Embed code copied"), ()=>window.toast("Embed copy failed"));
  else window.toast("Embed copy failed");
  closeSheet("shareSheet");
}

export async function downloadWithFeedback(id){
  const icon = document.getElementById("downloadIcon");
  const text = document.getElementById("downloadText");
  if(icon) icon.innerHTML = '<use href="#icon-download"/>';
  if(text) text.textContent = "Downloading…";
  const btn = document.getElementById("downloadBtn");
  if(btn) btn.classList.add("downloading");
  await download(id);
  if(text) text.textContent = "Downloaded";
  if(btn) btn.classList.remove("downloading");
  setTimeout(() => { if(text) text.textContent = "Download"; }, 2500);
}

/* ---- Description expand/collapse ---- */
export function toggleDescSheetMobile(){
  const box = document.getElementById("quickDescBox");
  const chevron = document.getElementById("descChevron");
  if(!box) return;
  const willShow = box.hasAttribute("hidden");
  if(willShow) box.removeAttribute("hidden"); else box.setAttribute("hidden","");
  if(chevron) chevron.classList.toggle("flipped", willShow);
}

export function toggleDescExpandDesktop(){
  const text = document.getElementById("descTextV2");
  const expandText = document.getElementById("descExpandText");
  const chevron = document.getElementById("descChevronDesktop");
  const extra = document.getElementById("descExtraDetails");
  if(!text) return;
  const wasClamped = text.classList.contains("clamped");
  const nowExpanded = wasClamped; // clamped -> expanding; not-clamped -> collapsing
  text.classList.toggle("clamped", !nowExpanded);
  if(chevron) chevron.classList.toggle("flipped", nowExpanded);
  if(extra){ if(nowExpanded) extra.removeAttribute("hidden"); else extra.setAttribute("hidden",""); }
  if(expandText) expandText.textContent = nowExpanded ? "Show Less" : "Show More";
}
