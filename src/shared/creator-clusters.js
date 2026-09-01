/**
 * Creator Profile Clusters & Taxonomy Consolidation
 * Defines canonical data for Pornstar and Creator entities across the platform.
 */

import { DATA } from "./catalog.js";

export const CREATOR_CLUSTERS = [
  {
    id: "ps-mia-nympo",
    canonical: true,
    name: "Mia Nympo",
    handle: "@mianympo",
    slug: "mia-nympo",
    category: "Babe",
    avatar: "../media/Mia Nympo PornStar/Mia Nympo6.avif",
    banner: "../media/Mia Nympo PornStar/Mia Nympo7.avif",
    introVideoId: 5168,
    bio: "AI pornstar sensation — blonde, bold, and built for repeat viewing. Featuring full-length intro scenes and ultra-realistic 4K vertical Shorts.",
    tags: ["Mia Nympo", "Pornstar", "Blonde", "Babe", "AI", "Solo"],
    aliases: ["ps-mia-nympo", "mianympo"],
  },
  {
    id: "ps-sabrina-ass",
    canonical: true,
    name: "Sabrina Ass",
    handle: "@sabrinaass",
    slug: "sabrina-ass",
    category: "Big Ass",
    avatar: "../media/Sabrina Ass/Sabrina.avif",
    banner: "../media/Sabrina Ass/Sabrina 2.avif",
    introVideoId: 5248,
    bio: "AI pornstar powerhouse — legendary curves, PAWG perfection, and unapologetic big-ass scenes.",
    tags: ["Sabrina Ass", "Pornstar", "Big Ass", "Babe", "AI", "Solo", "PAWG"],
    aliases: ["ps-sabrina-ass", "sabrinaass"],
  },
  {
    id: "ps-marsha-banks",
    canonical: true,
    name: "Marsha Banks",
    handle: "@marshabanks",
    slug: "marsha-banks",
    category: "MILF",
    avatar: "../media/Marsha Banks/Marsha Banks.avif",
    banner: "../media/Marsha Banks/Marsha Banks pool.avif",
    introVideoId: 5257,
    bio: "AI mature star — confident elegance, irresistible MILF energy, and slow-burn sensual heat.",
    tags: ["Marsha Banks", "Pornstar", "MILF", "Babe", "AI", "Solo", "Romantic"],
    aliases: ["ps-marsha-banks", "marshabanks"],
  },
  {
    id: "ps-anna-vance",
    canonical: true,
    name: "Anna Vance",
    handle: "@annavance",
    slug: "anna-vance",
    category: "Babe",
    avatar: "../media/thumbs/new batch 5/Anna Super Model00001.jpg",
    banner: "../media/thumbs/new batch 5/Anna Super Model00001.jpg",
    introVideoId: 4935,
    bio: "High-fashion AI supermodel — brunette waves, flawless studio lighting, and endless bedroom poses.",
    tags: ["Anna Vance", "Pornstar", "Babe", "AI", "Solo", "Supermodel"],
    aliases: ["ps-anna-vance", "annavance"],
  },
  {
    id: "ps-kaya-sky",
    canonical: true,
    name: "Kaya Sky",
    handle: "@kayasky",
    slug: "kaya-sky",
    category: "Babe",
    avatar: "../media/thumbs/new-batch-2026-08-26/nyc-rooftop-threesome/NYC-Rooftop-Threesome__Clip-1.jpg",
    banner: "../media/thumbs/new-batch-2026-08-26/nyc-rooftop-threesome/NYC-Rooftop-Threesome__Clip-1.jpg",
    introVideoId: 6294,
    bio: "NYC skyline AI babe — outdoor sunset views, rooftop heat, and intimate multi-angle scenes.",
    tags: ["Kaya Sky", "Pornstar", "Babe", "Lesbian", "AI", "Rooftop"],
    aliases: ["ps-kaya-sky", "kayasky"],
  },
  {
    id: "ps-bella-bloom",
    canonical: true,
    name: "Bella Bloom",
    handle: "@bellabloom",
    slug: "bella-bloom",
    category: "Babe",
    avatar: "../media/thumbs/all mp4 porn /the most pretty girl.jpg",
    banner: "../media/thumbs/all mp4 porn /the most pretty girl.jpg",
    introVideoId: 3574,
    bio: "Petite AI bombshell — captivating eyes, soft facial features, and intimate solo bedroom clips.",
    tags: ["Bella Bloom", "Pornstar", "Babe", "AI", "Solo"],
    aliases: ["ps-bella-bloom", "bellabloom"],
  },
  {
    id: "ps-sienna-west",
    canonical: true,
    name: "Sienna West",
    handle: "@siennawest",
    slug: "sienna-west",
    category: "Big Tits",
    avatar: "../media/thumbs/batch-1/Amazing Demure Desires Big naturals1.jpg",
    banner: "../media/thumbs/batch-1/Amazing Demure Desires Big naturals1.jpg",
    introVideoId: 190,
    bio: "Stacked AI beauty — demure charm, huge natural tits, and slow-motion bedroom teases.",
    tags: ["Sienna West", "Pornstar", "Big Tits", "Babe", "AI", "Solo"],
    aliases: ["ps-sienna-west", "siennawest"],
  },
  {
    id: "ps-jenny-cross",
    canonical: true,
    name: "Jenny Cross",
    handle: "@jennycross",
    slug: "jenny-cross",
    category: "Big Ass",
    avatar: "../media/thumbs/new batch 6/Jenny Butt Perfect Ass rooftop.jpg",
    banner: "../media/thumbs/new batch 6/Jenny Butt Perfect Ass rooftop.jpg",
    introVideoId: 5082,
    bio: "PAWG AI dancer — legendary rooftop curves, bubble butt close-ups, and outdoor twerk energy.",
    tags: ["Jenny Cross", "Pornstar", "Big Ass", "PAWG", "Babe", "AI"],
    aliases: ["ps-jenny-cross", "jennycross"],
  },
  {
    id: "ps-scarlett-flame",
    canonical: true,
    name: "Scarlett Flame",
    handle: "@scarlettflame",
    slug: "scarlett-flame",
    category: "Redhead",
    avatar: "../media/thumbs/Redhead getting fuck COMPILATION/REDHED COMPLITION00001.jpg",
    banner: "../media/thumbs/Redhead getting fuck COMPILATION/REDHED COMPLITION00001.jpg",
    introVideoId: 1380,
    bio: "Fiery redhead AI star — pale skin, intense gaze, and uninhibited passion in full 4K resolution.",
    tags: ["Scarlett Flame", "Pornstar", "Redhead", "Babe", "AI", "Solo"],
    aliases: ["ps-scarlett-flame", "scarlettflame"],
  },
];

/**
 * Returns cluster information for a given creator ID or slug.
 * @param {string} idOrSlug 
 */
export function getClusterInfo(idOrSlug) {
  if (!idOrSlug) return null;
  const key = String(idOrSlug).toLowerCase().trim();
  return CREATOR_CLUSTERS.find(
    (c) => c.id === key || c.slug === key || c.aliases.includes(key)
  ) || null;
}

/**
 * Computes exact count of matching videos for a creator cluster.
 * @param {string} clusterId 
 * @param {Array} videos 
 */
export function getClusterVideoCount(clusterId, videos = DATA.videos) {
  if (!clusterId || !Array.isArray(videos)) return 0;
  return videos.filter((v) => v.creator === clusterId).length;
}
