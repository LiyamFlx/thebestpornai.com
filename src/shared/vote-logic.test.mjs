import test from "node:test";
import assert from "node:assert/strict";
import { applyVote } from "./vote-logic.js";

test("first like increments and records myVote", () => {
  const { live, action } = applyVote({ like: 4, dislike: 1 }, "like");
  assert.equal(action, "add");
  assert.equal(live.like, 5);
  assert.equal(live.dislike, 1);
  assert.equal(live.myVote, "like");
});

test("second like on the same video unlikes (no extra row / no 409)", () => {
  const { live, action } = applyVote({ like: 5, dislike: 1, myVote: "like" }, "like");
  assert.equal(action, "remove");
  assert.equal(live.like, 4);
  assert.equal(live.myVote, null);
});

test("switching like → dislike moves the single reaction", () => {
  const { live, action, from, to } = applyVote({ like: 5, dislike: 0, myVote: "like" }, "dislike");
  assert.equal(action, "switch");
  assert.equal(from, "like");
  assert.equal(to, "dislike");
  assert.equal(live.like, 4);
  assert.equal(live.dislike, 1);
  assert.equal(live.myVote, "dislike");
});

test("counts never go negative", () => {
  const { live } = applyVote({ like: 0, dislike: 0, myVote: "like" }, "like");
  assert.equal(live.like, 0);
  assert.equal(live.myVote, null);
});
