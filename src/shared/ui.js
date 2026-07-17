/* Shared UI render helpers used by creator, manager, and viewer.
   metric() is the canonical version (includes the up/down arrow) —
   manager's previous copy was missing it; this fixes that divergence. */

export function metric(label, value, delta, up) {
  return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div>${delta ? `<div class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${delta}</div>` : ''}</div>`;
}

export function barChart(values, labels) {
  const max = Math.max(...values, 1);
  return `
    <div class="bars">${values.map(v => `<div class="bar" style="height:${Math.round(v / max * 100)}%"></div>`).join("")}</div>
    <div class="bars-x">${(labels || values.map((_, i) => i + 1)).map(l => `<div>${l}</div>`).join("")}</div>`;
}

export function distRows(arr) {
  return arr.map(d => `
    <div style="margin:10px 0">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>${d.c}</span><span class="small">${d.p}%</span>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${d.p}%;background:linear-gradient(90deg,var(--accent),var(--accent2))"></div>
      </div>
    </div>`).join("");
}

/* ============================================================
   Shared video rendering helpers (extracted from viewer to reduce
   duplication across creator/manager/viewer in future).
   These depend on catalog helpers (esc, mediaUrl, ytId, creatorName, fmt).
   ============================================================ */

import { esc, mediaUrl, ytId, creatorName, fmt } from './catalog.js';
import { jsq } from '../viewer/util.js';

/* Clickable tag chips. `stop` guards the parent card's onclick so tapping a tag
   searches instead of opening the video. `max` caps how many render. */
export function tagChips(tags, { max = 3, stop = false } = {}){
  if(!Array.isArray(tags) || !tags.length) return '';
  const guard = stop ? 'event.stopPropagation();' : '';
  const chips = tags.slice(0, max).map(t =>
    `<span class="tag-chip" onclick="${guard}searchTag('${jsq(t)}')">#${esc(t)}</span>`
  ).join('');
  return `<div class="tag-chips">${chips}</div>`;
}

export function playerEmbed(v){
  const yt = ytId(v.src);
  if(yt) return `<div class="player-wrap"><iframe class="player" src="https://www.youtube.com/embed/${yt}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  if(v.src) {
    const poster = v.thumb ? ` poster="${mediaUrl(v.thumb)}"` : '';
    return `<div class="player-wrap"><video class="player" src="${mediaUrl(v.src)}" controls autoplay${poster}></video></div>`;
  }
  return `<div class="player-wrap"><div class="player">VIDEO STREAM — ${esc(v.title)}</div></div>`;
}

export function videoCard(v, opts={}){
  const thumb = v.thumb
    ? `<img class="thumb-video" src="${mediaUrl(v.thumb)}" alt=""/>`
    : (v.src && !ytId(v.src)
        ? `<video class="thumb-video lazy" data-src="${mediaUrl(v.src)}#t=1" muted preload="none" playsinline></video>` : ``);
  const badge = opts.badge ? opts.badge(v) : null;
  return `
    <div class="card" onclick="${opts.onClick || `openVideo(${v.id})`}">
      <div class="video-thumb ${v.type==='original'?'original':''}">
        ${badge?`<span class="corner-badge">${esc(badge)}</span>`:``}
        ${thumb}
        ${v.duration?`<span class="dur-badge">${esc(v.duration)}</span>`:``}
        ${v.src?`<span class="play-badge">▶</span>`:``}
      </div>
      <div class="title">${esc(v.title)}</div>
      <div class="meta">${esc(creatorName(v.creator))} • ${fmt(v.views)} views</div>
      ${opts.hideTags ? `` : tagChips(v.tags, { max: 3, stop: true })}
      ${opts.extra ? opts.extra(v) : ``}
    </div>`;
}

export function rowSection(title, list, opts={}){
  if(!list.length) return "";
  return `<h3>${title}</h3><div class="row-scroll">${list.map(v=>videoCard(v, opts)).join("")}</div>`;
}
