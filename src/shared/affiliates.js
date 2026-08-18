/** Paid outbound offers. Visible copy can still say “ourdream.ai”. */

const CPA = "https://www.ourdreamersai13.com/9B73ZMB/2CTPL/";

export const OURDREAM = {
  home: `${CPA}?uid=3`,
  create: `${CPA}?uid=172`,
};

/** @param {"home"|"create"} kind */
export function ourdreamUrl(kind = "home", src = "") {
  const base = OURDREAM[kind] || OURDREAM.home;
  const s = String(src || "").trim();
  if (!s) return base;
  return `${base}&s1=${encodeURIComponent(s)}`;
}

export const OURDREAM_REL = "noopener sponsored nofollow";
