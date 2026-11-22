/* Watch-page player overlay (.player-overlay-v2) + chrome: tabs, sheets, Up Next filter, description,
   PiP, theater, speed/mute/seek, end card / auto-advance. Re-attached on every render(); idempotent per player. */
import { vstate, persistState } from "./state.js";
import { openVideo, download } from "./actions.js";

const PLAYER_SEL = ".player-nav-wrap .player-wrap video.player";
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SHEET_IDS = ["shareSheet", "settingsSheet", "saveSheet"];

function fmtTime(s){
  if(!isFinite(s) || s < 0) return "0:00";
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? h + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
}

function toastMsg(msg){
  if(typeof window.toast === "function") window.toast(msg);
}

let hideTimer = null;
let advanceTimer = null;
let advanceOverlay = null;
let advanceNextId = null;
let boundVideo = null;
let boundOverlay = null;
let persistTimer = null;

function clearAutoHide(){ clearTimeout(hideTimer); hideTimer = null; }
function clearAutoAdvance(){
  if(advanceTimer) cancelAnimationFrame(advanceTimer);
  advanceTimer = null;
  advanceNextId = null;
  if(advanceOverlay){ advanceOverlay.remove(); advanceOverlay = null; }
}

function persistSoon(){
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { persistTimer = null; persistState(); }, 250);
}

/* First visible Up Next card not watched recently (category filter respected), else any visible non-current. */
function pickNext(){
  const visibleCards = [...document.querySelectorAll(".upnext-card[data-video-id]")].filter((c) => c.style.display !== "none");
  if(!visibleCards.length) return null;
  const recentIds = new Set((vstate.history || []).slice(0, 8));
  const currentId = vstate.current?.id;
  const candidate =
    visibleCards.find((c) => { const id = +c.dataset.videoId; return Number.isFinite(id) && id !== currentId && !recentIds.has(id); }) ||
    visibleCards.find((c) => { const id = +c.dataset.videoId; return Number.isFinite(id) && id !== currentId; });
  if(!candidate) return null;
  return {
    id: +candidate.dataset.videoId,
    title: candidate.dataset.title || "Next video",
    creator: candidate.dataset.creator || "",
    thumb: candidate.dataset.thumb || "",
  };
}

function goNext(){
  const id = advanceNextId ?? pickNext()?.id ?? null;
  clearAutoAdvance();
  if(id != null) openVideo(id);
  else window.stepWatch?.(1);
}

function lockLandscapeIfWide(video){
  if(!(video.videoWidth > video.videoHeight)) return;
  try { screen.orientation?.lock?.("landscape")?.catch?.(() => {}); } catch(_){}
}

if(typeof document !== "undefined" && !window.__pcV2GlobalBound){
  window.__pcV2GlobalBound = true;
  const onFsChange = () => {
    if(!(document.fullscreenElement || document.webkitFullscreenElement)){
      try { screen.orientation?.unlock?.(); } catch(_){}
    }
  };
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  document.addEventListener("keydown", (e) => {
    if(e.key !== "Escape") return;
    const open = SHEET_IDS.map((id) => document.getElementById(id)).find((el) => el && !el.hasAttribute("hidden"));
    if(open){ e.preventDefault(); closeSheet(open.id); }
  });
}

export function attachPlayerControlsV2(){
  const overlay = document.getElementById("playerOverlayV2");
  const wrap = document.querySelector(".player-nav-wrap .player-wrap");
  const video = wrap && wrap.querySelector("video.player");

  // Same player still mounted (render() didn't recreate it): re-binding would stack listeners and restart playback.
  if(video && overlay && video === boundVideo && overlay === boundOverlay && video.isConnected) return;

  clearAutoHide();
  clearAutoAdvance();
  boundVideo = null;
  boundOverlay = null;
  if(!overlay || !wrap || !video) return;
  boundVideo = video;
  boundOverlay = overlay;

  const playBtn = document.getElementById("playPauseBtnV2");
  const playIcon = document.getElementById("playIconV2");
  const playIconSmall = document.getElementById("playIconSmallV2");
  const seek = document.getElementById("ovSeek");
  const currentTimeEl = document.getElementById("ovCurrentTime");
  const durationEl = document.getElementById("ovDuration");
  const muteBtn = document.getElementById("ovMuteBtn");
  const volumeIcon = document.getElementById("ovVolumeIcon");
  const volumeSlider = document.getElementById("ovVolume");
  const speedLabel = document.getElementById("ovSpeedLabel");
  const container = wrap.closest(".player-container-v2") || wrap;
  const SEEK_MAX = 1000;
  let seeking = false;

  const rate = SPEEDS.includes(+vstate.settings.playbackRate) ? +vstate.settings.playbackRate : 1;
  video.playbackRate = rate;
  if(speedLabel) speedLabel.textContent = rate + "x";
  const storedVol = Number(vstate.settings.volume);
  video.volume = Number.isFinite(storedVol) ? Math.min(1, Math.max(0, storedVol)) : 0.5;

  const setPlayIcon = () => {
    const use = video.paused ? '<use href="#icon-play"/>' : '<use href="#icon-pause"/>';
    if(playIcon) playIcon.innerHTML = use;
    if(playIconSmall) playIconSmall.innerHTML = use;
    if(playBtn) playBtn.setAttribute("aria-label", video.paused ? "Play" : "Pause");
  };
  const syncVolumeUi = () => {
    const silent = video.muted || video.volume === 0;
    if(volumeSlider) volumeSlider.value = video.muted ? 0 : video.volume;
    if(volumeIcon) volumeIcon.innerHTML = silent ? '<use href="#icon-mute"/>' : '<use href="#icon-unmute"/>';
    if(muteBtn){
      muteBtn.setAttribute("aria-label", silent ? "Unmute" : "Mute");
      muteBtn.setAttribute("aria-pressed", String(silent));
    }
  };
  const storeVolume = () => {
    vstate.settings.muted = video.muted;
    vstate.settings.volume = video.volume;
  };
  const syncTime = () => {
    if(!isFinite(video.duration)) return;
    if(seek && !seeking) seek.value = String((video.currentTime / video.duration) * SEEK_MAX);
    if(currentTimeEl) currentTimeEl.textContent = fmtTime(video.currentTime);
    if(durationEl) durationEl.textContent = fmtTime(video.duration);
  };

  // Unmuted autoplay needs a prior gesture; unmuting without one pauses the element. Start muted, unmute once playing.
  const canUnmute = () => {
    try {
      if(navigator.userActivation && typeof navigator.userActivation.hasBeenActive === "boolean"){
        return navigator.userActivation.hasBeenActive;
      }
    } catch(_){}
    return false;
  };
  video.muted = true;
  if(!vstate.settings.muted){
    video.addEventListener("playing", () => {
      if(canUnmute()){ try { video.muted = false; } catch(_){} }
      syncVolumeUi();
    }, { once: true });
  }
  video.play?.()?.catch?.(() => {});

  setPlayIcon();
  syncVolumeUi();
  video.addEventListener("play", setPlayIcon);
  video.addEventListener("pause", setPlayIcon);

  const triggerSeekRipple = (secs) => {
    const isForward = secs > 0;
    wrap.querySelector(".seek-ripple")?.remove();
    const ripple = document.createElement("div");
    ripple.className = `seek-ripple ${isForward ? "forward" : "rewind"}`;
    ripple.innerHTML = `<span class="seek-ripple-icon">${isForward ? "▶▶" : "◀◀"}</span><span class="seek-ripple-text">${isForward ? "+" : "-"}${Math.abs(secs)}s</span>`;
    wrap.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  };

  window.togglePlayPauseV2 = () => {
    if(advanceOverlay){ goNext(); return; }
    if(video.paused || video.ended) video.play().catch(() => {});
    else video.pause();
  };

  window.skipTime = (secs) => {
    if(advanceOverlay){
      if(secs > 0){ goNext(); return; }
      clearAutoAdvance();
      if(isFinite(video.duration)){
        video.currentTime = Math.max(0, video.duration + secs);
        video.play().catch(() => {});
      }
      return;
    }
    if(!isFinite(video.duration)) return;
    if(secs > 0 && video.currentTime + secs >= video.duration - 0.25){
      triggerSeekRipple(secs);
      // Autoplay on: jump straight to next. Off: land on the end card instead of navigating unasked.
      if(vstate.settings.autoplay) goNext();
      else video.currentTime = video.duration;
      return;
    }
    video.currentTime = Math.min(Math.max(video.currentTime + secs, 0), video.duration);
    triggerSeekRipple(secs);
  };

  window.seekToPercent = (pct) => {
    if(!isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max((pct / 100) * video.duration, 0), video.duration);
  };

  window.stepSpeed = (delta) => {
    const current = video.playbackRate || 1;
    const next = delta > 0
      ? (SPEEDS.find((r) => r > current) ?? SPEEDS[SPEEDS.length - 1])
      : (SPEEDS.slice().reverse().find((r) => r < current) ?? SPEEDS[0]);
    changeSpeedV2(next);
    toastMsg(next + "x speed");
  };

  window.toggleMuteV2 = () => {
    video.muted = !video.muted;
    if(!video.muted && video.volume === 0) video.volume = 0.5;
    syncVolumeUi();
    storeVolume();
    persistSoon();
  };

  // Rounded so repeated 0.05 steps actually reach 0 (float drift left it at ~1e-17, never muting).
  window.adjustVolumeV2 = (delta) => {
    const base = video.muted ? 0 : video.volume;
    video.volume = Math.round(Math.min(1, Math.max(0, base + delta)) * 100) / 100;
    video.muted = video.volume === 0;
    syncVolumeUi();
    storeVolume();
    persistSoon();
  };

  if(seek){
    const endSeek = () => { seeking = false; };
    seek.addEventListener("input", () => {
      seeking = true;
      if(currentTimeEl && isFinite(video.duration)) currentTimeEl.textContent = fmtTime((seek.value / SEEK_MAX) * video.duration);
    });
    seek.addEventListener("change", () => {
      if(isFinite(video.duration)) video.currentTime = (seek.value / SEEK_MAX) * video.duration;
      endSeek();
    });
    seek.addEventListener("pointercancel", endSeek);
    seek.addEventListener("blur", endSeek);
  }
  if(volumeSlider){
    volumeSlider.addEventListener("input", () => {
      video.volume = +volumeSlider.value;
      video.muted = +volumeSlider.value === 0;
      syncVolumeUi();
      storeVolume();
    });
    volumeSlider.addEventListener("change", () => persistState());
  }

  video.addEventListener("timeupdate", syncTime);
  video.addEventListener("loadedmetadata", syncTime);
  video.addEventListener("durationchange", syncTime);
  if(video.readyState >= 1) syncTime();

  const pipBtn = document.getElementById("pipBtn");
  const pipIcon = document.getElementById("pipIcon");
  const pipSupported = document.pictureInPictureEnabled && !video.disablePictureInPicture;
  window.togglePiP = () => {};
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

  // iPhone Safari has no element Fullscreen API — only the <video>'s native webkitEnterFullscreen().
  window.toggleFullscreenV2 = () => {
    const target = container;
    if(typeof target.requestFullscreen !== "function" && typeof target.webkitRequestFullscreen !== "function"){
      if(typeof video.webkitEnterFullscreen === "function") video.webkitEnterFullscreen();
      return;
    }
    if(!(document.fullscreenElement || document.webkitFullscreenElement)){
      if(target.requestFullscreen) target.requestFullscreen().then(() => lockLandscapeIfWide(video), () => {});
      else { target.webkitRequestFullscreen(); lockLandscapeIfWide(video); }
    } else if(document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
  };

  const theaterBtn = document.getElementById("theaterBtn");
  window.toggleTheaterMode = () => {};
  if(theaterBtn){
    const applyTheater = () => {
      document.getElementById("watchDesktopContainer")?.classList.toggle("theater", !!vstate.theaterMode);
      theaterBtn.setAttribute("aria-pressed", String(!!vstate.theaterMode));
    };
    window.toggleTheaterMode = () => { vstate.theaterMode = !vstate.theaterMode; applyTheater(); };
    applyTheater();
  }

  // Auto-hide while playing; sticky while paused. Never cancel on overlay mouseenter (overlay covers the player).
  const isMobilePlayer = !!(window.matchMedia && window.matchMedia("(max-width:760px)").matches);
  const HIDE_MS = isMobilePlayer ? 3000 : 1400;
  const hide = () => {
    if(advanceOverlay) return;
    if(video.paused && !video.ended) return;
    if(container.contains(document.activeElement) && document.activeElement.matches?.(":focus-visible")) return;
    overlay.classList.remove("visible");
  };
  const show = (opts = {}) => {
    overlay.classList.add("visible");
    clearAutoHide();
    if(opts.sticky || video.paused) return;
    hideTimer = setTimeout(hide, HIDE_MS);
  };
  const isControl = (el) => !!el.closest("button, input, select, label, a, .pc-upnext");

  // Registered before the generic activity listener so a tap can tell whether chrome was hidden when it began.
  if(isMobilePlayer){
    let tracking = false, startedHidden = false;
    let touchStartX = 0, touchStartY = 0, touchStartT = 0, lastTapAt = 0, lastTapX = 0, tapGen = 0;
    const TAP_MS = 280, SWIPE_X = 56, SWIPE_Y_MAX = 48;
    container.addEventListener("touchstart", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      tracking = !!t && !isControl(e.target);
      if(!tracking) return;
      startedHidden = !overlay.classList.contains("visible");
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartT = Date.now();
    }, { passive: true });
    container.addEventListener("touchend", (e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if(!t || !tracking || isControl(e.target)) return;
      tracking = false;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if(Math.abs(dx) > SWIPE_X && Math.abs(dy) < SWIPE_Y_MAX && Date.now() - touchStartT < 500){
        tapGen++;
        window.stepWatch?.(dx < 0 ? 1 : -1);
        return;
      }
      if(Math.abs(dx) > 18 || Math.abs(dy) > 18) return;
      const now = Date.now();
      if(now - lastTapAt < TAP_MS && Math.abs(t.clientX - lastTapX) < 80){
        tapGen++;
        lastTapAt = 0;
        const rect = container.getBoundingClientRect();
        window.skipTime(t.clientX < rect.left + rect.width / 2 ? -10 : 10);
        show();
        return;
      }
      lastTapAt = now;
      lastTapX = t.clientX;
      const mine = ++tapGen;
      const revealOnly = startedHidden && !video.paused && !advanceOverlay;
      setTimeout(() => {
        if(mine !== tapGen) return;
        // First tap on hidden chrome only reveals it (YouTube/IG behaviour) instead of also pausing.
        if(!revealOnly) window.togglePlayPauseV2();
        show();
      }, TAP_MS);
    }, { passive: true });
  }

  const onActivity = () => show();
  container.addEventListener("mousemove", onActivity);
  container.addEventListener("touchstart", onActivity, { passive: true });
  container.addEventListener("mouseleave", () => { if(!video.paused){ clearAutoHide(); hide(); } });
  container.addEventListener("focusin", (e) => { if(e.target.matches?.(":focus-visible")) show({ sticky: true }); });
  container.addEventListener("focusout", () => show());
  for(const el of [seek, volumeSlider]){
    if(!el) continue;
    el.addEventListener("pointerdown", () => show({ sticky: true }));
    el.addEventListener("pointerup", () => show());
  }
  video.addEventListener("play", () => show());
  video.addEventListener("pause", () => show({ sticky: true }));
  video.addEventListener("click", (e) => {
    if(e.target !== video || isMobilePlayer) return;
    window.togglePlayPauseV2();
    show();
  });
  video.addEventListener("dblclick", (e) => {
    if(e.target !== video || isMobilePlayer) return;
    window.toggleFullscreenV2();
  });

  show();
  attachAutoAdvance(overlay, video, container);
}

/* End card: next preview + countdown + Cancel / Play now (autoplay on), or Replay / Play next (off). */
function attachAutoAdvance(overlay, video, mount){
  const DURATION_MS = 5000;
  const RADIUS = 22;
  const CIRC = 2 * Math.PI * RADIUS;

  window.cancelUpNextAdvance = () => {
    clearAutoAdvance();
    overlay.classList.add("visible");
  };
  window.playUpNextNow = (id) => {
    clearAutoAdvance();
    openVideo(+id);
  };

  video.addEventListener("ended", () => {
    if(advanceOverlay) return;
    const next = pickNext();
    if(!next) return;
    const autoplayOn = !!vstate.settings.autoplay;

    advanceOverlay = document.createElement("div");
    advanceOverlay.className = "pc-upnext";
    advanceOverlay.setAttribute("role", "dialog");
    advanceOverlay.setAttribute("aria-label", autoplayOn ? "Next video starting soon" : "Video ended");
    advanceOverlay.innerHTML = `
      <div class="pc-upnext-card">
        <div class="pc-upnext-thumb pc-upnext-thumb-ph" aria-hidden="true"></div>
        <div class="pc-upnext-info">
          <div class="pc-upnext-kicker">${autoplayOn ? "Up next" : "Suggested next"}</div>
          <div class="pc-upnext-title"></div>
          <div class="pc-upnext-creator"></div>
          ${autoplayOn ? `
          <div class="pc-upnext-countdown-row">
            <svg class="pc-upnext-ring" viewBox="0 0 48 48" aria-hidden="true">
              <circle class="pc-upnext-ring-track" cx="24" cy="24" r="${RADIUS}"/>
              <circle class="pc-upnext-ring-fill" cx="24" cy="24" r="${RADIUS}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
            </svg>
            <span class="pc-upnext-count-label">Playing in <b id="pcUpNextSecs">5</b>s</span>
          </div>` : ""}
          <div class="pc-upnext-actions">
            ${autoplayOn
              ? `<button type="button" class="pc-upnext-btn ghost" id="pcUpNextCancel">Cancel</button>
                 <button type="button" class="pc-upnext-btn primary" id="pcUpNextPlay">Play now</button>`
              : `<button type="button" class="pc-upnext-btn ghost" id="pcUpNextReplay">Replay</button>
                 <button type="button" class="pc-upnext-btn primary" id="pcUpNextPlay">Play next</button>`}
          </div>
        </div>
      </div>`;
    // Catalog strings go in via DOM properties, never interpolated markup.
    advanceOverlay.querySelector(".pc-upnext-title").textContent = next.title;
    advanceOverlay.querySelector(".pc-upnext-creator").textContent = next.creator;
    if(next.thumb){
      const img = document.createElement("img");
      img.className = "pc-upnext-thumb";
      img.alt = "";
      img.decoding = "async";
      img.src = next.thumb;
      advanceOverlay.querySelector(".pc-upnext-thumb-ph").replaceWith(img);
    }

    advanceNextId = next.id;
    mount.appendChild(advanceOverlay);
    overlay.classList.remove("visible");

    advanceOverlay.querySelector(".pc-upnext-card").addEventListener("click", (e) => {
      if(e.target.closest("#pcUpNextCancel, #pcUpNextReplay")) return;
      e.stopPropagation();
      window.playUpNextNow(next.id);
    });
    advanceOverlay.querySelector("#pcUpNextCancel")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.cancelUpNextAdvance();
    });
    advanceOverlay.querySelector("#pcUpNextReplay")?.addEventListener("click", (e) => {
      e.stopPropagation();
      clearAutoAdvance();
      video.currentTime = 0;
      video.play?.()?.catch?.(() => {});
      overlay.classList.add("visible");
    });
    try { advanceOverlay.querySelector("#pcUpNextPlay")?.focus({ preventScroll: true }); } catch(_){}

    if(!autoplayOn) return;

    const ringFill = advanceOverlay.querySelector(".pc-upnext-ring-fill");
    const secsEl = advanceOverlay.querySelector("#pcUpNextSecs");
    let elapsed = 0, last = performance.now(), shownSecs = 5;
    // Delta-capped: rAF halts in background tabs, so returning resumes the countdown rather than firing instantly.
    const tick = (now) => {
      if(!advanceOverlay) return;
      elapsed += Math.min(Math.max(0, now - last), 100);
      last = now;
      if(ringFill) ringFill.style.strokeDashoffset = String(CIRC * Math.min(1, elapsed / DURATION_MS));
      const secs = Math.ceil(Math.max(0, DURATION_MS - elapsed) / 1000);
      if(secsEl && secs !== shownSecs){ shownSecs = secs; secsEl.textContent = String(secs); }
      if(elapsed >= DURATION_MS){
        advanceTimer = null;
        goNext();
        return;
      }
      advanceTimer = requestAnimationFrame(tick);
    };
    advanceTimer = requestAnimationFrame(tick);
  });
}

/* ---- Tabs (mobile only) ---- */
export function switchWatchTab(tab){
  vstate.watchTab = tab;
  const panels = { upnext: "tabPanelUpNext", comments: "tabPanelComments" };
  const tabs = { upnext: "tab-upnext", comments: "tab-comments" };
  for(const key of Object.keys(panels)){
    const on = key === tab;
    const panel = document.getElementById(panels[key]);
    const btn = document.getElementById(tabs[key]);
    if(panel) panel.hidden = !on;
    if(btn){
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", String(on));
    }
  }
}

/* ---- Up Next category filter (cards carry data-category from upNextCard in watch.js) ---- */
export function filterUpNext(category){
  document.querySelectorAll("[data-upnext-cat]").forEach((btn) => {
    const on = btn.dataset.upnextCat === category;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll(".upnext-card").forEach((card) => {
    card.style.display = !category || card.dataset.category === category ? "" : "none";
  });
}

/* ---- Sheets (share / settings / save) ---- */
let _sheetOpener = null;
function openSheet(id){
  const el = document.getElementById(id);
  if(!el) return;
  _sheetOpener = document.activeElement;
  el.removeAttribute("hidden");
  const first = el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  try { first?.focus({ preventScroll: true }); } catch(_){}
}
export function openShareSheet(){ openSheet("shareSheet"); }
export function openSettingsSheet(){ openSheet("settingsSheet"); }
export function openSaveSheet(){ openSheet("saveSheet"); }
export function closeSheet(id){
  const el = document.getElementById(id);
  if(!el || el.hasAttribute("hidden")) return;
  el.setAttribute("hidden", "");
  if(_sheetOpener && _sheetOpener.isConnected){
    try { _sheetOpener.focus({ preventScroll: true }); } catch(_){}
  }
  _sheetOpener = null;
}

export function changeSpeedV2(val){
  const rate = parseFloat(val);
  if(!Number.isFinite(rate) || rate <= 0) return;
  vstate.settings.playbackRate = rate;
  const video = document.querySelector(PLAYER_SEL);
  if(video) video.playbackRate = rate;
  const label = document.getElementById("ovSpeedLabel");
  if(label) label.textContent = rate + "x";
  closeSheet("settingsSheet");
  persistState();
}

async function copyText(text){
  try {
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch(_){}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch(_){
    return false;
  }
}

export async function copyVideoLinkV2(id){
  const url = `${location.origin}/v/${encodeURIComponent(id)}`;
  closeSheet("shareSheet");
  toastMsg(await copyText(url) ? "Link copied" : "Link: " + url);
}

export async function copyEmbedCodeV2(id){
  const url = `${location.origin}/watch/${encodeURIComponent(id)}`;
  const code = `<iframe src="${url}" width="640" height="360" style="border:0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`;
  closeSheet("shareSheet");
  toastMsg(await copyText(code) ? "Embed code copied" : "Embed copy failed");
}

let _downloading = false;
let _downloadResetTimer = null;
export async function downloadWithFeedback(id){
  if(_downloading) return;
  _downloading = true;
  clearTimeout(_downloadResetTimer);
  const icon = document.getElementById("downloadIcon");
  const text = document.getElementById("downloadText");
  const btn = document.getElementById("downloadBtn");
  if(icon) icon.innerHTML = '<use href="#icon-download"/>';
  if(text) text.textContent = "Downloading…";
  if(btn){ btn.classList.add("downloading"); btn.setAttribute("aria-busy", "true"); }
  try {
    await download(id);
    if(text) text.textContent = "Downloaded";
  } catch(e){
    console.error("Download failed", e);
    if(text) text.textContent = "Download failed";
  } finally {
    _downloading = false;
    if(btn){ btn.classList.remove("downloading"); btn.removeAttribute("aria-busy"); }
    _downloadResetTimer = setTimeout(() => { if(text && text.isConnected) text.textContent = "Download"; }, 2500);
  }
}

/* ---- Description expand/collapse ---- */
export function toggleDescSheetMobile(){
  const box = document.getElementById("quickDescBox");
  const chevron = document.getElementById("descChevron");
  if(!box) return;
  const willShow = box.hasAttribute("hidden");
  box.toggleAttribute("hidden", !willShow);
  if(chevron) chevron.classList.toggle("flipped", willShow);
}

export function toggleDescExpandDesktop(){
  const text = document.getElementById("descTextV2");
  const expandText = document.getElementById("descExpandText");
  const chevron = document.getElementById("descChevronDesktop");
  const extra = document.getElementById("descExtraDetails");
  if(!text) return;
  const expanding = text.classList.contains("clamped");
  text.classList.toggle("clamped", !expanding);
  if(chevron) chevron.classList.toggle("flipped", expanding);
  if(extra) extra.toggleAttribute("hidden", !expanding);
  if(expandText) expandText.textContent = expanding ? "Show Less" : "Show More";
}