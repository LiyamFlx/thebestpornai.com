/* Movie detail page (#movie/<title>): hero, fact strip, clips + related rows. */
import { esc, mediaUrl, ytId } from "../../shared/catalog.js";
import { rowSection } from "../../shared/ui.js";
import { vstate } from "../state.js";
import { pubVideos, trending, byCat, scenesFor, clipsFor, actNames } from "../catalog-queries.js";

// Site-wide act vocabulary, used to filter clip tags down to genuine acts.
// Without this, `c.tags` (categories, performer names, anything) all look
// like "acts" to the naive set-union below.
const ACT_NAMES = new Set(actNames());

export function renderMovieDetail(){
  const title = vstate.currentMovieTitle;
  const scenes = scenesFor(title);
  if(!title || !scenes.length) return `<div class="empty">Movie not found.</div>`;

  const pub = pubVideos(); // computed once, reused below
  const movieEntry = pub.find(v=>v.movieTitle===title && v.level==="movie") || scenes[0];
  const allClips = scenes.flatMap(scene => clipsFor(title, scene.sceneNumber));
  const clipList = allClips.length ? allClips : scenes;

  // Acts present in this movie only (not the whole-site actNames()), so the
  // badge reflects what's actually in this movie's clips. Filtered against
  // ACT_NAMES so unrelated tags (category, performer, etc.) never leak in as
  // fake "acts" — previously this set collected every tag on every clip.
  const movieActs = new Set();
  for(const c of allClips) for(const t of (c.tags||[])) if(ACT_NAMES.has(t)) movieActs.add(t);
  const badgeFor = (v) => {
    const t = (v.tags||[]).find(t=>movieActs.has(t));
    return t || null;
  };

  const related = trending().filter(v=>v.movieTitle!==title).slice(0,8);
  const primaryCategory = movieEntry.category;
  const similar = primaryCategory ? byCat(primaryCategory).filter(v=>v.movieTitle!==title).slice(0,8) : [];
  const more = pub.filter(v=>v.movieTitle!==title).sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0,10);

  return `
    <div class="movie-detail">
      <div class="movie-hero">
        ${movieEntry.src && !ytId(movieEntry.src) ? `<video src="${mediaUrl(movieEntry.src)}" muted autoplay loop playsinline></video>` : ``}
        <div class="movie-hero-topnav">
          <button class="icon-btn movie-back" onclick="go('home')" aria-label="Back">←</button>
          <button class="icon-btn movie-menu" onclick="go('categories')" aria-label="Menu">☰</button>
        </div>
        <div class="movie-hero-body">
          <h1 class="movie-title">${esc(title)}</h1>
          <div class="movie-cta-row">
            <button class="btn" onclick="openVideo(${movieEntry.id})">▶ Play</button>
            <button class="btn ghost" onclick="toggleLater(${movieEntry.id})">+ Watch Later</button>
          </div>
        </div>
      </div>
      <div class="movie-factstrip">
        <span class="pill-tag">18+</span>
        <span>${clipList.length} Clip${clipList.length===1?"":"s"}</span>
        ${[...movieActs].map(a=>`<span class="fact-tag">${esc(a)}</span>`).join("")}
      </div>
      ${rowSection("Clips", clipList, {badge: badgeFor})}
      ${rowSection("Related", related)}
      ${similar.length ? rowSection("Similar — "+esc(primaryCategory), similar) : ""}
      ${rowSection("More Like This", more)}
    </div>
  `;
}