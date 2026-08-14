import test from "node:test";
import assert from "node:assert/strict";

// Isolate DATA + vstate the way comments.js reads them.
import { DATA } from "../shared/catalog.js";
import { vstate } from "./state.js";
import { commentsFor } from "./comments.js";

test("commentsFor hides overlay rows that already landed in DATA.comments", () => {
  const vid = 900001;
  const seed = DATA.comments.slice();
  DATA.comments.push({ id: "db1", video: vid, user: "Guest", text: "hello" });
  vstate.live[vid] = { like: 0, dislike: 0, comments: [
    { id: "m1", video: vid, user: "Guest", text: "hello" },
    { id: "m2", video: vid, user: "Guest", text: "still pending" },
  ]};
  const list = commentsFor({ id: vid });
  DATA.comments.length = 0;
  DATA.comments.push(...seed);
  delete vstate.live[vid];
  assert.equal(list.filter(c => c.text === "hello").length, 1);
  assert.ok(list.some(c => c.text === "still pending"));
});
