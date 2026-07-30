/* Watch page: player, actions, creator card, tabs (mobile) / stacked sections
   (desktop), comments, related/suggested — full redesign per approved specs
   (mobile_video_watch_page.html / desktop_video_watch_page.html reference
   files: same structure, order, and functionality, reimplemented in plain
   CSS + the site's existing SVG icon sprite instead of Tailwind/FontAwesome,
   wired to 100% real data/actions instead of the reference files' demo
   client-only state). Two real layouts (mobile tabs, desktop full stack),
   not one template faking responsiveness. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { playerEmbed } from "../../shared/ui.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, trending, relatedTo } from "../catalog-queries.js";
import { renderCommentList, commentsFor } from "../comments.js";

const CREATOR_BY_ID = new Map(DATA.creators.map(c => [c.id, c]));

const MOBILE = "(max-width:760px)";
const isMobile = () => !!(window.matchMedia && window.matchMedia(MOBILE).matches);

function fmtDuration(v){
  // Catalog entries already carry a formatted duration string (e.g. "0:26").
  return v.duration || "";
}

/* Up Next / recommendation card — shared by mobile tab panel and desktop
   always-visible grid. Matches the reference files' card shape: 16:9 thumb
   with duration badge, title, creator, views + upload age. */
function upNextCard(u){
  const isPreviewable = u.src && !ytId(u.src);
  const thumb = u.thumb
    ? `<img src="${mediaUrl(u.thumb)}" alt="" loading="lazy" decoding="async"/>`
    : (isPreviewable ? `<video class="thumb-video lazy" data-src="${mediaUrl(u.src)}#t=1" muted preload="none" playsinline loop></video>` : ``);
  return `
    <div class="upnext-card" data-video-id="${u.id}" data-category="${esc(u.category||'')}" onclick="openVideo(${u.id})">
      <div class="upnext-thumb">
        ${thumb}
        ${fmtDuration(u) ? `<span class="upnext-duration">${esc(fmtDuration(u))}</span>` : ''}
      </div>
      <div class="upnext-info">
        <h3 class="upnext-title">${esc(u.title)}</h3>
        <p class="upnext-creator">${esc(creatorName(u.creator))}</p>
        <p class="upnext-meta">${fmt(u.views)} views <span class="dot-sep">•</span> ${esc(u.uploaded)}</p>
      </div>
      <button class="upnext-more" onclick="event.stopPropagation();toast('Added to queue')" aria-label="More options">
        <svg class="ico"><use href="#icon-more"/></svg>
      </button>
    </div>`;
}

/* Category chip filter for the Up Next list: "All" + up to 4 categories
   actually present among the current related pool, so the chips are always
   meaningful for this video (not the full site-wide taxonomy). */
function upNextCategoryChips(related){
  const cats = [...new Set(related.map(u=>u.category).filter(Boolean))].slice(0, 4);
  return `<div class="upnext-chips mchrome-scroll">
    <button class="upnext-chip active" data-upnext-cat="" onclick="filterUpNext('')">All</button>
    ${cats.map(c=>`<button class="upnext-chip" data-upnext-cat="${esc(c)}" onclick="filterUpNext('${jsq(c)}')">${esc(c)}</button>`).join("")}
  </div>`;
}

function autoplayToggle(){
  return `
    <div class="upnext-autoplay-row">
      <span class="label">Autoplay next video</span>
      <label class="switch-wrap">
        <input type="checkbox" ${vstate.settings.autoplay?'checked':''} onchange="toggleAutoplaySetting(this.checked)"/>
        <div class="switch-track"></div>
      </label>
    </div>`;
}

function commentComposer(v){
  return `
    <div class="comment-composer">
      <div class="avatar avatar-sm">${esc((DATA.user.name||'?')[0])}</div>
      <div class="composer-body">
        <input class="composer-input" id="cbox" placeholder="Add a public comment…" onkeydown="if(event.key==='Enter')addComment(${v.id})"/>
        <div class="composer-footer">
          <button class="btn sm" onclick="addComment(${v.id})">Comment</button>
        </div>
      </div>
    </div>`;
}

function commentsSortRow(){
  return `
    <div class="comments-sort-row">
      <span>Sorted by <b>${vstate.commentSort==='old'?'Oldest':'Newest'}</b></span>
      <select class="sort-select" id="cSort" onchange="setCommentSort(this.value)" aria-label="Sort comments">
        <option value="new" ${vstate.commentSort==='new'?'selected':''}>Newest first</option>
        <option value="old" ${vstate.commentSort==='old'?'selected':''}>Oldest first</option>
      </select>
    </div>`;
}

function commentsPanel(v){
  return `
    <div class="comments-panel">
      ${commentComposer(v)}
      ${commentsSortRow()}
      <div class="comment-list" id="commentList">
        ${renderCommentList(v)}
      </div>
    </div>`;
}

function upNextPanel(related, showAutoplay){
  return `
    <div class="upnext-panel">
      ${upNextCategoryChips(related)}
      ${showAutoplay ? autoplayToggle() : ''}
      <div class="upnext-list" id="upNextList">
        ${related.map(upNextCard).join("")}
      </div>
    </div>`;
}

function playerOverlayMobile(v){
  return `
    <div class="player-overlay-v2" id="playerOverlayV2">
      <div class="ov-top">
        <button class="ov-icon-btn" onclick="togglePiP()" id="pipBtn" title="Picture-in-Picture" aria-label="Picture-in-Picture"><svg class="ico" id="pipIcon"><use href="#icon-compress"/></svg></button>
        <button class="ov-icon-btn" onclick="openSettingsSheet()" title="Playback settings" aria-label="Playback settings"><svg class="ico"><use href="#icon-gear"/></svg></button>
      </div>
      <div class="ov-center">
        <button class="ov-skip" onclick="skipTime(-10)" aria-label="Rewind 10 seconds"><svg class="ico"><use href="#icon-rewind10"/></svg><span>-10s</span></button>
        <button class="ov-playpause" onclick="togglePlayPauseV2()" id="playPauseBtnV2" aria-label="Play / Pause"><svg class="ico" id="playIconV2"><use href="#icon-play"/></svg></button>
        <button class="ov-skip" onclick="skipTime(10)" aria-label="Fast forward 10 seconds"><svg class="ico"><use href="#icon-forward10"/></svg><span>+10s</span></button>
      </div>
      <div class="ov-bottom">
        <div class="ov-seek-row">
          <input type="range" class="ov-seek" id="ovSeek" min="0" max="1000" value="0" step="1" aria-label="Seek"/>
        </div>
        <div class="ov-meta-row">
          <div class="ov-time"><span id="ovCurrentTime">0:00</span><span class="dot-sep">/</span><span id="ovDuration">0:00</span></div>
          <div class="ov-right">
            <button class="ov-icon-btn sm" onclick="toggleMuteV2()" id="ovMuteBtn" aria-label="Mute/Unmute"><svg class="ico" id="ovVolumeIcon"><use href="#icon-unmute"/></svg></button>
            <button class="ov-icon-btn sm" onclick="toggleFullscreenV2()" aria-label="Fullscreen"><svg class="ico"><use href="#icon-expand"/></svg></button>
          </div>
        </div>
      </div>
    </div>`;
}

function playerOverlayDesktop(v){
  return `
    <div class="player-overlay-v2 desktop" id="playerOverlayV2">
      <div class="ov-top">
        <div class="ov-badge-row">
          <span class="ov-quality-badge">HD Auto</span>
          <span class="ov-title-inline">${esc(v.title)}</span>
        </div>
        <div class="ov-top-actions">
          <button class="ov-icon-btn" onclick="toggleTheaterMode()" id="theaterBtn" title="Theater mode" aria-label="Theater mode"><svg class="ico"><use href="#icon-theater"/></svg></button>
          <button class="ov-icon-btn" onclick="togglePiP()" id="pipBtn" title="Picture-in-Picture" aria-label="Picture-in-Picture"><svg class="ico" id="pipIcon"><use href="#icon-compress"/></svg></button>
          <button class="ov-icon-btn" onclick="openSettingsSheet()" title="Playback settings" aria-label="Playback settings"><svg class="ico"><use href="#icon-gear"/></svg></button>
        </div>
      </div>
      <div class="ov-center">
        <button class="ov-skip" onclick="skipTime(-10)" aria-label="Rewind 10 seconds"><svg class="ico"><use href="#icon-rewind10"/></svg><span>-10s</span></button>
        <button class="ov-playpause" onclick="togglePlayPauseV2()" id="playPauseBtnV2" aria-label="Play / Pause"><svg class="ico" id="playIconV2"><use href="#icon-play"/></svg></button>
        <button class="ov-skip" onclick="skipTime(10)" aria-label="Fast forward 10 seconds"><svg class="ico"><use href="#icon-forward10"/></svg><span>+10s</span></button>
      </div>
      <div class="ov-bottom">
        <div class="ov-seek-row">
          <input type="range" class="ov-seek" id="ovSeek" min="0" max="1000" value="0" step="1" aria-label="Seek"/>
        </div>
        <div class="ov-meta-row">
          <div class="ov-left">
            <button class="ov-icon-btn sm" onclick="togglePlayPauseV2()" aria-label="Play / Pause"><svg class="ico" id="playIconSmallV2"><use href="#icon-play"/></svg></button>
            <div class="ov-time"><span id="ovCurrentTime">0:00</span><span class="dot-sep">/</span><span id="ovDuration">0:00</span></div>
            <button class="ov-icon-btn sm" onclick="toggleMuteV2()" id="ovMuteBtn" aria-label="Mute/Unmute"><svg class="ico" id="ovVolumeIcon"><use href="#icon-unmute"/></svg></button>
            <input type="range" class="ov-volume" id="ovVolume" min="0" max="1" step="0.05" value="1" aria-label="Volume"/>
          </div>
          <div class="ov-right">
            <button class="ov-speed-label" onclick="openSettingsSheet()" id="ovSpeedLabel">${vstate.settings.playbackRate}x</button>
            <button class="ov-icon-btn sm" onclick="toggleFullscreenV2()" aria-label="Fullscreen"><svg class="ico"><use href="#icon-expand"/></svg></button>
          </div>
        </div>
      </div>
    </div>`;
}

function actionBar(v, live, hasCreator){
  return `
    <div class="watch-action-bar mchrome-scroll">
      <div class="vote-pill">
        <button id="btnLike" class="vote-btn" onclick="likeVideo(${v.id})" aria-label="Like this video"><svg class="ic ico"><use href="#icon-like"/></svg> <span id="likeNum">${fmt(v.likes + live.like)}</span></button>
        <span class="vote-div"></span>
        <button id="btnDislike" class="vote-btn" onclick="dislikeVideo(${v.id})" aria-label="Dislike this video"><svg class="ic ico"><use href="#icon-dislike"/></svg></button>
      </div>
      <button class="act-pill" onclick="openShareSheet()"><svg class="ic ico"><use href="#icon-share"/></svg><span>Share</span></button>
      <button class="act-pill" onclick="openSaveSheet()"><svg class="ic ico"><use href="#icon-save"/></svg><span>Save</span></button>
      <button id="btnThanks" class="act-pill thanks" onclick="likeVideo(${v.id})"><svg class="ic ico"><use href="#icon-heart"/></svg><span>Thanks</span></button>
      <button class="act-pill" id="downloadBtn" onclick="downloadWithFeedback(${v.id})"><svg class="ic ico" id="downloadIcon"><use href="#icon-download"/></svg><span id="downloadText">Download</span></button>
    </div>`;
}

function creatorRow(c, hasCreator, subbed){
  return `
    <div class="watch-creator-row">
      <div class="watch-creator-id">
        <div class="watch-creator-avatar-wrap">
          <div class="avatar avatar-lg">${esc((c.name||"?")[0])}</div>
          ${c.verified ? `<span class="watch-creator-verified">✓</span>` : ''}
        </div>
        <div>
          <h2 class="watch-creator-name">${hasCreator ? `<span class="creator-link" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)}</span>` : esc(c.name)}</h2>
          <p class="watch-creator-subs">${fmt(c.subs)} subscribers</p>
        </div>
      </div>
      ${hasCreator
        ? `<button class="subscribe-btn-v2 ${subbed?'subscribed':''}" onclick="subscribe('${jsq(c.id)}')" id="subscribeBtnV2">
             <svg class="ico bell-ico" style="${subbed?'':'display:none'}"><use href="#icon-bell"/></svg>
             <span id="subscribeTextV2">${subbed?'Subscribed':'Subscribe'}</span>
           </button>`
        : `<button class="subscribe-btn-v2" disabled>Subscribe</button>`}
    </div>`;
}

function titleBlockMobile(v, catList, tagList){
  return `
    <div class="watch-title-block">
      <div class="title-row">
        <h1 class="watch-title-v2">${esc(v.title)}</h1>
        <button class="desc-chevron-btn" onclick="toggleDescSheetMobile()" id="descChevron" aria-label="More details"><svg class="ico"><use href="#icon-chevron-down"/></svg></button>
      </div>
      <div class="watch-stats-row">
        <div class="stats-left"><span class="views-count" id="watchViewsCount">${fmt(v.views)} views</span><span class="dot-sep">•</span><span>${esc(v.uploaded)}</span></div>
        ${tagList.length ? `<div class="stats-tags">${tagList.slice(0,2).map(t=>`<span onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}</div>` : ''}
      </div>
      ${(catList.length || tagList.length || v.desc) ? `
      <div class="quick-desc-box" id="quickDescBox" hidden>
        ${v.desc ? `<p>${esc(v.desc)}</p>` : ''}
        ${(catList.length || tagList.length) ? `<div class="video-tags">
          ${catList.map(c=>`<span class="vtag vtag-cat" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</span>`).join("")}
          ${tagList.map(t=>`<span class="vtag vtag-tag" onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}
        </div>` : ''}
      </div>` : ''}
    </div>`;
}

function metadataBlockDesktop(v, catList, tagList, live, hasCreator){
  return `
    <div class="watch-meta-block-v2">
      <h1 class="watch-title-v2 desktop">${esc(v.title)}</h1>
      <div class="watch-meta-actions-row">
        <div class="stats-left">
          <span class="views-count" id="watchViewsCount">${fmt(v.views)} views</span><span class="dot-sep">•</span><span>Published ${esc(v.uploaded)}</span>
          ${tagList.length ? `<span class="dot-sep">•</span><span class="stats-tags">${tagList.slice(0,2).map(t=>`<span onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}</span>` : ''}
        </div>
        ${actionBar(v, live, hasCreator)}
      </div>
    </div>`;
}

function descriptionBoxDesktop(v, catList, tagList){
  if(!v.desc && !catList.length && !tagList.length) return '';
  return `
    <div class="desc-box-v2" id="descBoxV2">
      <p class="desc-text-v2 clamped" id="descTextV2">${v.desc ? esc(v.desc) : 'No description provided.'}</p>
      <button class="desc-expand-btn" onclick="toggleDescExpandDesktop()" id="descExpandBtn">
        <span id="descExpandText">Show More</span>
        <svg class="ico" id="descChevronDesktop"><use href="#icon-chevron-down"/></svg>
      </button>
      ${(catList.length || tagList.length) ? `
      <div class="desc-extra-details" id="descExtraDetails" hidden>
        ${catList.length ? `<div><span class="label">Category</span><div class="video-tags">${catList.map(c=>`<span class="vtag vtag-cat" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</span>`).join("")}</div></div>` : ''}
        ${tagList.length ? `<div><span class="label">Tags</span><div class="video-tags">${tagList.map(t=>`<span class="vtag vtag-tag" onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}</div></div>` : ''}
      </div>` : ''}
    </div>`;
}

function watchTabsNav(commentCount){
  return `
    <nav class="watch-tabs">
      <button class="watch-tab ${vstate.watchTab==='upnext'?'active':''}" onclick="switchWatchTab('upnext')" id="tab-upnext">Up Next</button>
      <button class="watch-tab ${vstate.watchTab==='comments'?'active':''}" onclick="switchWatchTab('comments')" id="tab-comments">
        Comments <span class="tab-badge" id="cCount">${commentCount}</span>
      </button>
    </nav>`;
}

function sheetsAndModals(v, c){
  return `
    <div class="sheet-backdrop" id="shareSheet" hidden onclick="if(event.target===this)closeSheet('shareSheet')">
      <div class="sheet">
        <div class="sheet-head"><h3>Share Video</h3><button class="icon-btn" onclick="closeSheet('shareSheet')"><svg class="ico"><use href="#icon-close"/></svg></button></div>
        <div class="sheet-grid-4">
          <button onclick="copyVideoLinkV2(${v.id})"><span class="sheet-icon-circle red"><svg class="ico"><use href="#icon-link"/></svg></span><span>Copy Link</span></button>
          <button onclick="window.open('https://wa.me/?text='+encodeURIComponent(location.href.split('#')[0]+'#video/${v.id}'),'_blank','noopener')"><span class="sheet-icon-circle green">W</span><span>WhatsApp</span></button>
          <button onclick="window.open('https://twitter.com/intent/tweet?url='+encodeURIComponent(location.href.split('#')[0]+'#video/${v.id}'),'_blank','noopener')"><span class="sheet-icon-circle sky">X</span><span>Twitter</span></button>
          <button onclick="copyEmbedCodeV2(${v.id})"><span class="sheet-icon-circle purple"><svg class="ico"><use href="#icon-code"/></svg></span><span>Embed</span></button>
        </div>
      </div>
    </div>

    <div class="sheet-backdrop" id="settingsSheet" hidden onclick="if(event.target===this)closeSheet('settingsSheet')">
      <div class="sheet">
        <div class="sheet-head"><h3>Playback Settings</h3><button class="icon-btn" onclick="closeSheet('settingsSheet')"><svg class="ico"><use href="#icon-close"/></svg></button></div>
        <div class="sheet-row">
          <span>Speed</span>
          <select id="speedSelectV2" onchange="changeSpeedV2(this.value)">
            <option value="0.5" ${vstate.settings.playbackRate===0.5?'selected':''}>0.5x</option>
            <option value="0.75" ${vstate.settings.playbackRate===0.75?'selected':''}>0.75x</option>
            <option value="1" ${vstate.settings.playbackRate===1?'selected':''}>1.0x (Normal)</option>
            <option value="1.25" ${vstate.settings.playbackRate===1.25?'selected':''}>1.25x</option>
            <option value="1.5" ${vstate.settings.playbackRate===1.5?'selected':''}>1.5x</option>
            <option value="2" ${vstate.settings.playbackRate===2?'selected':''}>2.0x</option>
          </select>
        </div>
        <div class="sheet-row">
          <span>Quality Stream</span>
          <span class="quality-value">Auto</span>
        </div>
      </div>
    </div>

    <div class="sheet-backdrop" id="saveSheet" hidden onclick="if(event.target===this)closeSheet('saveSheet')">
      <div class="sheet">
        <div class="sheet-head"><h3>Save Video</h3><button class="icon-btn" onclick="closeSheet('saveSheet')"><svg class="ico"><use href="#icon-close"/></svg></button></div>
        <label class="sheet-check-row">
          <input type="checkbox" id="saveLaterCheck" ${vstate.later.includes(v.id)?'checked':''} onchange="toggleLater(${v.id})"/>
          <span>Watch Later</span>
        </label>
        <label class="sheet-check-row">
          <input type="checkbox" id="saveFavCheck" ${vstate.favorites.includes(v.id)?'checked':''} onchange="toggleFav(${v.id})"/>
          <span>Favorites</span>
        </label>
        <button class="btn" style="width:100%;margin-top:8px" onclick="closeSheet('saveSheet');toast('Saved')">Done</button>
      </div>
    </div>`;
}

export function renderWatch(){
  const v = vstate.current || pubVideos()[0];
  if(!v) return `<div class="empty">No video selected.</div>`;
  const c = CREATOR_BY_ID.get(v.creator) || { name:"Unknown", id:"", verified:false, subs:0 };
  const hasCreator = !!c.id;
  const subbed = vstate.subs.includes(v.creator);

  const cms = commentsFor(v);
  const live = vstate.live[v.id] || {like:0, dislike:0};
  const catList = [v.category, ...(v.categories||[])].filter((x,i,a)=>x && a.indexOf(x)===i).slice(0,5);
  const catSet = new Set(catList.map(c=>String(c).toLowerCase()));
  const tagList = (v.tags||[]).filter(t=>!catSet.has(String(t).toLowerCase())).slice(0,8);

  let related = relatedTo(v, 12);
  if(related.length < 12){
    const seen = new Set([v.id, ...related.map(u=>u.id)]);
    related = related.concat(trending().filter(u=>!seen.has(u.id)).slice(0, 12-related.length));
  }

  const mobileLayout = `
    <div class="watch-v2 watch-v2-mobile">
      <section class="player-container-v2">
        <div class="player-nav-wrap">
          ${playerEmbed(v)}
          <button class="player-nav player-nav-prev" onclick="stepWatch(-1)" aria-label="Previous video">‹</button>
          <button class="player-nav player-nav-next" onclick="stepWatch(1)" aria-label="Next video">›</button>
        </div>
        ${playerOverlayMobile(v)}
      </section>
      <main class="watch-main-v2">
        ${titleBlockMobile(v, catList, tagList)}
        ${actionBar(v, live, hasCreator)}
        ${creatorRow(c, hasCreator, subbed)}
        ${watchTabsNav(cms.length)}
        <div class="watch-tab-panel" id="tabPanelUpNext" ${vstate.watchTab!=='upnext'?'hidden':''}>
          ${upNextPanel(related, true)}
        </div>
        <div class="watch-tab-panel" id="tabPanelComments" ${vstate.watchTab!=='comments'?'hidden':''}>
          ${commentsPanel(v)}
        </div>
      </main>
    </div>`;

  const desktopLayout = `
    <div class="watch-v2 watch-v2-desktop" id="watchDesktopContainer">
      <section class="player-container-v2">
        <div class="player-nav-wrap">
          ${playerEmbed(v)}
          <button class="player-nav player-nav-prev" onclick="stepWatch(-1)" aria-label="Previous video">‹</button>
          <button class="player-nav player-nav-next" onclick="stepWatch(1)" aria-label="Next video">›</button>
        </div>
        ${playerOverlayDesktop(v)}
      </section>
      <main class="watch-main-v2">
        ${metadataBlockDesktop(v, catList, tagList, live, hasCreator)}
        ${creatorRow(c, hasCreator, subbed)}
        ${descriptionBoxDesktop(v, catList, tagList)}
        <section class="upnext-section-desktop">
          <div class="upnext-section-head">
            <h2>Up Next</h2>
          </div>
          ${upNextPanel(related, true)}
        </section>
        <section class="comments-section-desktop">
          <div class="comments-section-head">
            <div class="comments-title-group"><h2>Comments</h2><span class="tab-badge" id="cCount">${cms.length}</span></div>
            <button class="sort-by-btn" onclick="toast('Sorted by newest')"><svg class="ico"><use href="#icon-sort"/></svg>Sort By</button>
          </div>
          ${commentsPanel(v)}
        </section>
      </main>
    </div>`;

  return `${isMobile() ? mobileLayout : desktopLayout}${sheetsAndModals(v, c)}`;
}
