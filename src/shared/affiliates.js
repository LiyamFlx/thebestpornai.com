/** 
 * Paid outbound affiliate offers and partner referral routing.
 * Configured for multi-network tracking (OurDream, Candy.ai, etc.).
 */

const OURDREAM_CPA = "https://www.ourdreamersai13.com/9B73ZMB/2CTPL/";

// Candy AI base partner link (placeholder ready for your specific referral ID)
const CANDY_AI_CPA = "https://candy.ai/";

export const OURDREAM = {
  home: `${OURDREAM_CPA}?uid=3`,
  create: `${OURDREAM_CPA}?uid=172`,
};

export const CANDY_AI = {
  home: `${CANDY_AI_CPA}?via=thebestpornai`,
  chat: `${CANDY_AI_CPA}?via=thebestpornai&mode=chat`,
  create: `${CANDY_AI_CPA}?via=thebestpornai&mode=create`,
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
 * Candy AI affiliate URL builder with optional sub-id tracking.
 * @param {"home"|"chat"|"create"} kind 
 * @param {string} src 
 */
export function candyAiUrl(kind = "home", src = "") {
  const base = CANDY_AI[kind] || CANDY_AI.home;
  const s = String(src || "").trim();
  if (!s) return base;
  return `${base}&utm_source=${encodeURIComponent(s)}`;
}

/**
 * Dynamic context-aware affiliate offer selector.
 * Routes relevant niches (e.g. Hentai, Anime, AI Chat) to Candy.ai,
 * and general video/generators to OurDream.
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

  // Niche matching rule: Hentai, Anime, AI Companion, and Chat map to Candy AI
  const isCandyNiche = catLower.includes("hentai") || 
                       catLower.includes("anime") || 
                       tagsLower.some(t => t.includes("hentai") || t.includes("chat") || t.includes("companion"));

  if (isCandyNiche) {
    return { name: "Candy AI", url: candyAiUrl("home", src), network: "candy" };
  }

  return { name: "OurDream", url: ourdreamUrl("home", src), network: "ourdream" };
}

export const AFFILIATE_REL = "noopener sponsored nofollow";
export const OURDREAM_REL = AFFILIATE_REL;
