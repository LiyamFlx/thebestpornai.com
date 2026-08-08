/* ============================================================
   SHARED TAXONOMY — single source of truth for categories & tags.
   Imported by catalog.js (DATA.categories), the creator upload wizard
   (category/tag pickers + autocomplete), viewer search, filters, and the
   recommendation weighting. Add a term ONCE here and it appears everywhere.

   Grouping is for the tag-picker UI (section headers + autocomplete). The flat
   exports (ALL_TAGS, ALL_CATEGORIES) are what filtering/search consume.
   ============================================================ */

/* ---------- CATEGORIES (homepage rows, sidebar, filter bar) ---------- */
/* "All" is a UI pseudo-category handled by the filter bar, not stored here. */
export const CATEGORIES = [
  "AI Generated", "Lesbian", "MILF", "18+", "Big Ass", "Big Tits", "Anal", "Blowjob",
  "Creampie", "Cumshot", "Gangbang", "Threesome", "Interracial", "Ebony", "Asian",
  "Latina", "Amateur", "Homemade", "POV", "Public", "BDSM", "Fetish", "VR Porn",
  "Hentai / Anime", "Mature", "Foot Fetish", "Massage", "Orgy", "Squirt",
  "Step Fantasy", "Casting", "Romantic", "Hardcore", "Softcore", "PAWG", "Deepthroat",
  "Titjob", "Compilation", "Blonde", "Rough Sex",
];

/* Premium / House Originals sub-categories (badged separately in the UI). */
export const PREMIUM_CATEGORIES = [
  "4K Ultra HD", "8K", "Exclusive Scenes",
  "Series / Movies", "Behind the Scenes",
];

/* ---------- TAGS (grouped for the picker; flattened for search) ---------- */
export const TAG_GROUPS = {
  "Body / Appearance": [
    "Big Ass", "Big Tits", "Big Boobs", "Small Tits", "Natural Tits", "Fake Tits",
    "Huge Ass", "PAWG", "Bubble Butt", "Thick Thighs", "Curvy", "Petite", "Skinny",
    "Tall", "Short", "Blonde", "Brunette", "Redhead", "Ebony", "Asian", "Latina",
    "Indian", "Arab", "MILF", "18+", "Barely Legal (18+)", "Young", "Mature",
    "Granny", "BBW", "Chubby", "Fit", "Athletic", "Tattooed", "Pierced",
  ],
  "Action / Fetish": [
    "Blowjob", "Deepthroat", "Swallow", "Cumshot", "Facial", "Creampie", "Anal",
    "Double Penetration", "Gangbang", "Threesome", "Lesbian", "FFM", "MMF", "BDSM",
    "Bondage", "Spanking", "Footjob", "Handjob", "Titjob", "Rimjob", "Squirting",
    "Orgasm", "Female Orgasm", "Male Orgasm", "Public", "Outdoor", "Car Sex",
    "Kitchen", "Shower", "Massage", "Roleplay", "Cosplay", "Maid", "Teacher",
    "Step Sister", "Step Mom", "Cuckold", "Hotwife",
  ],
  "Niches": [
    "Amateur", "Homemade", "POV", "VR", "4K", "8K", "Slow Motion", "ASMR", "JOI",
    "CEI", "Femdom", "Pegging", "Chastity", "Latex", "Leather", "Hentai", "Anime",
    "Cartoon", "Pregnant", "Lactating", "Fisting", "Gaping", "Double Anal", "BBC",
    "Interracial", "Lesbian Scissoring", "Tribbing", "Strap On",
  ],
  "Trending & Viral": [
    "OnlyFans", "TikTok", "Instagram", "Gone Wild", "Public Agent", "Casting",
    "Audition", "First Time", "Creampie Surprise", "Cum In Mouth", "Cum Swallow",
    "Deep Fake", "AI Generated", "Realistic", "Passionate", "Rough Sex", "Gentle",
    "Romantic", "Hardcore", "Softcore",
  ],
};

/* Flat, de-duplicated tag list (order preserved from the groups above). */
export const ALL_TAGS = (() => {
  const seen = new Set();
  const out = [];
  for (const group of Object.values(TAG_GROUPS)) {
    for (const t of group) {
      if (!seen.has(t)) { seen.add(t); out.push(t); }
    }
  }
  return out;
})();

/* All categories including premium, flat. */
export const ALL_CATEGORIES = [...CATEGORIES, ...PREMIUM_CATEGORIES];

/* Top tags auto-suggested first in the upload picker (high-traffic terms). */
export const POPULAR_TAGS = [
  "Big Ass", "Big Tits", "MILF", "Anal", "Blowjob", "Creampie", "Amateur", "POV",
  "Lesbian", "Threesome", "Cumshot", "Ebony", "Asian", "Latina", "Squirt",
  "Public", "Rough Sex", "Step Mom", "PAWG", "Interracial",
];

/* Case-insensitive membership test used to boost popular tags in the picker. */
const _popularLower = new Set(POPULAR_TAGS.map(t => t.toLowerCase()));
export function isPopularTag(t) {
  return _popularLower.has(String(t || "").toLowerCase());
}
