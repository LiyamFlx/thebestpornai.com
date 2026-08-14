/* Comment list rendering + in-place patching for the watch page. */
import { DATA, esc } from "../shared/catalog.js";
import { vstate, COMMENTS_PER_PAGE } from "./state.js";

/* Merges server-confirmed comments (DATA.comments — the seed catalog) with
   locally-added-but-not-yet-reconciled comments (vstate.live[id].comments —
   the ephemeral overlay, same pattern vote() uses for like/dislike deltas).
   This is the ONLY place that should read comment data for a video; every
   other file (watch.js, feed.js, actions.js) should call this instead of
   filtering DATA.comments directly, so a DATA catalog swap (loadFullCatalog,
   mergeLiveUploads) can never silently drop a comment the user just posted —
   DATA.comments.push() used to be the write path, which meant any reassignment
   of that array (rather than an in-place mutation) would wipe pending comments
   from the UI the next time render() ran.

   Known limitation: since ShAPI.addComment()'s response isn't currently
   captured/reconciled against the local optimistic entry, if a later full
   catalog fetch happens to include this same comment (now server-confirmed
   in DATA.comments) before the overlay is cleared, it could briefly appear
   twice. Fixing that properly needs the real comment ID round-tripped from
   the server — flagging as a follow-up, not fixed here. */
export function commentsFor(v){
  const base = DATA.comments.filter(m=>m.video===v.id);
  const overlay = (vstate.live[v.id] && vstate.live[v.id].comments) || [];
  if (!overlay.length) return base;
  // Hide optimistic rows once hydrate has the same body+author from the DB.
  const seen = new Set(base.map(m => `${m.user || ""}\n${m.text || ""}`));
  const extra = overlay.filter(o => !seen.has(`${o.user || ""}\n${o.text || ""}`));
  return extra.length ? base.concat(extra) : base;
}

/* Sort comments by real timestamp. DB comments carry `ts` parsed from
   created_at; locally-added comments stamp `ts` with Date.now() at creation.
   Legacy seeded comments have no ts at all — they sort as oldest (0).
   Sort order lives in vstate.commentSort — reading the <select> back from
   the DOM mid-render raced against the rebuild and reset the selection. */
export function sortComments(cms){
  const key = m => m.ts || 0;
  const sorted = [...cms].sort((a,b)=> key(b)-key(a));   // newest first
  return vstate.commentSort==="old" ? sorted.reverse() : sorted;
}

/* A comment's displayed like count = its seed count (m.likes, 0 if absent)
   plus a local session delta (vstate.commentLikeCounts), matching the same
   seed+overlay pattern used for video like/dislike counts in actions.js.
   Only whether THIS browser has liked a given comment persists across
   reloads (vstate.likedComments) — the delta itself is session-only, since
   there's no backend table for comment likes to reconcile against yet. */
export function commentLikeCount(m){
  const base = m.likes || 0;
  const delta = vstate.commentLikeCounts[m.id] || 0;
  return base + delta;
}

export function renderCommentList(v){
  const cms = commentsFor(v);
  if(!cms.length) return `<div class="comments-empty"><div class="ce-icon">💬</div><div class="ce-title">No comments yet.</div><div class="small">Be the first to share your thoughts!</div></div>`;
  const sorted = sortComments(cms);
  const shown = sorted.slice(0, vstate.commentPage * COMMENTS_PER_PAGE);
  const hasMore = sorted.length > shown.length;
  return shown.map(m=>{
    const liked = vstate.likedComments.includes(m.id);
    return `<div class="comment">
      <div class="avatar avatar-sm">${esc((m.user||'?')[0])}</div>
      <div style="flex:1;min-width:0">
        <div><b>${esc(m.user)}</b> <span class="small">${esc(m.time)}</span></div>
        <div class="comment-text">${esc(m.text)}</div>
        <div class="comment-actions">
          <button class="comment-like-btn ${liked?'on':''}" onclick="likeComment('${esc(m.id)}')" aria-pressed="${liked?'true':'false'}" aria-label="Like this comment">
            <svg class="ico"><use href="#icon-like"/></svg> <span>${commentLikeCount(m)}</span>
          </button>
          <button class="comment-reply-btn" onclick="toast('Replies coming soon')">Reply</button>
        </div>
      </div>
    </div>`;
  }).join("")
    + (hasMore ? `<button class="btn ghost sm" style="width:100%;margin-top:10px" onclick="loadMoreComments()">Load more comments (${sorted.length - shown.length} remaining)</button>` : '');
}

/* Re-render just the comment region of the watch page (list + count bubble).
   Used by addComment / sort / pagination / hydrate so the <video> element and
   scroll position survive. */
export function patchComments(v){
  const cl = document.getElementById("commentList");
  if(cl) cl.innerHTML = renderCommentList(v);
  const cc = document.getElementById("cCount");
  if(cc) cc.textContent = commentsFor(v).length;
}