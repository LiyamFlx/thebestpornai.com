/* Watch page: player, actions, creator card, comments, related/suggested. */
import { DATA, esc, creatorName, fmt, mediaUrl, ytId } from "../../shared/catalog.js";
import { playerEmbed, videoCard } from "../../shared/ui.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { pubVideos, trending, relatedTo } from "../catalog-queries.js";
import { renderCommentList } from "../comments.js";

export function renderWatch(){
  const v = vstate.current || pubVideos()[0];
  if(!v) return `<div class="empty">No video selected.</div>`;
  const c = DATA.creators.find(x=>x.id===v.creator) || { name:"Unknown", id:"", verified:false, subs:0 };
  const subbed = vstate.subs.includes(v.creator);
  const cms = DATA.comments.filter(m=>m.video===v.id);
  const live = vstate.live[v.id] || {like:0, dislike:0};
  // Single consolidated tag row: category chips + hashtags share one container,
  // and hashtags that merely repeat a category (e.g. "Big Tits") are dropped so
  // the same label never shows twice. The cat/tag distinction stays in the data
  // and in the chip styling — only the visual duplication is removed.
  const catList = [v.category, ...(v.categories||[])].filter((x,i,a)=>x && a.indexOf(x)===i).slice(0,5);
  const catSet = new Set(catList.map(c=>String(c).toLowerCase()));
  const tagList = (v.tags||[]).filter(t=>!catSet.has(String(t).toLowerCase())).slice(0,8);
  // Tag-weighted "Up Next": videos sharing tags/category with this one, then
  // fill with trending if there aren't enough related matches.
  let related = relatedTo(v, 6);
  if(related.length < 6){
    const seen = new Set([v.id, ...related.map(u=>u.id)]);
    related = related.concat(trending().filter(u=>!seen.has(u.id)).slice(0, 6-related.length));
  }
  const suggestedCard = u=>`
    <div class="card" style="display:flex;gap:10px;margin-bottom:10px;padding:8px" data-video-id="${u.id}" onclick="openVideo(${u.id})">
      <div class="video-thumb ${u.type==='original'?'original':''}" style="width:120px;height:68px;margin:0;flex:none">
        ${u.src && !ytId(u.src) ? `<video class="thumb-video lazy" data-src="${mediaUrl(u.src)}#t=1" muted preload="none"></video>` : ``}
      </div>
      <div><div class="title">${esc(u.title)}</div><div class="meta">${esc(creatorName(u.creator))}</div><div class="small">${fmt(u.views)} views</div></div>
    </div>`;
  return `
    <div class="watch">
      <div class="player-nav-wrap">
        ${playerEmbed(v)}
        <button class="player-nav player-nav-prev" onclick="stepWatch(-1)" aria-label="Previous video">‹</button>
        <button class="player-nav player-nav-next" onclick="stepWatch(1)" aria-label="Next video">›</button>
      </div>
      <div class="watch-body">
      <div>
        <h2 class="watch-title">${esc(v.title)}</h2>
        <p class="sub watch-sub" id="watchSub"><span class="ic-eye">👁</span> ${fmt(v.views)} views <span class="dot-sep">•</span> ${esc(v.uploaded)}</p>
        ${(catList.length || tagList.length) ? `<div class="video-tags">
          ${catList.map(c=>`<span class="vtag vtag-cat" onclick="setHomeCategory('${jsq(c)}')">${esc(c)}</span>`).join("")}
          ${tagList.map(t=>`<span class="vtag vtag-tag" onclick="searchTag('${jsq(t)}')">#${esc(t)}</span>`).join("")}
        </div>` : ''}
        ${v.desc ? `<div class="watch-desc-wrap">
          <p class="watch-desc" id="watchDesc">${esc(v.desc)}</p>
          <button class="watch-desc-more" data-mobile-action="toggle-desc" aria-expanded="false">…more</button>
        </div>` : ''}

        <div class="watch-actions">
          <div class="vote-pill">
            <button id="btnLike" class="vote-btn" onclick="likeVideo(${v.id})" aria-label="Like this video"><span class="ic">👍</span> <span id="likeNum">${fmt(v.likes + live.like)}</span></button>
            <span class="vote-div"></span>
            <button id="btnDislike" class="vote-btn" onclick="dislikeVideo(${v.id})" aria-label="Dislike this video"><span class="ic">👎</span> <span id="disNum">${fmt(v.dislikes + live.dislike)}</span></button>
          </div>
          <button id="btnFav" class="act-btn ${vstate.favorites.includes(v.id)?'on':''}" onclick="toggleFav(${v.id})" aria-label="${vstate.favorites.includes(v.id)?'Remove from favorites':'Add to favorites'}"><span class="ic">♥</span> <span class="act-label">Favorite</span><span id="favCount"></span></button>
          <div class="act-overflow">
            <button class="act-btn act-more" data-mobile-action="toggle-actions-menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions">⋯</button>
            <div class="act-menu">
              <button id="btnLater" class="act-btn ${vstate.later.includes(v.id)?'on':''}" onclick="toggleLater(${v.id})" aria-label="${vstate.later.includes(v.id)?'Remove from saved':'Save for later'}"><span class="ic">🔖</span> <span class="act-label">Save</span></button>
              <button class="act-btn" onclick="shareVideo(${v.id})" aria-label="Share this video"><span class="ic">↗</span> <span class="act-label">Share</span></button>
              <button class="act-btn" onclick="reportVideo(${v.id})" title="Report" aria-label="Report"><span class="ic">⚑</span> <span class="act-label">Report</span></button>
            </div>
          </div>
        </div>

        <div class="creator-card">
          <div class="avatar avatar-lg">${esc((c.name||"?")[0])}</div>
          <div style="flex:1;min-width:0">
            <div class="creator-name"><span class="creator-link" onclick="openCreator('${jsq(c.id)}')">${esc(c.name)}</span> ${c.verified?'<span class="verified" title="Verified">✓</span>':''}</div>
            <div class="small">${fmt(c.subs)} subscribers</div>
          </div>
          <button class="btn subscribe-btn ${subbed?'ghost':''}" onclick="subscribe('${jsq(c.id)}')" aria-label="${subbed?'Unsubscribe from '+esc(c.name):'Subscribe to '+esc(c.name)}">${subbed?'Subscribed':'＋ Subscribe'}</button>
        </div>

        <div class="comments-card">
          <div class="comments-top">
            <div class="comments-title">Comments <span class="count-bubble" id="cCount">${cms.length}</span></div>
            <select class="sort-select" id="cSort" onchange="setCommentSort(this.value)">
              <option value="new" ${vstate.commentSort==='new'?'selected':''}>Newest first</option>
              <option value="old" ${vstate.commentSort==='old'?'selected':''}>Oldest first</option>
            </select>
          </div>
          <div class="comment-form">
            <div class="avatar avatar-sm">${esc((DATA.user.name||'?')[0])}</div>
            <input class="fld" id="cbox" placeholder="Add a comment…" onkeydown="if(event.key==='Enter')addComment(${v.id})"/>
            <button class="btn" onclick="addComment(${v.id})">Comment</button>
          </div>
          <div class="comment-list-wrap" id="commentListWrap">
            <div class="comment-list" id="commentList">
              ${renderCommentList(v)}
            </div>
            ${cms.length > 2 ? `<button class="comment-list-more" data-mobile-action="toggle-comments" aria-expanded="false">View all ${cms.length} comments</button>` : ''}
          </div>
        </div>

        <div class="related-below">
          <h3>Up Next</h3>
          ${related.map(suggestedCard).join("")}
        </div>
      </div>
      <div class="watch-side">
        <h3 style="margin-top:0">Suggested Videos</h3>
        ${related.map(suggestedCard).join("")}
      </div>
      </div>
    </div>`;
}
