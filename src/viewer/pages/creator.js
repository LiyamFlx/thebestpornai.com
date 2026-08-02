/* Creator profile page (#creator/<id>): banner, header, top + all videos. */
import { DATA, esc, fmt, mediaUrl } from "../../shared/catalog.js";
import { videoCard, emptyState } from "../../shared/ui.js";
import { POPULAR_TAGS } from "../../shared/taxonomy.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { visible } from "../catalog-queries.js";
import { pagedGrid } from "../grid-window.js";

export function renderCreatorPage(){
  const cid = vstate.creatorId;
  const c = DATA.creators.find(x=>x.id===cid);
  if(!c){
    return emptyState("Creator not found.", POPULAR_TAGS.slice(0, 6), { emoji: "👤" });
  }
  const videos = DATA.videos.filter(v=>v.creator===cid && visible(v));
  const subbed = vstate.subs.includes(cid);
  const top5 = [...videos].sort((a,b)=>(b.likes*1.2+b.views*.01)-(a.likes*1.2+a.views*.01)).slice(0,5);
  const initials = esc((c.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase());
  // No dedicated cover-image field on creators yet — reuse their best-performing
  // video's thumb as channel art (real content instead of a blank gradient box).
  // Falls back to the plain gradient only when nothing has a poster.
  const bannerThumb = top5.find(v=>v.thumb)?.thumb;
  // Set as a custom property, not `background-image` directly — the .has-img
  // CSS rule layers dark gradients over it for legibility, and an inline
  // background-image would out-specificity (and fully replace) that rule.
  const bannerStyle = bannerThumb ? ` style="--creator-banner-img:url('${esc(mediaUrl(bannerThumb))}')"` : '';
  return `
    <div class="creator-page">
      <div class="creator-page-top">
        <div class="creator-page-banner${bannerThumb?' has-img':''}"${bannerStyle}></div>
        <div class="creator-page-avatar">${initials}</div>
      </div>
      <div class="creator-page-header">
        <div class="creator-page-info">
          <h2 class="creator-page-name">${esc(c.name)} ${c.verified?'<span class="verified" title="Verified">✓</span>':''}</h2>
          <div class="small" style="margin-top:4px">${c.handle?esc(c.handle)+' · ':''}${fmt(c.subs)} subscribers · ${videos.length} video${videos.length!==1?'s':''}</div>
          ${c.bio?`<p class="creator-bio">${esc(c.bio)}</p>`:''}
        </div>
        <button class="btn subscribe-btn ${subbed?'ghost':''}" onclick="subscribe('${jsq(cid)}')">${subbed?'✓ Subscribed':'＋ Subscribe'}</button>
      </div>
      ${top5.length ? `<h3 style="margin-top:28px">Top Videos</h3><div class="row-scroll">${top5.map(v=>videoCard(v)).join("")}</div>` : ''}
      <h3 style="margin-top:20px">All Videos <span class="count-bubble">${videos.length}</span></h3>
      ${videos.length
        ? pagedGrid(videos, v=>videoCard(v,{layout:'row'}), {cls:'video-list'})
        : emptyState("This creator has no published videos yet.", POPULAR_TAGS.slice(0, 6), { emoji: "🎬" })}
    </div>`;
}
