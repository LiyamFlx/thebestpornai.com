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
  if(volumeSlider) volumeSlider.value = vstate.settings.muted ? 0 : video.volume;

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

  // Autoplay only works muted without a prior user gesture. Unmuting in the
  // "playing" handler without userActivation pauses the element and logs:
  //   "Unmuting failed and the element was paused instead…"
  // Stay muted for the autoplay attempt; only restore sound if the user has
  // already interacted with the page (or they unmute via the control).
  const canUnmute = () => {
    try {
      // Chromium: true after any click/key/tap in this document.
      if(navigator.userActivation && typeof navigator.userActivation.hasBeenActive === "boolean"){
        return navigator.userActivation.hasBeenActive;
      }
    } catch(_){}
    // Conservative fallback: never auto-unmute (avoids the pause+console warning).
    return false;
  };
  const wantsUnmuted = !vstate.settings.muted;
  video.muted = true;
  if(wantsUnmuted){
    video.addEventListener("playing", () => {
      if(!canUnmute()){
        // Keep playing muted; mute icon stays on so the user can tap sound.
        setMuteIcon();
        return;
      }
      try { video.muted = false; } catch(_){}
      setMuteIcon();
    }, { once: true });
  }
  video.play?.().catch(()=>{});

  setPlayIcon(); setMuteIcon();

  video.addEventListener("play", setPlayIcon);
  video.addEventListener("pause", setPlayIcon);

  const triggerSeekRipple = (secs) => {
    const isForward = secs > 0;
    const existing = wrap.querySelector(".seek-ripple");
    if(existing) existing.remove();
    const ripple = document.createElement("div");
    ripple.className = `seek-ripple ${isForward ? 'forward' : 'rewind'}`;
    ripple.innerHTML = `<span class="seek-ripple-icon">${isForward ? '▶▶' : '◀◀'}</span><span class="seek-ripple-text">${isForward ? '+10s' : '-10s'}</span>`;
    wrap.appendChild(ripple);
    setTimeout(() => { if(ripple.isConnected) ripple.remove(); }, 650);
  };

  window.togglePlayPauseV2 = () => {
    if(advanceOverlay || document.querySelector(".pc-upnext")){
      const nextCard = document.querySelector(".upnext-card[data-video-id]");
      const nextId = nextCard ? +nextCard.dataset.videoId : null;
      clearAutoAdvance();
      if(nextId){ openVideo(nextId); return; }
    }
    if(video.paused || video.ended) video.play().catch(()=>{});
    else video.pause();
  };

  window.skipTime = (secs) => {
    // If Up Next banner is active, right arrow/forward immediately advances to next video with no barrier!
    if(advanceOverlay || document.querySelector(".pc-upnext")){
      if(secs > 0){
        clearAutoAdvance();
        const nextCard = document.querySelector(".upnext-card[data-video-id]");
        const nextId = nextCard ? +nextCard.dataset.videoId : null;
        if(nextId){ openVideo(nextId); return; }
        window.stepWatch?.(1);
        return;
      } else {
        clearAutoAdvance();
        if(isFinite(video.duration)){
          video.currentTime = Math.max(0, (video.duration || 0) + secs);
          video.play().catch(()=>{});
        }
        return;
      }
    }

    if(!isFinite(video.duration)) return;

    // If seeking forward to/past the end of the video, smoothly advance to the next video immediately!
    if(secs > 0 && video.currentTime + secs >= video.duration - 0.25){
      triggerSeekRipple(secs);
      clearAutoAdvance();
      const nextCard = document.querySelector(".upnext-card[data-video-id]");
      const nextId = nextCard ? +nextCard.dataset.videoId : null;
      if(nextId){ openVideo(nextId); return; }
      window.stepWatch?.(1);
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
    const current = vstate.settings.playbackRate || 1;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    let next;
    if(delta > 0) {
      next = rates.find(r => r > current) || 2;
    } else {
      next = rates.slice().reverse().find(r => r < current) || 0.5;
    }
    changeSpeedV2(next);
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
  // Keyboard Up/Down arrows (main.js) — step by 5%. Reaching exactly 0 mutes
  // (matches dragging the slider to the bottom); stepping up from there
  // un-mutes the same way, whether muted via the slider or the M key.
  window.adjustVolumeV2 = (delta) => {
    video.volume = Math.min(1, Math.max(0, video.volume + delta));
    video.muted = video.volume === 0;
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

  // iOS Safari has never implemented the standard Fullscreen API on
  // arbitrary elements (Element.requestFullscreen is undefined there) —
  // only the <video> element itself supports native fullscreen, via the
  // non-standard webkitEnterFullscreen()/webkitDisplayingFullscreen. The
  // previous version called target.requestFullscreen?.() on a wrapper <div>
  // and swallowed the failure with .catch(()=>{}), so the fullscreen button
  // silently did nothing on iOS — no error, no fallback, just no fullscreen.
  window.toggleFullscreenV2 = () => {
    const target = wrap.closest(".player-container-v2") || wrap;
    if(typeof target.requestFullscreen !== "function" && typeof target.webkitRequestFullscreen !== "function"){
      if(typeof video.webkitEnterFullscreen === "function") video.webkitEnterFullscreen();
      return;
    }
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    if(!isFs){
      if(target.requestFullscreen) target.requestFullscreen().catch(()=>{});
      else if(target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    } else {
      if(document.exitFullscreen) document.exitFullscreen().catch(()=>{});
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
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

  // Auto-hide player chrome after idle while playing. Stay sticky when paused
  // so Play remains tappable. Do NOT cancel the timer on full-overlay
  // mouseenter — the overlay covers the whole player, so that left controls
  // stuck on forever whenever the cursor was over the video.
  const HIDE_MS = 1000;
  const container = wrap.closest(".player-container-v2") || wrap;
  const hide = () => {
    if(advanceOverlay) return; // end-card owns the surface
    // Keep chrome while paused (standard player UX).
    if(video.paused && !video.ended) return;
    overlay.classList.remove("visible");
  };
  const show = (opts = {}) => {
    overlay.classList.add("visible");
    clearAutoHide();
    // sticky, paused, or actively scrubbing → stay up until next activity/play
    if(opts.sticky || video.paused) return;
    hideTimer = setTimeout(hide, HIDE_MS);
  };
  // Activity anywhere on the player resets the idle timer (mousemove / touch).
  const onActivity = () => show();
  container.addEventListener("mousemove", onActivity);
  container.addEventListener("touchstart", onActivity, { passive: true });
  // Keep chrome visible while scrubbing / adjusting volume.
  seek?.addEventListener("pointerdown", () => { clearAutoHide(); overlay.classList.add("visible"); });
  seek?.addEventListener("pointerup", () => show());
  volumeSlider?.addEventListener("pointerdown", () => { clearAutoHide(); overlay.classList.add("visible"); });
  volumeSlider?.addEventListener("pointerup", () => show());
  video.addEventListener("play", () => show());
  video.addEventListener("pause", () => show({ sticky: true }));
  // Click on the video surface (empty overlay space passes through): toggle.
  video.addEventListener("click", (e) => {
    if(e.target !== video) return;
    window.togglePlayPauseV2();
    show();
  });
  show();

  attachAutoAdvance(overlay, video, wrap);
}

/* End-of-play card: next video preview + countdown + Cancel / Play now.
   Uses the first *visible* Up Next card so category filters still apply. */
function attachAutoAdvance(overlay, video, wrap){
  const DURATION_MS = 5000;
  const RADIUS = 22;
  const CIRC = 2 * Math.PI * RADIUS;

  const pickNext = () => {
    const cards = [...document.querySelectorAll(".upnext-card[data-video-id]")];
    const visibleCards = cards.filter((c) => c.style.display !== "none");
    if (!visibleCards.length) return null;

    // Check recent history to prevent looping between recently seen videos
    const recentIds = new Set((vstate.history || []).slice(0, 8));

    // Try finding the first visible Up Next card that hasn't been watched recently
    let candidate = visibleCards.find((c) => {
      const vid = +c.dataset.videoId;
      return Number.isFinite(vid) && !recentIds.has(vid);
    });

    // If all visible recommendations have been watched recently, pick the first visible card that is not the current video
    if (!candidate) {
      candidate = visibleCards.find((c) => {
        const vid = +c.dataset.videoId;
        return Number.isFinite(vid) && vid !== vstate.current?.id;
      });
    }

    if (!candidate) return null;
    const nextId = +candidate.dataset.videoId;
    return {
      id: nextId,
      title: candidate.dataset.title || "Next video",
      creator: candidate.dataset.creator || "",
      thumb: candidate.dataset.thumb || "",
    };
  };

  const cancelAdvance = () => {
    clearAutoAdvance();
    overlay.classList.add("visible");
  };

  window.cancelUpNextAdvance = cancelAdvance;
  window.playUpNextNow = (id) => {
    clearAutoAdvance();
    openVideo(+id);
  };

  video.addEventListener("ended", () => {
    if(advanceOverlay) return;
    const next = pickNext();
    if(!next) return;

    // Autoplay off: static end screen with next + replay affordance, no timer.
    const autoplayOn = !!vstate.settings.autoplay;

    advanceOverlay = document.createElement("div");
    advanceOverlay.className = "pc-upnext";
    advanceOverlay.setAttribute("role", "dialog");
    advanceOverlay.setAttribute("aria-label", autoplayOn ? "Next video starting soon" : "Video ended");
    const thumbHtml = next.thumb
      ? `<img class="pc-upnext-thumb" src="${next.thumb}" alt="" loading="eager"/>`
      : `<div class="pc-upnext-thumb pc-upnext-thumb-ph" aria-hidden="true"></div>`;
    advanceOverlay.innerHTML = `
      <div class="pc-upnext-card">
        ${thumbHtml}
        <div class="pc-upnext-info">
          <div class="pc-upnext-kicker">${autoplayOn ? "Up next" : "Suggested next"}</div>
          <div class="pc-upnext-title"></div>
          <div class="pc-upnext-creator"></div>
          ${autoplayOn ? `
          <div class="pc-upnext-countdown-row">
            <svg class="pc-upnext-ring" viewBox="0 0 48 48" aria-hidden="true">
              <circle class="pc-upnext-ring-track" cx="24" cy="24" r="${RADIUS}"/>
              <circle class="pc-upnext-ring-fill" cx="24" cy="24" r="${RADIUS}"
                stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
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
    // Text via textContent to avoid XSS from catalog titles.
    advanceOverlay.querySelector(".pc-upnext-title").textContent = next.title;
    advanceOverlay.querySelector(".pc-upnext-creator").textContent = next.creator;

    // Mount on the player container so it sits above the video even when
    // the control overlay is hidden (opacity/pointer-events).
    const mount = wrap?.closest(".player-container-v2") || wrap || overlay;
    mount.appendChild(advanceOverlay);
    overlay.classList.remove("visible");

    advanceOverlay.querySelector(".pc-upnext-card")?.addEventListener("click", (e) => {
      if(e.target.closest("#pcUpNextCancel") || e.target.closest("#pcUpNextReplay")) return;
      e.stopPropagation();
      window.playUpNextNow(next.id);
    });
    advanceOverlay.querySelector("#pcUpNextCancel")?.addEventListener("click", (e) => {
      e.stopPropagation();
      cancelAdvance();
    });
    advanceOverlay.querySelector("#pcUpNextPlay")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.playUpNextNow(next.id);
    });
    advanceOverlay.querySelector("#pcUpNextReplay")?.addEventListener("click", (e) => {
      e.stopPropagation();
      clearAutoAdvance();
      video.currentTime = 0;
      video.play?.().catch(()=>{});
      overlay.classList.add("visible");
    });

    if(!autoplayOn) return;

    const ringFill = advanceOverlay.querySelector(".pc-upnext-ring-fill");
    const secsEl = advanceOverlay.querySelector("#pcUpNextSecs");
    const start = performance.now();
    const tick = (now) => {
      if(!advanceOverlay) return;
      const elapsed = now - start;
      const left = Math.max(0, DURATION_MS - elapsed);
      if(ringFill) ringFill.style.strokeDashoffset = String(CIRC * (1 - elapsed / DURATION_MS));
      if(secsEl) secsEl.textContent = String(Math.ceil(left / 1000));
      if(elapsed >= DURATION_MS){
        advanceTimer = null;
        const id = next.id;
        clearAutoAdvance();
        openVideo(id);
        return;
      }
      advanceTimer = requestAnimationFrame(tick);
    };
    advanceTimer = requestAnimationFrame(tick);
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
  const url = `${location.origin}/v/${id}`;
  if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>window.toast("Link copied"), ()=>window.toast("Link: "+url));
  else window.toast("Link: "+url);
  closeSheet("shareSheet");
}

export function copyEmbedCodeV2(id){
  const url = `${location.origin}/#video/${id}`;
  const code = `<iframe src="${url}" width="640" height="360" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>`;
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
