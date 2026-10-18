import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { memoryRateLimit } from "../src/lib/rate-limit";
import { safeEqual, verifySignature } from "../src/lib/meta";
import { heuristicAgentDecision, heuristicClassify, templateReply } from "../src/lib/ai/classify";
import { isHiggsfieldCredential } from "../src/lib/higgsfield";

test("memoryRateLimit blocks after the limit and recovers after the window", () => {
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(memoryRateLimit("k", 3, 1000, t).ok, true);
  const blocked = memoryRateLimit("k", 3, 1000, t + 10);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  assert.equal(memoryRateLimit("k", 3, 1000, t + 1001).ok, true);
});

test("verifySignature accepts a valid Meta HMAC and rejects tampering", () => {
  const body = '{"entry":[]}';
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "s3cret"), true);
  assert.equal(verifySignature(body + " ", sig, "s3cret"), false);
  assert.equal(verifySignature(body, null, "s3cret"), false);
  assert.equal(verifySignature(body, "sha256=abc", "s3cret"), false);
});

test("safeEqual compares tokens in constant time without throwing on length mismatch", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual(null, "abc"), false);
});

test("heuristicClassify routes messages to the right service", () => {
  assert.equal(heuristicClassify("Can your AI receptionist answer missed calls? price?").service, "AI_VOICE");
  assert.equal(heuristicClassify("Need a new website and landing page, budget $2k").service, "WEB_DEV");
  assert.equal(heuristicClassify("hello there").service, "UNASSIGNED");
});

test("templateReply answers with the matching service pitch", () => {
  assert.match(templateReply("Need a website for my bakery"), /websites/);
  assert.match(templateReply("hello"), /tell me a bit more/);
});

test("heuristicAgentDecision replies normally and hands off when a person is requested", () => {
  const normal = heuristicAgentDecision("Do you build websites for restaurants?");
  assert.equal(normal.handoff, false);
  assert.match(normal.reply, /websites/);

  const human = heuristicAgentDecision("Can I talk to a real person please?");
  assert.equal(human.handoff, true);
  assert.ok(human.reply.length > 0);
  assert.equal(heuristicAgentDecision("I want a refund").handoff, true);
});

test("isHiggsfieldCredential requires KEY_ID:KEY_SECRET", () => {
  assert.equal(isHiggsfieldCredential("abc123:def456"), true);
  assert.equal(isHiggsfieldCredential("abc123"), false);
  assert.equal(isHiggsfieldCredential("a:b:c"), false);
  assert.equal(isHiggsfieldCredential("abc 1:def"), false);
});
