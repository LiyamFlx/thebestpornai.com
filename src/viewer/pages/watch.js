/* Watch page: player, actions, creator card, tabs (mobile) / stacked sections
   (desktop), comments, related/suggested.
   Caller must call attachWatchHandlers() once after mounting renderWatch()'s
   HTML — same pattern as feed.js's attachFeedObserver(). Idempotent. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { playerEmbed } from "../../shared/ui.js";
import { ShAPI } from "../../shared/streamhub-api.js";
import { storedVoteFor } from "../../shared/vote-logic.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { displayViews } from "../display-metrics.js";
import { pubVideos, trending, relatedTo, creatorById } from "../catalog-queries.js";
import { renderCommentList, commentsFor } from "../comments.js";
import { postsForVideoId } from "../../blog/posts.js";

const MOBILE = "(max-width:760px)";
const isMobile = () => !!(window.matchMedia && window.matchMedia(MOBILE).matches);

function fmtDuration(v){
  // Catalog entries already carry a formatted duration string (e.g. "0:26").
  return v.duration || "";
}

// role="link" not <button> — it nests a real <button> (more options).
function upNextCard(u){
  const isPreviewable = u.src && !ytId(u.src);
  const thumb = u.thumb
    ? `<img src="${mediaUrl(u.thumb)}" alt="" loading="lazy" decoding="async"/>`
    : (isPreviewable ? `<video class="thumb-video lazy" data-src="${mediaUrl(u.src)}#t=1" muted preload="none" playsinline loop></video>` : ``);
  const label = `${u.title} by ${creatorName(u.creator)}`;
  return `
    <div class="upnext-card" data-act="open-video" data-video-id="${u.id}" data-category="${esc(u.category||'')}" data-title="${esc(u.title)}" data-creator="${esc(creatorName(u.creator))}" data-thumb="${u.thumb ? esc(mediaUrl(u.thumb)) : ''}" role="link" tabindex="0" aria-label="${esc(label)}">
      <div class="upnext-thumb">
        ${thumb}
        ${fmtDuration(u) ? `<span class="upnext-duration">${esc(fmtDuration(u))}</span>` : ''}
      </div>
      <div class="upnext-info">
        <h3 class="upnext-title">${esc(u.title)}</h3>
        <p class="upnext-creator">${esc(creatorName(u.creator))}</p>
        <p class="upnext-meta">${fmt(displayViews(u))} views <span class="dot-sep">•</span> ${esc(u.uploaded)}</p>
      </div>
      <button type="button" class="upnext-more" data-act="upnext-more" data-toast="Added to queue" aria-label="More options">
        <svg class="ico"><use href="#icon-more"/></svg>
      </button>
    </div>`;
}

// data-upnext-cat kept (filterUpNext() keys off it); data-act is the new hook.
function upNextCategoryChips(related){
  const cats = [...new Set(related.map(u=>u.category).filter(Boolean))].slice(0, 4);
  return `<div class="upnext-chips mchrome-scroll" role="group" aria-label="Filter up next by category">
    <button type="button" class="upnext-chip active" data-act="filter-upnext" data-upnext-cat="">All</button>
    ${cats.map(c=>`<button type="button" class="upnext-chip" data-act="filter-upnext" data-upnext-cat="${esc(c)}">${esc(c)}</button>`).join("")}
  </div>`;
}

// Single autoplay-toggle definition, used by both call sites (was duplicated 2x + a dead copy).
function autoplayToggle(compact = true){
  if (compact) {
    return `
      <label class="autoplay-compact-toggle" title="Autoplay next video">
        <span class="ap-text">Autoplay</span>
        <input type="checkbox" data-act="toggle-autoplay" ${vstate.settings.autoplay?'checked':''}/>
        <div class="switch-track-sm"></div>
      </label>`;
  }
  return `
    <div class="upnext-autoplay-row">
      <span class="label">Autoplay next video</span>
      <label class="switch-wrap">
        <input type="checkbox" data-act="toggle-autoplay" ${vstate.settings.autoplay?'checked':''}/>
        <div class="switch-track"></div>
      </label>
    </div>`;
}

function commentComposer(v){
  const who = (typeof ShAPI !== "undefined" && ShAPI.commentAuthor) ? ShAPI.commentAuthor() : "Guest";
  return `
    <div class="comment-composer">
      <div class="avatar avatar-sm">${esc((who||'?')[0])}</div>
      <div class="composer-body">
        <input class="composer-input" id="cbox" data-act="comment-input" data-video="${v.id}" placeholder="Add a public comment…"/>
        <div class="composer-footer">
          <button type="button" class="btn sm" data-act="add-comment" data-video="${v.id}">Comment</button>
        </div>
      </div>
    </div>`;
}

// Real sort control, shared by mobile + desktop (desktop's old "Sort By" button was a no-op).
function commentsSortRow(){
  return `
    <div class="comments-sort-row">
      <span>Sorted by <b>${vstate.commentSort==='old'?'Oldest':'Newest'}</b></span>
      <select class="sort-select" id="cSort" data-act="sort-comments" aria-label="Sort comments">
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

function upNextPanel(related, showHead = false){
  return `
    <div class="upnext-panel">
      ${showHead ? `
        <div class="upnext-head-bar">
          ${upNextCategoryChips(related)}
          ${autoplayToggle(true)}
        </div>
      ` : ''}
      <div class="upnext-list" id="upNextList">
        ${related.map(upNextCard).join("")}
      </div>
    </div>`;
}

function playerOverlayMobile(v){
  return `
    <div class="player-overlay-v2 player-overlay-v2--mobile" id="playerOverlayV2">
      <div class="ov-center">
        <button type="button" class="ov-skip" data-act="skip" data-sec="-10" aria-label="Rewind 10 seconds"><svg class="ico"><use href="#icon-rewind10"/></svg><span>-10s</span></button>
        <button type="button" class="ov-playpause" data-act="toggle-playpause" id="playPauseBtnV2" aria-label="Play / Pause"><svg class="ico" id="playIconV2"><use href="#icon-play"/></svg></button>
        <button type="button" class="ov-skip" data-act="skip" data-sec="10" aria-label="Fast forward 10 seconds"><svg class="ico"><use href="#icon-forward10"/></svg><span>+10s</span></button>
      </div>
      <div class="ov-bottom">
        <div class="ov-seek-row">
          <input type="range" class="ov-seek" id="ovSeek" min="0" max="1000" value="0" step="1" aria-label="Seek"/>
        </div>
        <div class="ov-meta-row">
          <div class="ov-time"><span id="ovCurrentTime">0:00</span><span class="dot-sep">/</span><span id="ovDuration">0:00</span></div>
          <div class="ov-right">
            <button type="button" class="ov-icon-btn sm" data-act="toggle-mute" id="ovMuteBtn" aria-label="Mute/Unmute"><svg class="ico" id="ovVolumeIcon"><use href="#icon-unmute"/></svg></button>
            <button type="button" class="ov-icon-btn sm" data-act="open-sheet" data-sheet="settingsSheet" aria-label="Playback settings"><svg class="ico"><use href="#icon-gear"/></svg></button>
            <button type="button" class="ov-icon-btn sm" data-act="toggle-fullscreen" aria-label="Fullscreen"><svg class="ico"><use href="#icon-expand"/></svg></button>
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
          <button type="button" class="ov-icon-btn" data-act="toggle-theater" id="theaterBtn" title="Theater mode" aria-label="Theater mode"><svg class="ico"><use href="#icon-theater"/></svg></button>
          <button type="button" class="ov-icon-btn" data-act="toggle-pip" id="pipBtn" title="Picture-in-Picture" aria-label="Picture-in-Picture"><svg class="ico" id="pipIcon"><use href="#icon-compress"/></svg></button>
          <button type="button" class="ov-icon-btn" data-act="open-sheet" data-sheet="settingsSheet" title="Playback settings" aria-label="Playback settings"><svg class="ico"><use href="#icon-gear"/></svg></button>
        </div>
      </div>
      <div class="ov-center">
        <button type="button" class="ov-skip" data-act="skip" data-sec="-10" aria-label="Rewind 10 seconds"><svg class="ico"><use href="#icon-rewind10"/></svg><span>-10s</span></button>
        <button type="button" class="ov-playpause" data-act="toggle-playpause" id="playPauseBtnV2" aria-label="Play / Pause"><svg class="ico" id="playIconV2"><use href="#icon-play"/></svg></button>
        <button type="button" class="ov-skip" data-act="skip" data-sec="10" aria-label="Fast forward 10 seconds"><svg class="ico"><use href="#icon-forward10"/></svg><span>+10s</span></button>
      </div>
      <div class="ov-bottom">
        <div class="ov-seek-row">
          <input type="range" class="ov-seek" id="ovSeek" min="0" max="1000" value="0" step="1" aria-label="Seek"/>
        </div>
        <div class="ov-meta-row">
          <div class="ov-left">
            <button type="button" class="ov-icon-btn sm" data-act="toggle-playpause" aria-label="Play / Pause"><svg class="ico" id="playIconSmallV2"><use href="#icon-play"/></svg></button>
            <div class="ov-time"><span id="ovCurrentTime">0:00</span><span class="dot-sep">/</span><span id="ovDuration">0:00</span></div>
            <button type="button" class="ov-icon-btn sm" data-act="toggle-mute" id="ovMuteBtn" aria-label="Mute/Unmute"><svg class="ico" id="ovVolumeIcon"><use href="#icon-unmute"/></svg></button>
            <input type="range" class="ov-volume" id="ovVolume" min="0" max="1" step="0.05" value="1" aria-label="Volume"/>
          </div>
          <div class="ov-right">
            <button type="button" class="ov-speed-label" data-act="open-sheet" data-sheet="settingsSheet" id="ovSpeedLabel">${vstate.settings.playbackRate}x</button>
            <button type="button" class="ov-icon-btn sm" data-act="toggle-fullscreen" aria-label="Fullscreen"><svg class="ico"><use href="#icon-expand"/></svg></button>
          </div>
        </div>
      </div>
    </div>`;
}

function actionBar(v, live, hasCreator, { compact = false } = {}){
  const laterOn = vstate.later.includes(v.id);
  const favOn = vstate.favorites.includes(v.id);
  if (compact) {
    return `
    <div class="watch-action-bar watch-action-bar--icons" role="toolbar" aria-label="Video actions">
      <button type="button" id="btnLike" class="act-ico ${live.myVote==="like"?"on":""}" data-act="like" data-id="${v.id}" aria-pressed="${live.myVote==="like"?"true":"false"}" aria-label="Like this video"><svg class="ic ico"><use href="#icon-like"/></svg><span id="likeNum">${fmt(v.likes + live.like)}</span></button>
      <button type="button" id="btnDislike" class="act-ico ${live.myVote==="dislike"?"on":""}" data-act="dislike" data-id="${v.id}" aria-pressed="${live.myVote==="dislike"?"true":"false"}" aria-label="Dislike this video"><svg class="ic ico"><use href="#icon-dislike"/></svg></button>
      <button type="button" class="act-ico" data-act="switch-tab" data-tab="comments" aria-label="Comments"><svg class="ic ico"><use href="#icon-comment"/></svg></button>
      <button type="button" class="act-ico" data-act="open-sheet" data-sheet="shareSheet" aria-label="Share"><svg class="ic ico"><use href="#icon-share"/></svg></button>
      <button type="button" class="act-ico ${laterOn?'on':''}" id="btnLater" data-act="toggle-later" data-id="${v.id}" aria-pressed="${laterOn?'true':'false'}" aria-label="Save"><svg class="ic ico"><use href="#icon-save"/></svg></button>
      <button type="button" class="act-ico ${favOn?'on':''}" id="btnFav" data-act="toggle-fav" data-id="${v.id}" aria-pressed="${favOn?'true':'false'}" aria-label="Favorite"><svg class="ic ico"><use href="#icon-heart"/></svg></button>
    </div>`;
  }
  return `
    <div class="watch-action-bar mchrome-scroll" role="toolbar" aria-label="Video actions">
      <div class="vote-pill">
        <button type="button" id="btnLike" class="vote-btn ${live.myVote==="like"?"on":""}" data-act="like" data-id="${v.id}" aria-pressed="${live.myVote==="like"?"true":"false"}" aria-label="Like this video"><svg class="ic ico"><use href="#icon-like"/></svg> <span id="likeNum">${fmt(v.likes + live.like)}</span></button>
        <span class="vote-div" aria-hidden="true"></span>
        <button type="button" id="btnDislike" class="vote-btn ${live.myVote==="dislike"?"on":""}" data-act="dislike" data-id="${v.id}" aria-pressed="${live.myVote==="dislike"?"true":"false"}" aria-label="Dislike this video"><svg class="ic ico"><use href="#icon-dislike"/></svg></button>
      </div>
      <button type="button" class="act-pill" data-act="open-sheet" data-sheet="shareSheet"><svg class="ic ico"><use href="#icon-share"/></svg><span>Share</span></button>
      <button type="button" class="act-pill ${laterOn?'on':''}" id="btnLater" data-act="toggle-later" data-id="${v.id}" aria-pressed="${laterOn?'true':'false'}"><svg class="ic ico"><use href="#icon-save"/></svg><span>Save</span></button>
      <button type="button" class="act-pill ${favOn?'on':''}" id="btnFav" data-act="toggle-fav" data-id="${v.id}" aria-pressed="${favOn?'true':'false'}"><svg class="ic ico"><use href="#icon-heart"/></svg><span>Fav</span></button>
      <button type="button" class="act-pill" id="downloadBtn" data-act="download" data-id="${v.id}"><svg class="ic ico" id="downloadIcon"><use href="#icon-download"/></svg><span id="downloadText">Download</span></button>
    </div>`;
}

// subscribeBtnV2/subscribeTextV2 ids repeat in creatorRowMobile() — safe only because
// mobile/desktop never both mount at once. Dedupe first if that ever changes.
function creatorRow(c, hasCreator, subbed){
  return `
    <div class="watch-creator-row">
      <div class="watch-creator-id">
        <div class="watch-creator-avatar-wrap">
          <div class="avatar avatar-lg">${esc((c.name||"?")[0])}</div>
          ${c.verified ? `<span class="watch-creator-verified">✓</span>` : ''}
        </div>
        <div>
          <h2 class="watch-creator-name">${hasCreator ? `<button type="button" class="creator-link" data-act="open-creator" data-creator="${jsq(c.id)}">${esc(c.name)}</button>` : esc(c.name)}</h2>
          <p class="watch-creator-subs">${fmt(c.subs)} subscribers</p>
        </div>
      </div>
      ${hasCreator
        ? `<button type="button" class="subscribe-btn-v2 ${subbed?'subscribed':''}" data-act="subscribe" data-creator="${jsq(c.id)}" id="subscribeBtnV2" aria-pressed="${subbed?'true':'false'}">
             <svg class="ico bell-ico" style="${subbed?'':'display:none'}"><use href="#icon-bell"/></svg>
             <span id="subscribeTextV2">${subbed?'Subscribed':'Subscribe'}</span>
           </button>`
        : `<button type="button" class="subscribe-btn-v2" disabled>Subscribe</button>`}
    </div>`;
}


function creatorRowMobile(c, hasCreator, subbed){
  return `
    <div class="watch-creator-row-mobile">
      <button type="button" class="creator-mobile-id" data-act="open-creator" data-creator="${jsq(c.id)}" aria-label="Open ${esc(c.name)}'s channel">
        <span class="creator-mobile-name">${esc(c.name)}</span>
        ${c.verified ? `<span class="watch-creator-verified-sm">✓</span>` : ''}
        <span class="creator-mobile-subs">${fmt(c.subs)}</span>
      </button>
      ${hasCreator
        ? `<button type="button" class="subscribe-btn-sm ${subbed?'subscribed':''}" data-act="subscribe" data-creator="${jsq(c.id)}" id="subscribeBtnV2" aria-pressed="${subbed?'true':'false'}">
             <span id="subscribeTextV2">${subbed?'Subscribed':'Subscribe'}</span>
           </button>`
        : ''}
    </div>`;
}

function blogStoryChip(v){
  const posts = postsForVideoId(v.id);
  if(!posts.length) return "";
  const p = posts[0];
  return `<a class="watch-blog-chip" href="/blog/${esc(p.slug)}.html">📖 Story behind this scene</a>`;
}

function affiliatePromoBanner(v){
  return `
    <div class="watch-affiliate-banner">
      <div class="affiliate-banner-inner">
        <div class="affiliate-badge-row">
          <span class="affiliate-badge-pill">⚡ AI STUDIO PARTNER</span>
        </div>
        <div class="affiliate-text-block">
          <div class="affiliate-title">Create Custom AI Adult Videos &amp; 4K Scenes</div>
          <div class="affiliate-desc">Use <strong>OurDream.ai</strong> to generate high-fidelity photoreal AI babes, uncensored fantasies, and cinematic videos with zero restrictions.</div>
        </div>
      </div>
      <a href="https://www.ourdreamersai13.com/9B73ZMB/2CTPL/?uid=172&s1=watch-banner" target="_blank" rel="noopener sponsored nofollow" class="affiliate-cta-btn">
        <span>Start Generating Free</span>
        <span class="cta-arrow">→</span>
      </a>
    </div>`;
}


function tagChipsInline(tagList){
  return tagList.slice(0,2).map(t=>`<button type="button" class="tag-chip-inline" data-act="search-tag" data-tag="${jsq(t)}">#${esc(t)}</button>`).join(" ");
}

function fmtWatchDate(iso){
  if(!iso) return "";
  const d = new Date(String(iso).length <= 10 ? iso + "T00:00:00Z" : iso);
  if(Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function titleBlockMobile(v, catList, tagList, live, c, hasCreator, subbed){
  return `
    <div class="watch-title-block">
      <div class="title-row">
        <h1 class="watch-title-v2">${esc(v.title)}</h1>
        <button type="button" class="desc-chevron-btn" data-act="toggle-desc-mobile" id="descChevron" aria-expanded="false" aria-controls="quickDescBox" aria-label="More details"><svg class="ico"><use href="#icon-chevron-down"/></svg></button>
      </div>
      <div class="watch-stats-inline">
        <span class="views-count" id="watchViewsCount">${fmt(displayViews(v))} views</span>
        <span class="dot-sep">•</span>
        <span>${esc(fmtWatchDate(v.uploaded))}</span>
        ${tagList.length ? `<span class="dot-sep">•</span><span class="stats-tags">${tagChipsInline(tagList)}</span>` : ''}
      </div>
      ${creatorRowMobile(c, hasCreator, subbed)}
      ${actionBar(v, live, hasCreator, { compact: true })}
      ${blogStoryChip(v)}
      ${(catList.length || tagList.length || v.desc) ? `
      <div class="quick-desc-box" id="quickDescBox" hidden>
        ${v.desc ? `<p>${esc(v.desc)}</p>` : ''}
        ${(catList.length || tagList.length) ? `<div class="video-tags">
          ${catList.map(c=>`<button type="button" class="vtag vtag-cat" data-act="set-category" data-cat="${jsq(c)}">${esc(c)}</button>`).join("")}
          ${tagList.map(t=>`<button type="button" class="vtag vtag-tag" data-act="search-tag" data-tag="${jsq(t)}">#${esc(t)}</button>`).join("")}
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
          <span class="views-count" id="watchViewsCount">${fmt(displayViews(v))} views</span><span class="dot-sep">•</span><span>Published ${esc(fmtWatchDate(v.uploaded))}</span>
          ${tagList.length ? `<span class="dot-sep">•</span><span class="stats-tags">${tagChipsInline(tagList)}</span>` : ''}
        </div>
        ${actionBar(v, live, hasCreator)}
      </div>
      ${affiliatePromoBanner(v)}
      ${blogStoryChip(v)}
    </div>`;
}

function descriptionBoxDesktop(v, catList, tagList){
  return `
    <div class="desc-box-v2">
      <p class="desc-text-v2 clamped" id="descTextV2">${esc(v.desc || "No description provided.")}</p>
      <button type="button" class="desc-expand-btn" id="descExpandBtn" data-act="desc-expand" aria-expanded="false" aria-controls="descExtraDetails">
        <span>Show more</span><svg class="ico"><use href="#icon-chevron-down"/></svg>
      </button>
      <div class="desc-extra-details" id="descExtraDetails" hidden>
        <div><span class="label">Duration</span><span>${esc(v.duration||"—")}</span></div>
        <div><span class="label">Categories</span><span>${catList.length?catList.map(c=>`<button type="button" class="vtag vtag-cat" data-act="set-category" data-cat="${jsq(c)}">${esc(c)}</button>`).join(" "):"—"}</span></div>
        <div><span class="label">Tags</span><span>${tagList.length?tagList.map(t=>`<button type="button" class="vtag vtag-tag" data-act="search-tag" data-tag="${jsq(t)}">#${esc(t)}</button>`).join(" "):"—"}</span></div>
      </div>
    </div>`;
}


function watchTabsNav(commentCount){
  const upnextActive = vstate.watchTab === 'upnext';
  return `
    <div class="watch-tabs-row-mobile">
      <nav class="watch-tabs" role="tablist" aria-label="Watch page sections">
        <button type="button" class="watch-tab ${upnextActive?'active':''}" data-act="switch-tab" data-tab="upnext" id="tab-upnext" role="tab" aria-selected="${upnextActive?'true':'false'}" aria-controls="tabPanelUpNext">Up Next</button>
        <button type="button" class="watch-tab ${!upnextActive?'active':''}" data-act="switch-tab" data-tab="comments" id="tab-comments" role="tab" aria-selected="${!upnextActive?'true':'false'}" aria-controls="tabPanelComments">
          Comments <span class="tab-badge" id="cCount">${commentCount}</span>
        </button>
      </nav>
      ${autoplayToggle(true)}
    </div>`;
}


function sheetsAndModals(v, c){
  const shareUrl = typeof location !== "undefined" ? `${location.origin}/watch/${v.id}` : `https://www.thebestpornai.com/watch/${v.id}`;
  return `
    <div class="sheet-backdrop" id="shareSheet" hidden aria-hidden="true" data-act="close-sheet-backdrop" data-sheet="shareSheet">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shareSheetTitle">
        <div class="sheet-head"><h3 id="shareSheetTitle">Share Video</h3><button type="button" class="icon-btn" data-act="close-sheet" data-sheet="shareSheet" aria-label="Close"><svg class="ico"><use href="#icon-close"/></svg></button></div>
        <div class="sheet-grid-4">
          <button type="button" data-act="copy-link" data-id="${v.id}"><span class="sheet-icon-circle red"><svg class="ico"><use href="#icon-link"/></svg></span><span>Copy Link</span></button>
          <a href="https://wa.me/?text=${encodeURIComponent(shareUrl)}" data-act="share-whatsapp" data-id="${v.id}" target="_blank" rel="noopener"><span class="sheet-icon-circle green">W</span><span>WhatsApp</span></a>
          <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}" data-act="share-twitter" data-id="${v.id}" target="_blank" rel="noopener"><span class="sheet-icon-circle sky">X</span><span>Twitter</span></a>
          <button type="button" data-act="copy-embed" data-id="${v.id}"><span class="sheet-icon-circle purple"><svg class="ico"><use href="#icon-code"/></svg></span><span>Embed</span></button>
        </div>
      </div>
    </div>

    <div class="sheet-backdrop" id="settingsSheet" hidden aria-hidden="true" data-act="close-sheet-backdrop" data-sheet="settingsSheet">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="settingsSheetTitle">
        <div class="sheet-head"><h3 id="settingsSheetTitle">Playback Settings</h3><button type="button" class="icon-btn" data-act="close-sheet" data-sheet="settingsSheet" aria-label="Close"><svg class="ico"><use href="#icon-close"/></svg></button></div>
        <div class="sheet-row">
          <span>Speed</span>
          <select id="speedSelectV2" data-act="change-speed">
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
        <div class="sheet-row">
          <span>Hover Trailer Preview</span>
          <input type="checkbox" class="switch" data-act="toggle-hover-preview" ${vstate.settings.hoverPreview!==false?'checked':''}/>
        </div>
      </div>
    </div>

    <div class="sheet-backdrop" id="saveSheet" hidden aria-hidden="true" data-act="close-sheet-backdrop" data-sheet="saveSheet">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="saveSheetTitle">
        <div class="sheet-head"><h3 id="saveSheetTitle">Save Video</h3><button type="button" class="icon-btn" data-act="close-sheet" data-sheet="saveSheet" aria-label="Close"><svg class="ico"><use href="#icon-close"/></svg></button></div>
        <label class="sheet-check-row">
          <input type="checkbox" id="saveLaterCheck" data-act="toggle-later" data-id="${v.id}" ${vstate.later.includes(v.id)?'checked':''}/>
          <span>Watch Later</span>
        </label>
        <label class="sheet-check-row">
          <input type="checkbox" id="saveFavCheck" data-act="toggle-fav" data-id="${v.id}" ${vstate.favorites.includes(v.id)?'checked':''}/>
          <span>Favorites</span>
        </label>
        <button type="button" class="btn" style="width:100%;margin-top:8px" data-act="save-done" data-sheet="saveSheet" data-toast="Saved">Done</button>
      </div>
    </div>`;
}

export function renderWatch(){
  const v = vstate.current || pubVideos()[0];
  if(!v) return `<div class="empty">No video selected.</div>`;
  const c = creatorById(v.creator) || { name:"Unknown", id:"", verified:false, subs:0 };
  const hasCreator = !!c.id;
  const subbed = vstate.subs.includes(v.creator);

  const cms = commentsFor(v);
  const live = vstate.live[v.id] = vstate.live[v.id] || {like:0, dislike:0};
  if (!live.myVote) live.myVote = storedVoteFor(v.id);
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
        </div>
        ${playerOverlayMobile(v)}
      </section>
      <main class="watch-main-v2">
        ${titleBlockMobile(v, catList, tagList, live, c, hasCreator, subbed)}
        ${watchTabsNav(cms.length)}
        <div class="watch-tab-panel" id="tabPanelUpNext" role="tabpanel" aria-labelledby="tab-upnext" ${vstate.watchTab!=='upnext'?'hidden':''}>
          ${upNextPanel(related, false)}
        </div>
        <div class="watch-tab-panel" id="tabPanelComments" role="tabpanel" aria-labelledby="tab-comments" ${vstate.watchTab!=='comments'?'hidden':''}>
          ${commentsPanel(v)}
        </div>
      </main>
    </div>`;

  const desktopLayout = `
    <div class="watch-v2 watch-v2-desktop" id="watchDesktopContainer">
      <section class="player-container-v2">
        <div class="player-nav-wrap">
          ${playerEmbed(v)}
          <button type="button" class="player-nav player-nav-prev" data-act="step" data-dir="-1" aria-label="Previous video">‹</button>
          <button type="button" class="player-nav player-nav-next" data-act="step" data-dir="1" aria-label="Next video">›</button>
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
          </div>
          ${commentsPanel(v)}
        </section>
      </main>
    </div>`;

  return `${isMobile() ? mobileLayout : desktopLayout}${sheetsAndModals(v, c)}`;
}

/* =========================================================================
   Handlers: delegation, ARIA state, sheet open/close, breakpoint switching.
   Bound once (module-level guards) — safe to call attachWatchHandlers() on
   every watch-page navigation.
   ========================================================================= */

let _handlersBound = false;
let _mq = null;                 // MediaQueryList for the mobile breakpoint
let _mqListener = null;         // bound listener, so it can be removed/replaced
let _lastSheetTrigger = null;   // element to return focus to on sheet close

function call(name, ...args){
  const fn = window[name];
  if (typeof fn === "function") return fn(...args);
  console.warn(`[watch] window.${name} is not defined`);
}

function openSheetEl(sheetId, triggerEl){
  const el = document.getElementById(sheetId);
  if(!el) return;
  _lastSheetTrigger = triggerEl || document.activeElement;
  el.hidden = false;
  el.setAttribute("aria-hidden", "false");
  const focusable = el.querySelector('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
  if(focusable) try { focusable.focus({ preventScroll: true }); } catch(_) { focusable.focus(); }
}

function closeSheetEl(sheetId){
  const el = document.getElementById(sheetId);
  if(!el) return;
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  if(_lastSheetTrigger && document.contains(_lastSheetTrigger)){
    try { _lastSheetTrigger.focus({ preventScroll: true }); } catch(_) {}
  }
  _lastSheetTrigger = null;
}

function closeTopmostSheet(){
  const open = document.querySelectorAll(".sheet-backdrop:not([hidden])");
  if(!open.length) return false;
  closeSheetEl(open[open.length - 1].id);
  return true;
}

/* Central dispatch — same table drives click, change, and Enter/Space
   keydown so every action has exactly one implementation. `el` is the
   element carrying data-act; `evtType` distinguishes checkbox/select
   "change" from button "click" where the same data-act serves both
   (toggle-later, toggle-fav, toggle-autoplay). */
function dispatch(el, evtType, evt){
  const act = el.dataset.act;
  switch(act){
    case "open-video": {
      const id = +el.dataset.videoId;
      if(Number.isFinite(id)) call("openVideo", id);
      break;
    }
    case "upnext-more":
      evt && evt.stopPropagation();
      call("toast", el.dataset.toast || "Added");
      break;
    case "filter-upnext":
      call("filterUpNext", el.dataset.upnextCat || "");
      break;
    case "toggle-autoplay":
      call("toggleAutoplaySetting", !!el.checked);
      break;
    case "toggle-hover-preview":
      call("toggleHoverPreviewSetting", !!el.checked);
      break;
    case "comment-input":
      if(evt && evt.key === "Enter"){
        evt.preventDefault();
        call("addComment", +el.dataset.video);
      }
      break;
    case "add-comment":
      call("addComment", +el.dataset.video);
      break;
    case "sort-comments":
      call("setCommentSort", el.value);
      break;
    case "switch-tab":
      call("switchWatchTab", el.dataset.tab);
      break;
    case "like":
      call("likeVideo", +el.dataset.id);
      break;
    case "dislike":
      call("dislikeVideo", +el.dataset.id);
      break;
    case "open-sheet":
      openSheetEl(el.dataset.sheet, el);
      break;
    case "close-sheet":
      closeSheetEl(el.dataset.sheet);
      break;
    case "close-sheet-backdrop":
      closeSheetEl(el.dataset.sheet);
      break;
    case "save-done":
      closeSheetEl(el.dataset.sheet);
      call("toast", el.dataset.toast || "Saved");
      break;
    case "toggle-later":
      call("toggleLater", +el.dataset.id);
      break;
    case "toggle-fav":
      call("toggleFav", +el.dataset.id);
      break;
    case "download":
      call("downloadWithFeedback", +el.dataset.id);
      break;
    case "open-creator":
      call("openCreator", el.dataset.creator);
      break;
    case "subscribe":
      call("subscribe", el.dataset.creator);
      break;
    case "search-tag":
      call("searchTag", el.dataset.tag);
      break;
    case "set-category":
      call("setHomeCategory", el.dataset.cat);
      break;
    case "toggle-desc-mobile": {
      call("toggleDescSheetMobile");
      const expanded = el.getAttribute("aria-expanded") === "true";
      el.setAttribute("aria-expanded", expanded ? "false" : "true");
      break;
    }
    case "desc-expand": {
      call("toggleDescExpand");
      const expanded = el.getAttribute("aria-expanded") === "true";
      el.setAttribute("aria-expanded", expanded ? "false" : "true");
      break;
    }
    case "step":
      call("stepWatch", +el.dataset.dir);
      break;
    case "toggle-pip":
      call("togglePiP");
      break;
    case "skip":
      call("skipTime", +el.dataset.sec);
      break;
    case "toggle-playpause":
      call("togglePlayPauseV2");
      break;
    case "toggle-mute":
      call("toggleMuteV2");
      break;
    case "toggle-fullscreen":
      call("toggleFullscreenV2");
      break;
    case "toggle-theater":
      call("toggleTheaterMode");
      break;
    case "change-speed":
      call("changeSpeedV2", el.value);
      break;
    case "copy-link":
      call("copyVideoLinkV2", +el.dataset.id);
      break;
    case "copy-embed":
      call("copyEmbedCodeV2", +el.dataset.id);
      break;
    default:
      break;
  }
}

// TODO: verify #video/<id> hash shape against router.js's route table.
function primeShareLink(el){
  const id = el.dataset.id;
  const url = location.origin + "/watch/" + id;
  if(el.dataset.act === "share-whatsapp"){
    el.href = "https://wa.me/?text=" + encodeURIComponent(url);
  } else if(el.dataset.act === "share-twitter"){
    el.href = "https://twitter.com/intent/tweet?url=" + encodeURIComponent(url);
  }
}

function onDocClick(e){
  if(e.target.matches && e.target.matches('[data-act="close-sheet-backdrop"]')){
    dispatch(e.target, "click", e);
    return;
  }

  const shareLink = e.target.closest('[data-act="share-whatsapp"],[data-act="share-twitter"]');
  if(shareLink) primeShareLink(shareLink);

  const el = e.target.closest("[data-act]");
  if(!el) return;
  dispatch(el, "click", e);
}

function onDocChange(e){
  const el = e.target.closest("[data-act]");
  if(!el) return;
  if(["toggle-autoplay","toggle-hover-preview","sort-comments","change-speed","toggle-later","toggle-fav","comment-input"].includes(el.dataset.act)){
    dispatch(el, "change", e);
  }
}

function onDocKeydown(e){
  if(e.key === "Escape"){
    if(closeTopmostSheet()) e.stopPropagation();
    return;
  }

  if(e.key === "Enter" && e.target.matches('[data-act="comment-input"]')){
    dispatch(e.target, "keydown", e);
    return;
  }

  if((e.key === "Enter" || e.key === " ") && e.target.matches('[data-act="open-video"]')){
    e.preventDefault();
    dispatch(e.target, "keydown", e);
  }
}

// Re-renders in place via #view when crossing the mobile breakpoint; no-op off the watch page.
function bindBreakpointSwitch(){
  if(_mq && _mqListener) _mq.removeEventListener("change", _mqListener);
  _mq = window.matchMedia(MOBILE);
  _mqListener = () => {
    if(vstate.page !== "watch") return;
    const view = document.getElementById("view");
    if(!view) return;
    view.innerHTML = renderWatch();
    attachWatchHandlers();
  };
  _mq.addEventListener("change", _mqListener);
}

export function attachWatchHandlers(){
  if(!_handlersBound){
    document.addEventListener("click", onDocClick);
    document.addEventListener("change", onDocChange);
    document.addEventListener("keydown", onDocKeydown);
    _handlersBound = true;
  }
  bindBreakpointSwitch();
}