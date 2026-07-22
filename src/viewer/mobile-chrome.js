/* Mobile chrome interactions — header collapse-on-scroll, tap-to-expand search,
   the collapsed sort control, and the watch-page action overflow menu.

   Every behavior here is gated to the mobile breakpoint (max-width:760px) so
   desktop is never touched. The new controls introduced by this pass are wired
   through a single document-level `data-mobile-action` delegation layer (no
   inline onclick). The rest of the app predates that and still uses the
   window-bridge + inline handlers established elsewhere; we leave those as-is. */

const MOBILE = "(max-width:760px)";
const isMobile = () => !!(window.matchMedia && window.matchMedia(MOBILE).matches);

/* ---- Fix 1: header collapse on scroll ----
   Shrinks the topbar to brand + avatar (+ search icon) once scrolled past a
   threshold, and restores the full header near the very top. A small
   hysteresis gap between collapse/expand thresholds avoids flicker when the
   user hovers around the boundary. The topbar is position:sticky, so resizing
   it while stuck never reflows content above the fold — no layout shift. */
const COLLAPSE_AT = 56;
const EXPAND_AT = 10;
let _collapsed = false;

function scrollY(){
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function applyHeaderState(){
  const topbar = document.querySelector(".topbar");
  if(!topbar) return;
  if(!isMobile()){
    topbar.classList.remove("mchrome-collapsed", "mchrome-search-open");
    _collapsed = false;
    return;
  }
  const y = scrollY();
  if(!_collapsed && y > COLLAPSE_AT) _collapsed = true;
  else if(_collapsed && y < EXPAND_AT) _collapsed = false;
  topbar.classList.toggle("mchrome-collapsed", _collapsed);
  // The full (expanded) header always shows the real search bar, so drop any
  // lingering tap-to-expand state when we return to the top.
  if(!_collapsed){
    topbar.classList.remove("mchrome-search-open");
    const t = topbar.querySelector('[data-mobile-action="toggle-search"]');
    if(t) t.setAttribute("aria-expanded", "false");
  }
}

let _ticking = false;
function onScroll(){
  if(_ticking) return;
  _ticking = true;
  requestAnimationFrame(() => { applyHeaderState(); _ticking = false; });
}

/* ---- Fix 2: trailing-edge fade for horizontal chip rows ----
   scroll events don't bubble, but a capturing listener on the document still
   receives them, so this one listener covers every chip row across re-renders
   without needing to re-bind after each render(). */
function updateRowFade(row){
  const max = row.scrollWidth - row.clientWidth;
  row.classList.toggle("at-end", max <= 2 || row.scrollLeft >= max - 2);
}
function onScrollCapture(e){
  const row = e.target;
  if(row && row.classList && row.classList.contains("mchrome-scroll")) updateRowFade(row);
}

/* Recompute the fade state for every chip row (called after each render and on
   resize, since scrollWidth/clientWidth are only known once laid out). */
export function refreshChipRows(){
  document.querySelectorAll(".mchrome-scroll").forEach(updateRowFade);
}

/* ---- Delegated clicks for the new mobile controls ---- */
function closeOpenMenus(except){
  document.querySelectorAll(".act-overflow.open").forEach(o => {
    if(!except || !o.contains(except)){
      o.classList.remove("open");
      const t = o.querySelector('[data-mobile-action="toggle-actions-menu"]');
      if(t) t.setAttribute("aria-expanded", "false");
    }
  });
}

function onClick(e){
  const trigger = e.target.closest("[data-mobile-action]");
  // Any click that isn't the overflow trigger itself closes an open menu.
  if(!trigger || trigger.dataset.mobileAction !== "toggle-actions-menu"){
    closeOpenMenus(trigger);
  }
  if(!trigger) return;

  const action = trigger.dataset.mobileAction;
  if(action === "toggle-search"){
    const topbar = trigger.closest(".topbar");
    if(!topbar) return;
    const open = topbar.classList.toggle("mchrome-search-open");
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    const input = document.getElementById("searchInput");
    if(input){ if(open) input.focus(); else input.blur(); }
  } else if(action === "toggle-actions-menu"){
    e.preventDefault();
    const wrap = trigger.closest(".act-overflow");
    if(!wrap) return;
    const open = wrap.classList.toggle("open");
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  } else if(action === "toggle-desc"){
    // Watch page description: clamped to 2 lines by default on mobile
    // (.watch-desc-wrap CSS), this just lifts the clamp and swaps the label.
    const wrap = trigger.closest(".watch-desc-wrap");
    if(!wrap) return;
    const open = wrap.classList.toggle("expanded");
    trigger.textContent = open ? "…less" : "…more";
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  } else if(action === "toggle-comments"){
    // Comments preview crop on mobile: same idea, lifts a max-height clamp on
    // #commentList without touching the id itself or its content.
    const wrap = trigger.closest(".comment-list-wrap");
    if(!wrap) return;
    const open = wrap.classList.toggle("expanded");
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }
}

/* ---- Delegated change for the collapsed sort <select> (Fix 3) ----
   change bubbles for <select>, so one document listener is enough. Routes to
   the same setHomeSort the desktop button row already uses. */
function onChange(e){
  const sel = e.target.closest && e.target.closest('[data-mobile-action="home-sort"]');
  if(!sel) return;
  if(typeof window.setHomeSort === "function") window.setHomeSort(sel.value);
}

export function initMobileChrome(){
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("scroll", onScrollCapture, true);   // capture: catches chip-row scroll
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);

  if(window.matchMedia){
    const mq = window.matchMedia(MOBILE);
    const onMq = () => { applyHeaderState(); refreshChipRows(); };
    if(mq.addEventListener) mq.addEventListener("change", onMq);
    else if(mq.addListener) mq.addListener(onMq);   // Safari < 14
  }
  window.addEventListener("resize", refreshChipRows, { passive: true });

  applyHeaderState();
}
