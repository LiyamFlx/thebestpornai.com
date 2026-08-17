/** Parse thebestpornai video URLs / hashes / bare ids → numeric id. */
export function parseVideoId(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  try {
    const u = new URL(s, "https://www.thebestpornai.com");
    const q = u.searchParams.get("video");
    if (q && /^\d+$/.test(q)) return Number(q);
    const hash = (u.hash || "").replace(/^#/, "");
    const m = hash.match(/^video\/(\d+)$/);
    if (m) return Number(m[1]);
  } catch {
    /* fall through */
  }
  const m2 = s.match(/#video\/(\d+)/) || s.match(/#shorts\/(\d+)/) || s.match(/\/watch\/(\d+)/) || s.match(/\/shorts\/(\d+)/) || s.match(/video\/(\d+)/) || s.match(/[?&]video=(\d+)/);
  if (m2) return Number(m2[1]);
  return null;
}

export function videoWatchUrl(id) {
  return `https://www.thebestpornai.com/watch/${Number(id)}`;
}
