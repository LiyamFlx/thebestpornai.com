/** 
 * Paid outbound affiliate offers and partner referral routing.
 * Configured with live referral tracking links (OurDream, Candy.ai, etc.).
 */

const OURDREAM_CPA = "https://ourdreamai.everflowclient.io/affiliate/signup/?p=HWH86HD1";

export const OURDREAM = {
  home: OURDREAM_CPA,
  create: OURDREAM_CPA,
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
  return `${base}&sub1=${encodeURIComponent(s)}`;
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
  if (catLower === "solo" || tagsLower.some(t => t === "solo")) {
    return { name: "Candy AI (Solo)", url: candyAiUrl("solo", src), network: "candy" };
  }
  if (catLower.includes("hentai") || catLower.includes("anime") || tagsLower.some(t => t.includes("hentai") || t.includes("chat"))) {
    return { name: "Candy AI", url: candyAiUrl("create", src), network: "candy" };
  }

  return { name: "OurDream", url: ourdreamUrl("home", src), network: "ourdream" };
}

export const AFFILIATE_REL = "noopener sponsored nofollow";
export const OURDREAM_REL = AFFILIATE_REL;

/** Two disclosed partner offers. OurDream for one character across chat and video; Candy for a faster companion. */
export function affiliateChoiceHtml(src = "site") {
  const od = ourdreamUrl("home", src + "-ourdream");
  const candy = candyAiUrl("home", src + "-candy");
  return `<section class="partner-choice" aria-label="Sponsored AI tools">
    <div class="partner-choice-copy">
      <p class="partner-choice-kicker">Sponsored</p>
      <h2 class="partner-choice-title">Watch here. Build a character there.</h2>
      <p class="partner-choice-note">thebestpornai is the library. These partners generate a companion. We may earn a commission if you sign up.</p>
    </div>
    <div class="partner-choice-actions">
      <a class="partner-choice-btn" href="${od}" target="_blank" rel="${AFFILIATE_REL}">OurDream — one character across chat and video</a>
      <a class="partner-choice-btn partner-choice-btn-alt" href="${candy}" target="_blank" rel="${AFFILIATE_REL}">Candy AI — faster companion chat</a>
    </div>
  </section>`;
}
