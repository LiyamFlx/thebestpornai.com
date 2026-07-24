/* Progressive grid windowing — avoids emitting thousands of card nodes in one
   innerHTML write on large list pages (Explore/Trending/Search/Favorites).

   pagedGrid() emits an initial window plus a sentinel; an IntersectionObserver
   appends the next batch as the sentinel nears the viewport. Remaining rows
   live in a module map keyed by grid id, since innerHTML re-renders can't
   carry JS state. resetGridWindow() runs at the top of each render() to drop
   stale windows; observeSentinels() runs after to wire up new ones. */

let _seq = 0;
const _pending = new Map();      // gridId -> { list, cardFn, next, batch }
let _observer = null;
let _onAppend = null;            // (addedNodes[], gridEl) => void — set by render.js
const LOAD_MARGIN = 800;         // px lookahead before a sentinel triggers a load

// render.js registers post-append work (lazy thumbnails, saved/fav state) — a
// hook here avoids a grid-window <-> render.js import cycle.
export function setGridAppendHook(fn){ _onAppend = fn; }

// Maps items to card HTML via cardFn (usually videoCard). Returns grid markup
// plus a sentinel when the list exceeds `initial`.
export function pagedGrid(list, cardFn, opts = {}){
  const initial = opts.initial ?? 60;
  const batch = opts.batch ?? 40;
  const cls = opts.cls ?? "grid";
  const first = list.slice(0, initial);
  const grid = `<div class="${cls}">${first.map(cardFn).join("")}</div>`;
  if(list.length <= initial) return grid;
  const id = "gw" + (++_seq);
  _pending.set(id, { list, cardFn, next: first.length, batch });
  return grid + `<div class="grid-sentinel" data-grid-id="${id}" aria-hidden="true"></div>`;
}

function ensureObserver(){
  if(_observer || typeof IntersectionObserver === "undefined") return;
  _observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) fill(e.target); });
  }, { rootMargin: `${LOAD_MARGIN}px 0px` });
}

function fill(sentinel){
  const id = sentinel.dataset.gridId;
  const st = _pending.get(id);
  const grid = sentinel.previousElementSibling;
  if(!st || !grid){ _observer.unobserve(sentinel); sentinel.remove(); return; }

  const slice = st.list.slice(st.next, st.next + st.batch);
  st.next += slice.length;
  if(slice.length){
    grid.insertAdjacentHTML("beforeend", slice.map(st.cardFn).join(""));
    const added = Array.prototype.slice.call(grid.children, grid.children.length - slice.length);
    if(_onAppend) _onAppend(added, grid);
  }
  if(st.next >= st.list.length){
    _pending.delete(id);
    _observer.unobserve(sentinel);
    sentinel.remove();
    return;
  }
  // IO only refires on isIntersecting transitions — if this batch didn't push
  // the sentinel past LOAD_MARGIN, no further callback comes. slice.length
  // guard prevents infinite recursion on zero-progress (batch<=0).
  if(slice.length && sentinel.getBoundingClientRect().top < window.innerHeight + LOAD_MARGIN){
    fill(sentinel);
  }
}

// Drops every pending window — called before a new page's HTML is built so
// the previous page's maps (about to be wiped by the innerHTML swap) don't leak.
export function resetGridWindow(){
  _pending.clear();
  if(_observer) _observer.disconnect();
}

// Wires the observer to whatever sentinels the just-rendered page produced.
export function observeSentinels(){
  ensureObserver();
  if(!_observer) return;
  document.querySelectorAll(".grid-sentinel").forEach(s => _observer.observe(s));
}