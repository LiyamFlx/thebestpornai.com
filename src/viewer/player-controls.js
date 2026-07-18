/* Custom control bar for the main <video class="player">: play/pause, seek
   with buffered range, volume, time, speed, PiP, fullscreen, and an
   auto-hide-on-idle translucent overlay. Replaces native browser chrome so
   the player matches the rest of the branded UI and can expose controls
   (speed, PiP) the native bar doesn't offer everywhere.
   Re-attached on every render() since the player element is recreated on
   each innerHTML swap (see render.js). */

function fmtTime(s){
  if(!isFinite(s) || s < 0) return "0:00";
  s = Math.floor(s);
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  const mm = h ? String(m).padStart(2,"0") : String(m);
  return (h ? h+":" : "") + mm + ":" + String(sec).padStart(2,"0");
}

export function attachPlayerControls(){
  const wrap = document.querySelector(".player-wrap");
  const video = wrap && wrap.querySelector("video.player");
  const bar = wrap && wrap.querySelector(".pc-bar");
  if(!wrap || !video || !bar) return;

  const playBtn = bar.querySelector(".pc-play");
  const muteBtn = bar.querySelector(".pc-mute");
  const volume = bar.querySelector(".pc-volume");
  const seek = bar.querySelector(".pc-seek");
  const buffered = bar.querySelector(".pc-buffered");
  const played = bar.querySelector(".pc-played");
  const time = bar.querySelector(".pc-time");
  const speed = bar.querySelector(".pc-speed");
  const pipBtn = bar.querySelector(".pc-pip");
  const fsBtn = bar.querySelector(".pc-fs");

  volume.value = video.muted ? 0 : video.volume;

  const setPlayIcon = () => { playBtn.textContent = video.paused ? "▶" : "⏸"; playBtn.setAttribute("aria-label", video.paused ? "Play" : "Pause"); };
  const setMuteIcon = () => { muteBtn.textContent = (video.muted || video.volume===0) ? "🔇" : "🔊"; muteBtn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute"); };
  setPlayIcon(); setMuteIcon();

  playBtn.addEventListener("click", () => { video.paused ? video.play().catch(()=>{}) : video.pause(); });
  video.addEventListener("play", setPlayIcon);
  video.addEventListener("pause", setPlayIcon);

  muteBtn.addEventListener("click", () => {
    video.muted = !video.muted;
    if(!video.muted && video.volume===0) video.volume = 1;
    volume.value = video.muted ? 0 : video.volume;
    setMuteIcon();
  });
  volume.addEventListener("input", () => {
    video.volume = +volume.value;
    video.muted = +volume.value === 0;
    setMuteIcon();
  });

  let seeking = false;
  const SEEK_MAX = 1000;
  seek.addEventListener("input", () => {
    seeking = true;
    if(isFinite(video.duration)) played.style.width = (seek.value/SEEK_MAX*100)+"%";
  });
  seek.addEventListener("change", () => {
    if(isFinite(video.duration)) video.currentTime = (seek.value/SEEK_MAX) * video.duration;
    seeking = false;
  });

  video.addEventListener("timeupdate", () => {
    if(!isFinite(video.duration)) return;
    if(!seeking) seek.value = String((video.currentTime/video.duration) * SEEK_MAX);
    played.style.width = (video.currentTime/video.duration*100)+"%";
    time.textContent = fmtTime(video.currentTime) + " / " + fmtTime(video.duration);
  });
  video.addEventListener("progress", () => {
    if(!video.buffered.length || !isFinite(video.duration)) return;
    const end = video.buffered.end(video.buffered.length-1);
    buffered.style.width = Math.min(100, (end/video.duration*100)) + "%";
  });
  video.addEventListener("loadedmetadata", () => { time.textContent = fmtTime(0) + " / " + fmtTime(video.duration); });

  speed.addEventListener("change", () => { video.playbackRate = +speed.value; });

  const pipSupported = document.pictureInPictureEnabled && !video.disablePictureInPicture;
  if(!pipSupported){ pipBtn.style.display = "none"; }
  else {
    pipBtn.addEventListener("click", async () => {
      try {
        if(document.pictureInPictureElement) await document.exitPictureInPicture();
        else await video.requestPictureInPicture();
      } catch(_){}
    });
  }

  fsBtn.addEventListener("click", () => {
    if(!document.fullscreenElement) wrap.requestFullscreen?.().catch(()=>{});
    else document.exitFullscreen?.().catch(()=>{});
  });

  // Auto-hide the bar after 2.5s of no mouse/touch activity, unless paused
  // or the user is actively interacting with a control.
  let hideTimer = null;
  const show = () => {
    wrap.classList.add("pc-visible");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if(!video.paused) wrap.classList.remove("pc-visible"); }, 2500);
  };
  wrap.addEventListener("mousemove", show);
  wrap.addEventListener("touchstart", show, { passive: true });
  bar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  bar.addEventListener("mouseleave", show);
  video.addEventListener("pause", () => wrap.classList.add("pc-visible"));
  show();
}
