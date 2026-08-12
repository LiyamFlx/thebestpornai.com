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
  "AI Generated", "POV", "Amateur", "Homemade", "Big Ass", "Big Tits", "MILF", "Mature",
  "18+", "Anal", "Blowjob", "Deepthroat", "Creampie", "Cumshot", "Facial", "Gangbang",
  "Threesome", "Interracial", "BBC", "Ebony", "Asian", "Latina", "Blonde", "Brunette",
  "Redhead", "Babe", "Lesbian", "Squirt", "Massage", "BDSM", "Fetish", "Foot Fetish",
  "Cosplay", "Hentai / Anime", "VR Porn", "Public", "Outdoor", "Rough Sex", "Romantic",
  "Step Fantasy", "Casting", "Hardcore", "Softcore", "PAWG", "Titjob", "Compilation",
  "Stockings / Lingerie", "Female Orgasm", "Curvy", "Petite", "BBW", "House Originals",
];

/* Premium / House Originals sub-categories (badged separately in the UI). */
export const PREMIUM_CATEGORIES = [
  "4K Ultra HD", "8K", "Exclusive Scenes",
  "Series / Movies", "Behind the Scenes",
];

/* ---------- TAGS (grouped for the picker; flattened for search) ---------- */
export const TAG_GROUPS = {
  "Body / Appearance": [
    "Big Ass", "Big Tits", "Big Boobs", "Huge Tits", "Small Tits", "Natural Tits", "Fake Tits",
    "Huge Ass", "PAWG", "Bubble Butt", "Thick Thighs", "Curvy", "Petite", "Skinny", "Slim",
    "Tall", "Short", "Blonde", "Brunette", "Redhead", "Ebony", "Asian", "Latina",
    "Indian", "Arab", "Japanese", "Korean", "MILF", "18+", "Barely Legal (18+)", "Young", "Mature",
    "Granny", "BBW", "Chubby", "Fit", "Athletic", "Tattooed", "Pierced", "Goth", "E-Girl",
  ],
  "Action / Sex": [
    "Blowjob", "Deepthroat", "Sloppy Blowjob", "Swallow", "Gagging", "Face Fuck", "Cumshot",
    "Facial", "Creampie", "Anal", "Double Penetration", "Double Anal", "Gangbang", "Threesome",
    "Lesbian", "FFM", "MMF", "Scissoring", "Tribbing", "Strap On", "BDSM", "Bondage",
    "Spanking", "Domination", "Submission", "Footjob", "Handjob", "Titjob", "Rimjob", "Squirting",
    "Orgasm", "Female Orgasm", "Male Orgasm", "Multi-Orgasm", "Public", "Outdoor", "Car Sex",
    "Kitchen", "Shower", "Pool", "Massage", "Roleplay", "Cosplay", "Maid", "Teacher", "Nurse",
    "Step Sister", "Step Mom", "Cuckold", "Hotwife", "Raw / Bareback",
  ],
  "Niches & Styles": [
    "Amateur", "Homemade", "POV", "VR", "4K", "8K", "60FPS", "Slow Motion", "ASMR", "JOI",
    "CEI", "Femdom", "Pegging", "Chastity", "Latex", "Leather", "Stockings", "Lingerie",
    "High Heels", "Fishnets", "Panties", "Hentai", "Anime", "3D Render", "Cartoon",
    "Pregnant", "Lactating", "Fisting", "Gaping", "BBC", "Interracial", "Taboo", "Fantasy",
  ],
  "Trending & AI": [
    "AI Generated", "Photorealistic", "Ultra Realistic", "Deepfake", "Synthetic Lust",
    "Virtual Model", "Digital Star", "OnlyFans", "Fansly", "TikTok", "Instagram", "Gone Wild",
    "Public Agent", "Casting", "Audition", "First Time", "Creampie Surprise", "Cum In Mouth",
    "Cum Swallow", "Passionate", "Sensual", "Rough Sex", "Gentle", "Romantic", "Hardcore",
    "Softcore", "Tease & Denial", "Edging",
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
  "Big Ass", "Big Tits", "MILF", "Anal", "Blowjob", "Deepthroat", "Creampie", "Amateur",
  "POV", "Lesbian", "Threesome", "Cumshot", "Facial", "Ebony", "Asian", "Latina", "Blonde",
  "Redhead", "Squirt", "Public", "Rough Sex", "Step Mom", "PAWG", "Interracial", "4k", "ai",
];

/* Case-insensitive membership test used to boost popular tags in the picker. */
const _popularLower = new Set(POPULAR_TAGS.map(t => t.toLowerCase()));
export function isPopularTag(t) {
  return _popularLower.has(String(t || "").toLowerCase());
}
