/** 
 * Paid outbound affiliate offers and partner referral routing.
 * Configured with live referral tracking links (OurDream, Candy.ai, etc.).
 */

const OURDREAM_CPA = "https://www.ourdreamersai13.com/9B73ZMB/2CTPL/";

export const OURDREAM = {
  home: `${OURDREAM_CPA}?uid=3`,
  create: `${OURDREAM_CPA}?uid=172`,
};

export const CANDY_AI = {
  home: "https://candyai.gg/home2?via=jeycxz",
  create: "https://candyai.gg/characters/new?via=jeycxz",
  var17: "https://landing.candynetwork.ai/lp1?var_text=17&via=jeycxz",
  goth1: "https://landing.candynetwork.ai/lp1?var_text=31&via=jeycxz",
  goth2: "https://landing.candynetwork.ai/lp1?var_text=38&via=jeycxz",
  solo: "https://landing.candynetwork.ai/lp1?var_text=25&via=jeycxz",
  gamingPov: "https://landing.candynetwork.ai/lp1?var_text=44&via=jeycxz",
};

/**
 * OurDream affiliate URL builder with optional tracking source.
 * @param {"home"|"create"} kind 
 * @param {string} src 
 */
export function ourdreamUrl(kind = "home", src = "") {
  const base = OURDREAM[kind] || OURDREAM.home;
  const s = String(src || "").trim();
  if (!s) return base;
  return `${base}&s1=${encodeURIComponent(s)}`;
}

/**
 * Candy AI affiliate URL builder with specialized landing page variant matching.
 * @param {"home"|"create"|"var17"|"goth1"|"goth2"|"solo"|"gamingPov"} kind 
 * @param {string} src 
 */
export function candyAiUrl(kind = "home", src = "") {
  const base = CANDY_AI[kind] || CANDY_AI.home;
  const s = String(src || "").trim();
  if (!s) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}utm_source=${encodeURIComponent(s)}`;
}

/**
 * Dynamic context-aware affiliate offer selector.
 * Routes relevant niches (e.g. Hentai, Anime, POV, Solo) to specialized Candy AI landing pages,
 * and general video/generators to OurDream or Candy AI.
 * 
 * @param {{ category?: string, tags?: string[], src?: string, preferredNetwork?: string }} opts
 */
export function getAffiliateOffer(opts = {}) {
  const { category = "", tags = [], src = "", preferredNetwork } = opts;
  const catLower = String(category).toLowerCase();
  const tagsLower = Array.isArray(tags) ? tags.map(t => String(t).toLowerCase()) : [];

  if (preferredNetwork === "candy") {
    return { name: "Candy AI", url: candyAiUrl("home", src), network: "candy" };
  }
  if (preferredNetwork === "ourdream") {
    return { name: "OurDream", url: ourdreamUrl("home", src), network: "ourdream" };
  }

  // Niche matching rules to targeted landing pages
  if (catLower.includes("pov") || tagsLower.some(t => t.includes("pov"))) {
    return { name: "Candy AI (Gaming POV)", url: candyAiUrl("gamingPov", src), network: "candy" };
  }
  if (catLower.includes("goth") || tagsLower.some(t => t.includes("goth") || t.includes("alt"))) {
    return { name: "Candy AI (Goth)", url: candyAiUrl("goth1", src), network: "candy" };
  }
  if (catLower.includes("solo") || tagsLower.some(t => t.includes("solo") || t.includes("babe"))) {
    return { name: "Candy AI (Solo)", url: candyAiUrl("solo", src), network: "candy" };
  }
  if (catLower.includes("hentai") || catLower.includes("anime") || tagsLower.some(t => t.includes("hentai") || t.includes("chat"))) {
    return { name: "Candy AI", url: candyAiUrl("create", src), network: "candy" };
  }

  return { name: "OurDream", url: ourdreamUrl("home", src), network: "ourdream" };
}

export const AFFILIATE_REL = "noopener sponsored nofollow";
export const OURDREAM_REL = AFFILIATE_REL;
