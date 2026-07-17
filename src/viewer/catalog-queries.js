/* Pure, read-only selectors over the shared catalog (DATA.videos).
   No state, no DOM — every function derives from the flat videos array. */
import { DATA } from "../shared/catalog.js";

/* Public-catalog filter: private videos must never surface in feeds, search,
   trending, suggestions, or keyboard nav (previously only the creator page
   filtered them). */
export const visible = v => v && v.status !== "private";
export const pubVideos = () => DATA.videos.filter(visible);

export const trending = ()=> pubVideos().sort((a,b)=> (b.likes*1.2+b.views*0.01) - (a.likes*1.2+a.views*0.01));
export const byCat = (c)=> pubVideos().filter(v=>v.category===c);

export function sortedVideos(sort){
  const vids = pubVideos().slice();
  if(sort==="latest") return vids.sort((a,b)=>b.uploaded.localeCompare(a.uploaded));
  if(sort==="likes") return vids.sort((a,b)=>b.likes-a.likes);
  if(sort==="views") return vids.sort((a,b)=>b.views-a.views);
  return vids;
}

/* ---- Movie / Scene / Clip / Act structure ----
   Optional fields on video objects (movieTitle, level, sceneNumber,
   clipNumber, actName) group related uploads without touching the flat
   clips that make up the rest of the catalog. See CLAUDE.md for the
   filename convention these fields are derived from. */
export const movies = () => {
  const titles = [...new Set(pubVideos().filter(v=>v.movieTitle).map(v=>v.movieTitle))];
  return titles.map(t => {
    const scenes = pubVideos().filter(v=>v.movieTitle===t && v.level==="scene")
              .sort((a,b)=>a.sceneNumber-b.sceneNumber);
    return {
      title: t,
      // Prefer the full movie file; otherwise fall back to the lowest-numbered
      // scene (scenes is already sorted ascending, so [0] is Scene-01), NOT
      // whichever scene .find() happens to hit first in array order.
      poster: pubVideos().find(v=>v.movieTitle===t && v.level==="movie") || scenes[0],
      scenes,
    };
  }).filter(m=>m.poster);
};

export const scenesFor = (movieTitle) => pubVideos().filter(v=>v.movieTitle===movieTitle && v.level==="scene").sort((a,b)=>a.sceneNumber-b.sceneNumber);
export const clipsFor = (movieTitle, sceneNumber) => pubVideos().filter(v=>v.movieTitle===movieTitle && v.level==="clip" && v.sceneNumber===sceneNumber).sort((a,b)=>a.clipNumber-b.clipNumber);

/* An "Act" is either an explicit level:"act" compilation entry, or any tag
   shared by 2+ clips of the same movie (a lone tag on one clip is just
   descriptive metadata, not a cross-cutting grouping worth its own row). */
export const actNames = () => {
  const names = new Set(pubVideos().filter(v=>v.level==="act" && v.actName).map(v=>v.actName));
  const byMovie = {};
  for(const v of pubVideos()){
    if(v.level!=="clip" || !v.movieTitle) continue;
    byMovie[v.movieTitle] = byMovie[v.movieTitle] || {};
    for(const t of (v.tags||[])) byMovie[v.movieTitle][t] = (byMovie[v.movieTitle][t]||0) + 1;
  }
  for(const movieTitle in byMovie){
    for(const tag in byMovie[movieTitle]){
      if(byMovie[movieTitle][tag] >= 2) names.add(tag);
    }
  }
  return [...names];
};

export const clipsByAct = (actName) => pubVideos().filter(v=>v.level==="clip" && (v.tags||[]).includes(actName));
export const highlights = () => pubVideos().filter(v=>v.level==="highlight");
