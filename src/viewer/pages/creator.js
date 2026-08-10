/* Creator profile page (#creator/<id>): banner, header, top + all videos.
   kind:"pornstar" gets avatar/banner, intro CTA, Shorts strip vs All. */
import { DATA, esc, fmt, mediaUrl } from "../../shared/catalog.js";
import { videoCard, emptyState, tagChips } from "../../shared/ui.js";
import { POPULAR_TAGS } from "../../shared/taxonomy.js";
import { vstate } from "../state.js";
import { jsq } from "../util.js";
import { visible } from "../catalog-queries.js";
import { pagedGrid } from "../grid-window.js";

function isPornstar(c){ return c && c.kind === "pornstar"; }

function resolveIntro(c, videos){
  if(c.introVideoId != null){
    const byId = videos.find(v => v.id === c.introVideoId) || DATA.videos.find(v => v.id === c.introVideoId);
    if(byId && visible(byId)) return byId;
  }
  return videos.find(v => v.role === "intro")
    || videos.find(v => /intro/i.test(v.title || ""))
    || null;
}

export function renderCreatorPage(){
  const cid = vstate.creatorId;
  const c = DATA.creators.find(x=>x.id===cid);
  if(!c){
    return emptyState("Creator not found.", POPULAR_TAGS.slice(0, 6), { emoji: "👤" });
  }
  const videos = DATA.videos.filter(v=>v.creator===cid && visible(v));
  const subbed = vstate.subs.includes(cid);
  const star = isPornstar(c);
  const intro = star ? resolveIntro(c, videos) : null;
  const shorts = videos.filter(v => v.orientation === "vertical" && v.role !== "intro");
  const longform = videos.filter(v => v.orientation !== "vertical" || v.role === "intro");
  const top5 = [...videos].sort((a,b)=>(b.likes*1.2+b.views*.01)-(a.likes*1.2+a.views*.01)).slice(0,5);
  const initials = esc((c.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase());

  // Banner: explicit profile art → intro poster → best video thumb → gradient
  const bannerSrc = c.banner || intro?.thumb || top5.find(v=>v.thumb)?.thumb;
  const bannerStyle = bannerSrc ? ` style="--creator-banner-img:url('${esc(mediaUrl(bannerSrc))}')"` : '';
  const avatarSrc = c.avatar || null;
  const avatarInner = avatarSrc
    ? `<img class="creator-page-avatar-img" src="${esc(mediaUrl(avatarSrc))}" alt="" loading="eager" decoding="async"/>`
    : initials;

  const starBadge = star ? `<span class="pornstar-badge" title="Pornstar">Pornstar</span>` : "";
  const tagList = Array.isArray(c.tags) && c.tags.length
    ? c.tags
    : [...new Set(videos.flatMap(v => v.tags || []))].slice(0, 8);
  const tagsHtml = tagList.length
    ? `<div class="creator-page-tags">${tagChips(tagList, { max: 10, stop: true })}</div>`
    : "";

  const introCta = intro
    ? `<button type="button" class="btn home-hero-play" onclick="openVideo(${intro.id})">▶ Watch intro</button>`
    : "";
  const shortsCta = shorts.length
    ? `<button type="button" class="btn ghost" onclick="openVideo(${shorts[0].id})">Open Shorts</button>`
    : "";

  return `
    <div class="creator-page${star ? " creator-page-pornstar" : ""}">
      <div class="creator-page-top">
        <div class="creator-page-banner${bannerSrc ? " has-img" : ""}"${bannerStyle}></div>
        <div class="creator-page-avatar${avatarSrc ? " has-img" : ""}">${avatarInner}</div>
      </div>
      <div class="creator-page-header">
        <div class="creator-page-info">
          <h2 class="creator-page-name">${esc(c.name)} ${c.verified ? '<span class="verified" title="Verified">✓</span>' : ""} ${starBadge}</h2>
          <div class="small" style="margin-top:4px">${c.handle ? esc(c.handle) + " · " : ""}${fmt(c.subs)} subscribers · ${videos.length} video${videos.length !== 1 ? "s" : ""}${shorts.length ? ` · ${shorts.length} Shorts` : ""}</div>
          ${c.bio ? `<p class="creator-bio">${esc(c.bio)}</p>` : ""}
          ${tagsHtml}
          ${(introCta || shortsCta) ? `<div class="creator-page-actions">${introCta}${shortsCta}</div>` : ""}
        </div>
        <button class="btn subscribe-btn ${subbed ? "ghost" : ""}" onclick="subscribe('${jsq(cid)}')">${subbed ? "✓ Subscribed" : "＋ Subscribe"}</button>
      </div>
      ${star && shorts.length ? `
        <h3 class="row-heading" style="margin-top:28px">Shorts</h3>
        <div class="row-scroll">${shorts.map(v => videoCard(v, { layout: "row" })).join("")}</div>
      ` : ""}
      ${star && intro ? `
        <h3 class="row-heading" style="margin-top:20px">Intro</h3>
        <div class="row-scroll">${videoCard(intro, { layout: "row" })}</div>
      ` : ""}
      ${!star && top5.length ? `<h3 style="margin-top:28px">Top Videos</h3><div class="row-scroll">${top5.map(v => videoCard(v)).join("")}</div>` : ""}
      <h3 style="margin-top:20px">${star ? "All scenes" : "All Videos"} <span class="count-bubble">${videos.length}</span></h3>
      ${videos.length
        ? pagedGrid(
            star
              ? [
                  ...(intro ? [intro] : []),
                  ...shorts.filter(v => v !== intro),
                  ...longform.filter(v => v !== intro),
                ]
              : videos,
            v => videoCard(v, { layout: "row" }),
            { cls: "video-list" }
          )
        : emptyState(star ? "No scenes published yet for this pornstar." : "This creator has no published videos yet.", POPULAR_TAGS.slice(0, 6), { emoji: "🎬" })}
    </div>`;
}
