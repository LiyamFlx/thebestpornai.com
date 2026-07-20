/* Creator profile page (#creator/<id>): banner, header, top + all videos. */
import { DATA, esc, fmt } from "../../shared/catalog.js";
import { videoCard } from "../../shared/ui.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { visible } from "../catalog-queries.js";
import { pagedGrid } from "../grid-window.js";

export function renderCreatorPage(){
  const cid = vstate.creatorId;
  const c = DATA.creators.find(x=>x.id===cid);
  if(!c) return `<div class="empty">Creator not found.</div>`;
  const videos = DATA.videos.filter(v=>v.creator===cid && visible(v));
  const subbed = vstate.subs.includes(cid);
  const top5 = [...videos].sort((a,b)=>(b.likes*1.2+b.views*.01)-(a.likes*1.2+a.views*.01)).slice(0,5);
  return `
    <div class="creator-page">
      <div class="creator-page-banner"></div>
      <div class="creator-page-header">
        <div class="creator-page-avatar">${esc((c.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase())}</div>
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
        ? pagedGrid(videos, v=>videoCard(v))
        : `<div class="empty">No videos yet.</div>`}
    </div>`;
}
