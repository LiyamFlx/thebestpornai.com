/* Progressive grid windowing.

   The generic list pages (Explore / Trending / Search / Favorites / …) render
   one `<div class="grid">` of videoCards. With a ~4k-entry catalog that meant
   emitting thousands of card nodes (each with a lazy <video>/<img>) in a single
   innerHTML write — slow to build, slow to lay out, and janky to scroll on
   mobile even with lazy thumbnails.

   pagedGrid() emits only an INITIAL window of cards plus a sentinel; a single
   IntersectionObserver appends the next BATCH as the sentinel nears the
   viewport. The remaining rows live in a module map keyed by a per-grid id, so
   the data survives the string-template render (the app rebuilds #view via
   innerHTML, which can't itself carry JS state).

   The app re-renders on every navigation, so resetGridWindow() is called at the
   top of each render() to drop stale windows before the new page's markup is
   built, and observeSentinels() is called afterwards to wire up whatever
   sentinels that page emitted. */

let _seq = 0;
const _pending = new Map();      // gridId -> { list, cardFn, next, batch }
let _observer = null;
let _onAppend = null;            // (addedNodes[], gridEl) => void — set by render.js

/* render.js registers what to do with freshly appended cards (reveal their lazy
   thumbnails, mark saved/fav state) — kept as a hook to avoid a grid-window ⇄
   render.js import cycle. */
export function setGridAppendHook(fn){ _onAppend = fn; }

/* Build a windowed grid. `cardFn` maps an item to its card HTML (usually
   videoCard). Returns the grid markup plus, when the list exceeds `initial`, a
   sentinel that drives lazy appends. */
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
  }, { rootMargin: "800px 0px" });
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
  }
}

/* Drop every pending window. Called before a new page's HTML is generated so
   maps from the previous page (whose sentinels are about to be wiped by the
   innerHTML swap) don't leak. */
export function resetGridWindow(){
  _pending.clear();
  if(_observer) _observer.disconnect();
}

/* Wire the observer to whatever sentinels the just-rendered page produced. */
export function observeSentinels(){
  ensureObserver();
  if(!_observer) return;
  document.querySelectorAll(".grid-sentinel").forEach(s => _observer.observe(s));
}
