/* ============================================================
   WRITER_POSTS — posts from tools/content-manager /internal/writer.
   Data lives in writer-posts.json (easier GitHub API updates).
   ============================================================ */

import data from "./writer-posts.json" with { type: "json" };

export const WRITER_POSTS = Array.isArray(data) ? data : [];
