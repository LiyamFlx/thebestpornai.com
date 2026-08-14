/* Pure like/dislike toggle. Used by the viewer and unit-tested so the
   increment/decrement math cannot drift from the unique (video, client, kind)
   constraint on public.likes.

   `live` is the vstate.live[id] overlay:
     like/dislike — counts layered on the seed catalog (hydrate writes the
                    server totals here; a pre-hydrate click starts at 0)
     myVote       — this browser's current reaction, or null
*/
export function applyVote(live, kind) {
  if (kind !== "like" && kind !== "dislike") {
    throw new Error("kind must be like or dislike");
  }
  const next = {
    like: Math.max(0, Number(live && live.like) || 0),
    dislike: Math.max(0, Number(live && live.dislike) || 0),
    myVote: live && (live.myVote === "like" || live.myVote === "dislike") ? live.myVote : null,
  };
  const prev = next.myVote;
  if (prev === kind) {
    next[kind] = Math.max(0, next[kind] - 1);
    next.myVote = null;
    return { live: next, action: "remove", from: kind, to: null };
  }
  if (prev) {
    next[prev] = Math.max(0, next[prev] - 1);
    next[kind] = next[kind] + 1;
    next.myVote = kind;
    return { live: next, action: "switch", from: prev, to: kind };
  }
  next[kind] = next[kind] + 1;
  next.myVote = kind;
  return { live: next, action: "add", from: null, to: kind };
}

const VOTES_KEY = "sh_my_votes";

export function readStoredVotes() {
  try {
    const raw = JSON.parse(localStorage.getItem(VOTES_KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch (_) {
    return {};
  }
}

export function storedVoteFor(videoId) {
  const v = readStoredVotes()[String(videoId)];
  return v === "like" || v === "dislike" ? v : null;
}

export function writeStoredVote(videoId, kindOrNull) {
  const map = readStoredVotes();
  const key = String(videoId);
  if (kindOrNull === "like" || kindOrNull === "dislike") map[key] = kindOrNull;
  else delete map[key];
  try { localStorage.setItem(VOTES_KEY, JSON.stringify(map)); } catch (_) {}
}
