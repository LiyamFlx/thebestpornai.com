/* Home page: hero, filter/sort bars, and the row-based feed. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { videoCard, rowSection } from "../../shared/ui.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, trending, byCat, sortedVideos, movies, actNames, clipsByAct, highlights } from "../catalog-queries.js";

export const HERO_VIDEO_ID = 470; // pinned homepage hero — update this id to change it

function homeFilterBar(){
  const filters = [["all","All"],["movies","Movies"],["scenes","Scenes"],["clips","Clips"]];
  const sorts = [["none","Default"],["latest","Latest"],["likes","Most Liked"],["views","Most Viewed"]];
  return `<div class="pill-row home-filter-bar">
    ${filters.map(([key,label])=>`<button class="filter-pill ${vstate.homeFilter===key?'active':''}" onclick="setHomeFilter('${key}')">${label}</button>`).join("")}
  </div>
  <div class="pill-row home-sort-bar">
    ${sorts.map(([key,label])=>`<button class="filter-pill ${vstate.homeSort===key?'active':''}" onclick="setHomeSort('${key}')">${label}</button>`).join("")}
  </div>`;
}

const moviesRow = (allMovies) =>
  `<h3>Movies</h3><div class="row-scroll">${allMovies.map(m=>videoCard(m.poster, {onClick:`openMovie('${jsq(m.title)}')`})).join("")}</div>`;

export function renderHome(){
  const hero = pubVideos().find(v=>v.id===HERO_VIDEO_ID) || pubVideos().find(v=>v.type==="original") || pubVideos()[0];
  if(!hero) return `<div class="empty">No videos available yet.</div>`;
  const top = trending();   // compute once; reused by the two rows below
  const filter = vstate.homeFilter;
  const sort = vstate.homeSort;

  // A non-default sort takes priority over the Movies/Scenes/Clips filter and
  // replaces the usual row set with one flat grid, same pattern as those filters.
  if(sort!=="none"){
    const label = sort==="latest" ? "Latest" : sort==="likes" ? "Most Liked" : "Most Viewed";
    const all = sortedVideos(sort).slice(0, vstate.limit);
    return `
      ${homeFilterBar()}
      ${all.length ? `<h3>${label}</h3><div class="grid">${all.map(v=>videoCard(v)).join("")}</div>` : `<div class="empty">No videos yet.</div>`}
      ${pubVideos().length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
    `;
  }

  // Movies/Scenes/Clips filters replace the usual row set with a focused view;
  // "all" (the default) keeps today's full homepage layout unchanged.
  if(filter==="movies"){
    const allMovies = movies();
    return `
      ${homeFilterBar()}
      ${allMovies.length ? moviesRow(allMovies) : `<div class="empty">No movies yet.</div>`}
    `;
  }
  if(filter==="scenes"){
    const allScenes = pubVideos().filter(v=>v.level==="scene");
    return `${homeFilterBar()}${allScenes.length ? rowSection("Scenes", allScenes) : `<div class="empty">No scenes yet.</div>`}`;
  }
  if(filter==="clips"){
    const allClips = pubVideos().filter(v=>v.level==="clip");
    return `${homeFilterBar()}${allClips.length ? rowSection("Clips", allClips) : `<div class="empty">No clips yet.</div>`}`;
  }

  const allMovies = movies();
  return `
    ${homeFilterBar()}
    <div class="hero">
      ${hero.src && !ytId(hero.src) ? `<video src="${mediaUrl(hero.src)}" muted autoplay loop playsinline></video>` : ``}
      <div class="hero-body">
        <span class="tag">HOUSE ORIGINAL</span>
        <h1>${esc(hero.title)}</h1>
        <p class="sub">${esc(creatorName(hero.creator))} • ${fmt(hero.views)} views</p>
        <button class="btn" onclick="openVideo(${hero.id})">▶ Play</button>
        <button class="btn ghost" onclick="toggleLater(${hero.id})">+ Watch Later</button>
      </div>
    </div>
    ${vstate.history.length ? rowSection("Continue Watching", vstate.history.map(id=>DATA.videos.find(v=>v.id===id)).filter(Boolean)) : ""}
    ${rowSection("Recommended For You", (()=>{ const nw=top.filter(v=>!vstate.history.includes(v.id)); return nw.length>=6?nw.slice(0, vstate.limit):top.slice(0, vstate.limit); })())}
    ${rowSection("Trending Now", pubVideos().sort((a,b)=>b.views-a.views).slice(0, vstate.limit))}
    ${rowSection("House Originals", pubVideos().filter(v=>v.type==="original").slice(0, vstate.limit))}
    ${allMovies.length ? moviesRow(allMovies) : ""}
    ${rowSection("Highlights", highlights())}
    ${actNames().map(a=>rowSection("Act: "+esc(a), clipsByAct(a))).join("")}
    ${DATA.categories.map(c=>rowSection(c, byCat(c))).join("")}
    ${rowSection("Recently Uploaded", pubVideos().sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0, vstate.limit))}
    ${pubVideos().length > vstate.limit ? `<button class="btn ghost" style="margin:16px auto;display:block" onclick="loadMore()">Load more videos</button>` : ''}
  `;
}
