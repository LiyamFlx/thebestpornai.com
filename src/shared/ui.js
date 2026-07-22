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
  if(yt) return `<div class="player-wrap"><iframe class="player" src="https://www.youtube.com/embed/${yt}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="${esc(v.title)}"></iframe></div>`;
  if(v.src) {
    const poster = v.thumb ? ` poster="${mediaUrl(v.thumb)}"` : '';
    return `<div class="player-wrap">
      <video class="player" src="${mediaUrl(v.src)}" autoplay muted playsinline${poster} aria-label="${esc(v.title)}"></video>
      <div class="player-status player-status-loading" aria-hidden="true"><div class="player-spinner"></div></div>
      <div class="player-status player-status-error" style="display:none" role="alert">
        <div class="player-error-msg">This video couldn't be loaded.</div>
        <button class="btn sm" onclick="event.stopPropagation();this.closest('.player-wrap').querySelector('video.player').load()">Retry</button>
      </div>
      <div class="pc-bar">
        <div class="pc-progress">
          <div class="pc-buffered"></div>
          <div class="pc-played"></div>
          <input type="range" class="pc-seek" min="0" max="1000" value="0" step="1" aria-label="Seek"/>
        </div>
        <div class="pc-row">
          <button class="pc-btn pc-play" aria-label="Pause">⏸</button>
          <button class="pc-btn pc-mute" aria-label="Unmute">🔇</button>
          <input type="range" class="pc-volume" min="0" max="1" step="0.05" value="1" aria-label="Volume"/>
          <span class="pc-time" aria-hidden="true">0:00 / 0:00</span>
          <span class="pc-spacer"></span>
          <select class="pc-speed" aria-label="Playback speed">
            <option value="0.5">0.5x</option><option value="0.75">0.75x</option>
            <option value="1" selected>1x</option><option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option><option value="2">2x</option>
          </select>
          <button class="pc-btn pc-pip" aria-label="Picture in picture">⧉</button>
          <button class="pc-btn pc-fs" aria-label="Fullscreen">⛶</button>
        </div>
      </div>
    </div>`;
  }
  return `<div class="player-wrap"><div class="player">VIDEO STREAM — ${esc(v.title)}</div></div>`;
}

export function videoCard(v, opts={}){
  // The thumb <video> doubles as the hover preview: card hover plays it muted
  // (see .card:hover .thumb-video / hoverPreview() wiring in the viewer).
  const isPreviewable = v.src && !ytId(v.src);
  // Prefer a lightweight JPEG poster (see scripts/gen-posters.js): a ~30 KB
  // image instead of downloading video bytes + spinning a decoder just to paint
  // one frame. Falls back to a lazy <video> thumb for entries without a poster.
  const thumb = v.thumb
    ? `<img class="thumb-video" src="${mediaUrl(v.thumb)}" alt="" loading="lazy" decoding="async"/>`
    : (isPreviewable
        ? `<video class="thumb-video lazy" data-src="${mediaUrl(v.src)}#t=1" muted preload="none" playsinline loop></video>` : ``);
  // When there's a poster image, still expose the source for hover preview.
  const hoverSrc = (v.thumb && isPreviewable)
    ? `<video class="thumb-preview lazy" data-src="${mediaUrl(v.src)}#t=1" muted preload="none" playsinline loop></video>` : ``;
  const badge = opts.badge ? opts.badge(v) : null;
  const quickActions = opts.hideActions ? `` : `
        <div class="card-actions">
          <button class="card-act" title="Favorite" data-fav-id="${v.id}" aria-pressed="false" onclick="event.stopPropagation();toggleFav(${v.id})">❤</button>
          <button class="card-act" title="Watch Later" data-later-id="${v.id}" aria-pressed="false" onclick="event.stopPropagation();toggleLater(${v.id})">＋</button>
          <button class="card-act" title="Share" aria-label="Share this video" onclick="event.stopPropagation();shareVideo(${v.id})">↗</button>
        </div>`;
  // 'row' is the YouTube-Home-style single-column card (thumb full-width on
  // top, a small creator avatar + two-line identity block below); 'grid' is
  // the existing default (2-up dense browse mode). Purely additive: the
  // avatar is a new element, but .card/.video-thumb/.title/.meta/.tag-chips
  // and the data-fav-id/data-later-id contract are unchanged either way, so
  // markToggleStates()/reflectSetToggle() and hover-preview wiring keep
  // working without modification.
  const isRow = opts.layout === 'row';
  const cName = creatorName(v.creator);
  const metaBlock = isRow
    ? `<div class="card-identity">
        <div class="avatar-sm card-avatar">${esc((cName||"?")[0])}</div>
        <div class="card-text">
          <div class="title">${esc(v.title)}</div>
          <div class="meta"><span class="meta-creator">${esc(cName)}</span><span class="meta-stats">${fmt(v.views)} views</span></div>
        </div>
      </div>`
    : `<div class="title">${esc(v.title)}</div>
      <div class="meta">${esc(cName)} • ${fmt(v.views)} views</div>`;
  return `
    <div class="card${isRow ? ' card--row' : ''}" onclick="${opts.onClick || `openVideo(${v.id})`}">
      <div class="video-thumb ${v.type==='original'?'original':''}">
        ${badge?`<span class="corner-badge">${esc(badge)}</span>`:``}
        ${thumb}
        ${hoverSrc}
        ${quickActions}
        ${v.duration?`<span class="dur-badge">${esc(v.duration)}</span>`:``}
        ${v.src?`<span class="play-badge">▶</span>`:``}
      </div>
      ${metaBlock}
      ${opts.hideTags ? `` : tagChips(v.tags, { max: 3, stop: true })}
      ${opts.extra ? opts.extra(v) : ``}
    </div>`;
}

/* Spicier empty state: instead of a bare message, suggest hot tags to click.
   `suggest` is a list of tag strings; each becomes a clickable searchTag chip. */
export function emptyState(message, suggest = []){
  const chips = suggest.length
    ? `<div class="empty-suggest">Try something hotter:
        ${suggest.map(t=>`<span class="tag-chip" onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}
       </div>` : "";
  return `<div class="empty"><div class="empty-emoji">🔍</div><div class="empty-msg">${esc(message)}</div>${chips}</div>`;
}

/* Skeleton grid shown while content is still loading (manifest sync, etc.). */
export function skeletonGrid(n = 8){
  return `<div class="grid">${Array.from({length:n}).map(()=>`
    <div class="card skeleton"><div class="video-thumb sk"></div><div class="sk-line"></div><div class="sk-line short"></div></div>`).join("")}</div>`;
}

export function rowSection(title, list, opts={}){
  if(!list.length) return "";
  return `<h3>${title}</h3><div class="row-scroll">${list.map(v=>videoCard(v, opts)).join("")}</div>`;
}
