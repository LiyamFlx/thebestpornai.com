/* App chrome interactions via one document-level `data-mobile-action` delegation layer (no inline handlers):
   mobile drawer, tap-to-expand search, watch-page action overflow, and the account menu (desktop sidebar too).
   Breakpoint-specific behaviour is gated on MOBILE; menus and the drawer's a11y wiring apply everywhere. */

const MOBILE = "(max-width:760px)";
let mq = null;
const isMobile = () => (mq ? mq.matches : !!(window.matchMedia && window.matchMedia(MOBILE).matches));

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MENUS = [
  { sel: ".act-overflow", toggle: "toggle-actions-menu" },
  { sel: ".account-menu", toggle: "toggle-account-menu" },
];
const OPEN_MENU_SEL = MENUS.map((m) => m.sel + ".open").join(", ");

function focusEl(el){
  if(!el) return;
  try { el.focus({ preventScroll: true }); } catch(_) { el.focus(); }
}

function focusables(root){
  if(!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

/* ---- Search ---- */
function setSearch(open, { restoreFocus = false } = {}){
  const topbar = document.querySelector(".topbar");
  if(!topbar) return;
  topbar.classList.toggle("mchrome-search-open", open);
  const toggle = topbar.querySelector('[data-mobile-action="toggle-search"]');
  if(toggle) toggle.setAttribute("aria-expanded", String(open));
  const input = document.getElementById("searchInput");
  if(open){
    focusEl(input);
  } else {
    if(input && document.activeElement === input) input.blur();
    if(restoreFocus) focusEl(toggle);
  }
}

function isSearchOpen(){
  return !!document.querySelector(".topbar.mchrome-search-open");
}

/* ---- Menus ---- */
function menuSpec(wrap){
  return MENUS.find((m) => wrap.matches(m.sel));
}

function menuTrigger(wrap){
  const spec = menuSpec(wrap);
  return spec ? wrap.querySelector(`[data-mobile-action="${spec.toggle}"]`) : null;
}

function menuItems(wrap){
  const panel = wrap.querySelector('[role="menu"]') || wrap;
  return focusables(panel).filter((el) => !el.matches('[data-mobile-action^="toggle-"]'));
}

function setMenu(wrap, open, { focusFirst = false, restoreFocus = false } = {}){
  wrap.classList.toggle("open", open);
  const trigger = menuTrigger(wrap);
  if(trigger) trigger.setAttribute("aria-expanded", String(open));
  if(open && focusFirst) focusEl(menuItems(wrap)[0]);
  if(!open && restoreFocus) focusEl(trigger);
}

function openMenus(){
  return [...document.querySelectorAll(OPEN_MENU_SEL)];
}

function closeOpenMenus(except = null, opts = {}){
  for(const wrap of openMenus()) if(wrap !== except) setMenu(wrap, false, opts);
}

/* ---- Drawer ---- */
function isDrawerOpen(){
  const drawer = document.getElementById("mobileDrawer");
  return !!(drawer && drawer.classList.contains("open"));
}

function setDrawer(open, { restoreFocus = false } = {}){
  const drawer = document.getElementById("mobileDrawer");
  const backdrop = document.getElementById("drawerBackdrop");
  const toggle = document.querySelector('[data-mobile-action="toggle-drawer"]');
  if(drawer){
    if(!open && drawer.contains(document.activeElement)) document.activeElement.blur();
    drawer.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    // inert keeps the off-canvas drawer out of the Tab order / AT tree while closed.
    drawer.toggleAttribute("inert", !open);
  }
  if(backdrop) backdrop.classList.toggle("show", open);
  document.body.classList.toggle("drawer-open", open);
  if(toggle) toggle.setAttribute("aria-expanded", String(open));
  if(open){
    closeOpenMenus();
    if(isSearchOpen()) setSearch(false);
    focusEl((drawer && drawer.querySelector('[data-mobile-action="close-drawer"]')) || focusables(drawer)[0]);
  } else if(restoreFocus){
    focusEl(toggle);
  }
}

/* ---- Chip-row trailing fade ---- */
function updateRowFade(row){
  const max = row.scrollWidth - row.clientWidth;
  row.classList.toggle("at-end", max <= 2 || row.scrollLeft >= max - 2);
}

// Capturing listener sees non-bubbling scroll from every row across re-renders; rAF-batched layout reads.
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

/* Synchronous so the fade is correct right after render(). */
export function refreshChipRows(){
  document.querySelectorAll(".mchrome-scroll").forEach(updateRowFade);
}

let resizeRaf = null;
function onResize(){
  if(resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    refreshChipRows();
  });
}

function onMediaChange(){
  if(!isMobile()){
    if(isSearchOpen()) setSearch(false);
    if(isDrawerOpen()) setDrawer(false);
    document.querySelectorAll(".act-overflow.open").forEach((w) => setMenu(w, false));
  }
  refreshChipRows();
}

/* ---- Delegated events ---- */
function onClick(e){
  const trigger = e.target.closest("[data-mobile-action]");
  const action = trigger ? trigger.dataset.mobileAction : null;
  const spec = MENUS.find((m) => m.toggle === action);
  const toggledWrap = spec ? trigger.closest(spec.sel) : null;

  // Outside clicks and item choices close menus; a click on a menu's own non-interactive padding keeps it open.
  const insideOpen = e.target.closest(OPEN_MENU_SEL);
  const onInteractive = !!e.target.closest('button, a, input, select, textarea, [role="menuitem"]');
  closeOpenMenus(toggledWrap || (insideOpen && !onInteractive ? insideOpen : null));

  if(toggledWrap){
    e.preventDefault();
    const open = !toggledWrap.classList.contains("open");
    // detail === 0 ⇒ keyboard-activated click: move focus into the menu.
    setMenu(toggledWrap, open, { focusFirst: open && e.detail === 0 });
    return;
  }

  switch(action){
    case "toggle-drawer":
      setDrawer(!isDrawerOpen());
      return;
    case "close-drawer":
      setDrawer(false, { restoreFocus: true });
      return;
    case "toggle-search":
      setSearch(!isSearchOpen());
      return;
  }

  if(isDrawerOpen() && e.target.closest("#mobileDrawer a, #mobileDrawer button")) setDrawer(false);
}

function onKeydown(e){
  if(e.key === "Escape"){
    if(isDrawerOpen()){ setDrawer(false, { restoreFocus: true }); return; }
    const menus = openMenus();
    if(menus.length){
      const active = document.activeElement;
      menus.forEach((w) => setMenu(w, false, { restoreFocus: w.contains(active) }));
      return;
    }
    if(isSearchOpen() && isMobile()) setSearch(false, { restoreFocus: true });
    return;
  }

  if(e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End"){
    const active = document.activeElement;
    const wrap = active && active.closest ? active.closest(OPEN_MENU_SEL) : null;
    if(!wrap) return;
    const items = menuItems(wrap);
    if(!items.length) return;
    e.preventDefault();
    const n = items.length;
    const i = items.indexOf(active);
    const next =
      e.key === "Home" ? 0 :
      e.key === "End" ? n - 1 :
      e.key === "ArrowDown" ? (i + 1) % n :
      (i <= 0 ? n : i) - 1;
    focusEl(items[next]);
    return;
  }

  if(e.key === "Tab" && isDrawerOpen()){
    const drawer = document.getElementById("mobileDrawer");
    const items = focusables(drawer);
    if(!items.length) return;
    const first = items[0], last = items[items.length - 1], active = document.activeElement;
    if(!drawer.contains(active)){
      e.preventDefault();
      focusEl(e.shiftKey ? last : first);
    } else if(e.shiftKey && active === first){
      e.preventDefault();
      focusEl(last);
    } else if(!e.shiftKey && active === last){
      e.preventDefault();
      focusEl(first);
    }
  }
}

// Tabbing out of an open menu closes it.
function onFocusIn(e){
  for(const wrap of openMenus()) if(!wrap.contains(e.target)) setMenu(wrap, false);
}

export function initMobileChrome(){
  if(window.__mobileChromeBound) return;
  window.__mobileChromeBound = true;

  document.addEventListener("scroll", onScrollCapture, { capture: true, passive: true });
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("focusin", onFocusIn);

  if(window.matchMedia){
    mq = window.matchMedia(MOBILE);
    if(mq.addEventListener) mq.addEventListener("change", onMediaChange);
    else if(mq.addListener) mq.addListener(onMediaChange);
  }
  window.addEventListener("resize", onResize, { passive: true });
  // Webfont swap changes chip widths after first layout.
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(refreshChipRows, () => {});

  const drawer = document.getElementById("mobileDrawer");
  if(drawer && !drawer.classList.contains("open")) drawer.toggleAttribute("inert", true);
  if(!isMobile() && isSearchOpen()) setSearch(false);
}