/* Movie detail page (#movie/<title>): hero, fact strip, clips + related rows. */
import { esc, mediaUrl, ytId } from "../../shared/catalog.js";
import { rowSection } from "../../shared/ui.js";
import { homeFilterHref } from "../../shared/public-routes.js";
import { vstate } from "../state.js";
import { pubVideos, trending, byCat, byUploadedDesc, scenesFor, clipsFor, actNames } from "../catalog-queries.js";

const ROW_MAX = 10;

const isPlayable = (v) => !!(v && v.src && !ytId(v.src));

function prefersStillHero(){
  try { if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true; } catch(_){}
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !!(c && (c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g"));
}

/* ---- Event delegation (Invariant #1: zero inline handlers) ---- */
function callGlobal(name, ...args){
  const fn = window[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

function goBack(){
  let sameOrigin = false;
  try { sameOrigin = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch(_){}
  // Only history.back() when it stays on-site; a direct landing would otherwise bounce the user off the site.
  if(history.length > 1 && (sameOrigin || history.state != null)) history.back();
  else callGlobal("go", "home");
}

function syncLaterButton(btn){
  const id = Number(btn.dataset.id);
  const on = Array.isArray(vstate.later) && vstate.later.includes(id);
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-pressed", String(on));
  btn.textContent = on ? "✓ Saved" : "+ Watch Later";
}

const MOVIE_ACTS = {
  back: () => goBack(),
  categories: () => callGlobal("go", "categories"),
  play: (el) => callGlobal("openVideo", Number(el.dataset.id)),
  later: (el) => {
    const r = callGlobal("toggleLater", Number(el.dataset.id));
    if(r && typeof r.then === "function") r.then(() => { if(el.isConnected) syncLaterButton(el); }, () => {});
    else syncLaterButton(el);
  },
};

if(typeof document !== "undefined" && !window.__movieDelegationBound){
  window.__movieDelegationBound = true;
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-movie-act]");
    if(!el) return;
    const act = MOVIE_ACTS[el.dataset.movieAct];
    if(!act) return;
    e.preventDefault();
    act(el);
  });
}

/* Rows pull from overlapping pools (trending / category / newest); each id appears once, first row wins. */
function takeUnique(source, seen, limit, exclude){
  const out = [];
  for(const v of source){
    if(out.length >= limit) break;
    if(seen.has(v.id) || exclude(v)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}

export function renderMovieDetail(){
  const title = vstate.currentMovieTitle;
  if(!title) return movieNotFound();

  const scenes = scenesFor(title);
  // A movie can be one flat level:"movie" entry with no scene/clip hierarchy (e.g. the 100MB+ batch promotion).
  const movieEntry = pubVideos().find((v) => v.movieTitle === title && v.level === "movie");
  if(!scenes.length && !movieEntry) return movieNotFound();

  const allClips = scenes.flatMap((scene) => clipsFor(title, scene.sceneNumber));
  const clipList = allClips.length ? allClips : (scenes.length ? scenes : [movieEntry]);
  const heroEntry = movieEntry || scenes[0];
  // Background loop uses a short clip when one exists, never the full movie file.
  const heroMedia = allClips.find(isPlayable) || scenes.find(isPlayable) || heroEntry;

  // Act vocabulary read per render: the catalog swaps seed -> full after load, so a module-level Set goes stale.
  const actVocab = new Set(actNames());
  const movieActs = new Set();
  for(const c of clipList) for(const t of (c.tags || [])) if(actVocab.has(t)) movieActs.add(t);
  const badgeFor = (v) => (v.tags || []).find((t) => movieActs.has(t)) || null;

  const notThisMovie = (v) => v.movieTitle === title;
  const seen = new Set(clipList.map((v) => v.id));
  const related = takeUnique(trending(), seen, 8, notThisMovie);
  const primaryCategory = heroEntry.category;
  const similar = primaryCategory ? takeUnique(byCat(primaryCategory), seen, 8, notThisMovie) : [];
  const more = takeUnique(byUploadedDesc(), seen, ROW_MAX, notThisMovie);

  const poster = heroMedia.thumb || heroEntry.thumb;
  const posterAttr = poster ? ` poster="${esc(mediaUrl(poster))}"` : "";
  const motion = prefersStillHero() ? "" : " autoplay loop";
  const heroMediaHtml = isPlayable(heroMedia)
    ? `<video src="${esc(mediaUrl(heroMedia.src))}"${posterAttr} muted${motion} playsinline preload="metadata" disablepictureinpicture aria-hidden="true"></video>`
    : (poster ? `<img src="${esc(mediaUrl(poster))}" alt="" fetchpriority="high" decoding="async"/>` : "");

  const laterOn = Array.isArray(vstate.later) && vstate.later.includes(heroEntry.id);
  const clipCount = clipList.length;

  return `
    <div class="movie-detail">
      <div class="movie-hero">
        ${heroMediaHtml}
        <div class="movie-hero-topnav">
          <button type="button" class="icon-btn movie-back" data-movie-act="back" aria-label="Back"><svg class="ico" aria-hidden="true"><use href="#icon-back"/></svg></button>
          <button type="button" class="icon-btn movie-menu" data-movie-act="categories" aria-label="Browse categories"><svg class="ico" aria-hidden="true"><use href="#icon-grid"/></svg></button>
        </div>
        <div class="movie-hero-body">
          <h1 class="movie-title">${esc(title)}</h1>
          <div class="movie-cta-row">
            <button type="button" class="btn" data-movie-act="play" data-id="${heroEntry.id}" aria-label="Play ${esc(title)}">▶ Play</button>
            <button type="button" class="btn ghost${laterOn ? " on" : ""}" data-movie-act="later" data-id="${heroEntry.id}" data-later-id="${heroEntry.id}" aria-pressed="${laterOn}">${laterOn ? "✓ Saved" : "+ Watch Later"}</button>
          </div>
        </div>
      </div>
      <div class="movie-factstrip">
        <span class="pill-tag">18+</span>
        <span>${clipCount} Clip${clipCount === 1 ? "" : "s"}</span>
        ${[...movieActs].map((a) => `<span class="fact-tag">${esc(a)}</span>`).join("")}
      </div>
      ${rowSection("Clips", clipList, { badge: badgeFor })}
      ${related.length ? rowSection("Related", related) : ""}
      ${similar.length ? rowSection("Similar — " + primaryCategory, similar) : ""}
      ${more.length ? rowSection("More Like This", more) : ""}
    </div>
  `;
}

function movieNotFound(){
  return `<div class="empty">
    <div class="empty-msg">Movie not found.</div>
    <a class="btn ghost sm" href="${esc(homeFilterHref("movies"))}">Browse movies</a>
  </div>`;
}