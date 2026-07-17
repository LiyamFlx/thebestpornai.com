/* Comment list rendering + in-place patching for the watch page. */
import { DATA, esc } from "../shared/catalog.js";
import { vstate, COMMENTS_PER_PAGE } from "./state.js";

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

export function renderCommentList(v){
  const cms = DATA.comments.filter(m=>m.video===v.id);
  if(!cms.length) return `<div class="comments-empty"><div class="ce-icon">💬</div><div class="ce-title">No comments yet.</div><div class="small">Be the first to share your thoughts!</div></div>`;
  const sorted = sortComments(cms);
  const shown = sorted.slice(0, vstate.commentPage * COMMENTS_PER_PAGE);
  const hasMore = sorted.length > shown.length;
  return shown.map(m=>`<div class="comment"><div class="avatar avatar-sm">${esc((m.user||'?')[0])}</div><div style="flex:1;min-width:0"><div><b>${esc(m.user)}</b> <span class="small">${esc(m.time)}</span></div><div class="comment-text">${esc(m.text)}</div></div></div>`).join("")
    + (hasMore ? `<button class="btn ghost sm" style="width:100%;margin-top:10px" onclick="loadMoreComments()">Load more comments (${sorted.length - shown.length} remaining)</button>` : '');
}

/* Re-render just the comment region of the watch page (list + count bubble).
   Used by addComment / sort / pagination / hydrate so the <video> element and
   scroll position survive. */
export function patchComments(v){
  const cl = document.getElementById("commentList");
  if(cl) cl.innerHTML = renderCommentList(v);
  const cc = document.getElementById("cCount");
  if(cc) cc.textContent = DATA.comments.filter(m=>m.video===v.id).length;
}
