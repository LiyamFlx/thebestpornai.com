/* Mobile chrome interactions — tap-to-expand search, and the watch-page
   action overflow menu.

   Every behavior here is gated to the mobile breakpoint (max-width:760px) so
   desktop is never touched. The new controls introduced by this pass are wired
   through a single document-level `data-mobile-action` delegation layer (no
   inline onclick). The rest of the app predates that and still uses the
   window-bridge + inline handlers established elsewhere; we leave those as-is. */

const MOBILE = "(max-width:760px)";
const isMobile = () => !!(window.matchMedia && window.matchMedia(MOBILE).matches);

/* The header is icon-only-search at all scroll positions on mobile now (see
   .search-input{display:none} in style.css), so there's no longer a
   collapse/expand state to track on scroll — only the desktop->mobile
   breakpoint transition needs to reset a lingering open search field. */
function applyHeaderState(){
  const topbar = document.querySelector(".topbar");
  if(!topbar) return;
  if(!isMobile()){
    topbar.classList.remove("mchrome-search-open");
  }
}

/* ---- Fix 2: trailing-edge fade for horizontal chip rows ----
   scroll events don't bubble, but a capturing listener on the document still
   receives them, so this one listener covers every chip row across re-renders
   without needing to re-bind after each render(). */
function updateRowFade(row){
  const max = row.scrollWidth - row.clientWidth;
  row.classList.toggle("at-end", max <= 2 || row.scrollLeft >= max - 2);
}

// rAF-batched so a fling-scroll doesn't force a layout read on every event.
let scrollRaf = null;
const pendingRows = new Set();
function onScrollCapture(e){
  const row = e.target;
  if(!(row && row.classList && row.classList.contains("mchrome-scroll"))) return;
  pendingRows.add(row);
  if(scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null;
    pendingRows.forEach(updateRowFade);
    pendingRows.clear();
  });
}

/* Recompute the fade state for every chip row (called after each render and on
   resize, since scrollWidth/clientWidth are only known once laid out). */
export function refreshChipRows(){
  document.querySelectorAll(".mchrome-scroll").forEach(updateRowFade);
}

// rAF-debounced resize path only — direct refreshChipRows() calls (e.g. after
// render()) stay synchronous so the fade state is correct immediately.
let resizeRaf = null;
function onResize(){
  if(resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    refreshChipRows();
  });
}

function onMediaChange(){
  applyHeaderState();
  refreshChipRows();
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
  document.querySelectorAll(".account-menu.open").forEach(o => {
    if(!except || !o.contains(except)){
      o.classList.remove("open");
      const t = o.querySelector('[data-mobile-action="toggle-account-menu"]');
      if(t) t.setAttribute("aria-expanded", "false");
    }
  });
}

function closeDrawer(){
  const drawer = document.getElementById("mobileDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  if(drawer){
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  }
  if(backdrop) backdrop.classList.remove("show");
  document.body.classList.remove("drawer-open");
  const toggleBtn = document.querySelector('[data-mobile-action="toggle-drawer"]');
  if(toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
}

function onClick(e){
  const trigger = e.target.closest("[data-mobile-action]");
  // Any click that isn't a menu's own trigger closes open menus.
  if(!trigger || (trigger.dataset.mobileAction !== "toggle-actions-menu" && trigger.dataset.mobileAction !== "toggle-account-menu")){
    closeOpenMenus(trigger);
  }
  if(!trigger) return;

  const action = trigger.dataset.mobileAction;
  if(action === "toggle-drawer"){
    const drawer = document.getElementById("mobileDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    const open = drawer ? drawer.classList.toggle("open") : false;
    if(backdrop) backdrop.classList.toggle("show", open);
    document.body.classList.toggle("drawer-open", open);
    if(drawer) drawer.setAttribute("aria-hidden", open ? "false" : "true");
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if(open){
      const closeBtn = drawer ? drawer.querySelector('[data-mobile-action="close-drawer"]') : null;
      if(closeBtn) closeBtn.focus();
    }
  } else if(action === "close-drawer"){
    closeDrawer();
    const toggleBtn = document.querySelector('[data-mobile-action="toggle-drawer"]');
    if(toggleBtn) toggleBtn.focus();
  } else if(action === "toggle-search"){
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
  } else if(action === "toggle-account-menu"){
    e.preventDefault();
    const wrap = trigger.closest(".account-menu");
    if(!wrap) return;
    const open = wrap.classList.toggle("open");
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }
  
  // Close drawer if clicking any navigation link inside mobile-drawer
  if(e.target.closest("#mobileDrawer button, #mobileDrawer a")){
    closeDrawer();
  }
}

function onKeydown(e){
  if(e.key === "Escape"){
    const drawer = document.getElementById("mobileDrawer");
    if(drawer && drawer.classList.contains("open")){
      closeDrawer();
      const toggleBtn = document.querySelector('[data-mobile-action="toggle-drawer"]');
      if(toggleBtn) toggleBtn.focus();
      return;
    }
    closeOpenMenus();
    return;
  }

  // Focus trap for open drawer
  if(e.key === "Tab"){
    const drawer = document.getElementById("mobileDrawer");
    if(drawer && drawer.classList.contains("open")){
      const focusables = drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if(focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if(e.shiftKey && document.activeElement === first){
        e.preventDefault();
        last.focus();
      } else if(!e.shiftKey && document.activeElement === last){
        e.preventDefault();
        first.focus();
      }
    }
  }
}

export function initMobileChrome(){
  document.addEventListener("scroll", onScrollCapture, { capture: true, passive: true });
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);

  if(window.matchMedia){
    const mq = window.matchMedia(MOBILE);
    if(mq.addEventListener) mq.addEventListener("change", onMediaChange);
    else if(mq.addListener) mq.addListener(onMediaChange);   // Safari < 14
  }
  window.addEventListener("resize", onResize, { passive: true });

  applyHeaderState();
}