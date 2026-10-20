import { test } from "node:test";
import assert from "node:assert/strict";
import { isKnownMetric, pctDelta, windowSummary } from "../src/lib/analytics";
import { parseCouncilTrigger } from "../src/lib/assistant";
import { offlineCouncil } from "../src/lib/council";

const DAY = 86_400_000;
const cur = new Date(Date.UTC(2026, 9, 10));
const prev = new Date(cur.getTime() - 3 * DAY);

test("pctDelta handles zero baselines", () => {
  assert.equal(pctDelta(150, 100), 50);
  assert.equal(pctDelta(50, 100), -50);
  assert.equal(pctDelta(5, 0), 100);
  assert.equal(pctDelta(0, 0), 0);
});

test("windowSummary splits points into current window, previous window and per-day series", () => {
  const points = [
    { t: new Date(cur.getTime() + 0.5 * DAY), v: 2 }, // day 0
    { t: new Date(cur.getTime() + 2 * DAY + 1000), v: 3 }, // day 2
    { t: new Date(cur.getTime() + 2 * DAY + 2000), v: 1 }, // day 2
    { t: new Date(prev.getTime() + DAY), v: 4 }, // previous window
    { t: new Date(cur.getTime() - 4 * DAY), v: 100 }, // before both windows, ignored
  ];
  const s = windowSummary(points, cur, prev, 3);
  assert.deepEqual(s.series, [2, 0, 4]);
  assert.equal(s.total, 6);
  assert.equal(s.prev, 4);
  assert.equal(s.delta, 50);
});

test("isKnownMetric only accepts configured channel/metric pairs", () => {
  assert.equal(isKnownMetric("WHATSAPP", "messages_received"), true);
  assert.equal(isKnownMetric("WHATSAPP", "views"), false);
  assert.equal(isKnownMetric("NOPE", "views"), false);
});

test("parseCouncilTrigger detects 'ask the council' and extracts the question", () => {
  assert.equal(parseCouncilTrigger("ask the council should I raise prices?"), "should I raise prices?");
  assert.equal(parseCouncilTrigger("Ask the council: where to spend?"), "where to spend?");
  assert.equal(parseCouncilTrigger("  ASK THE COUNCIL  "), "What should I focus on this week?");
  assert.equal(parseCouncilTrigger("how is revenue?"), null);
  assert.equal(parseCouncilTrigger("please ask the council"), null);
});

test("offlineCouncil returns five advisors, a verdict and actions from the numbers", () => {
  const channel = (key: string, label: string, metrics: [string, number][]) => ({
    key,
    label,
    metrics: metrics.map(([k, total]) => ({ key: k, label: k, tracking: "live" as const, total, prev: 0, delta: 0, series: [] })),
  });
  const snapshot = {
    rangeDays: 30,
    days: [],
    channels: [
      channel("INSTAGRAM", "Instagram", [["dms_received", 90], ["dms_sent", 10], ["comment_inquiries", 4]]),
      channel("WHATSAPP", "WhatsApp", [["messages_received", 0]]),
    ],
    finance: {
      revenue: { total: 1000, prev: 0, delta: 100, series: [] },
      expenses: { total: 900, prev: 0, delta: 0, series: [] },
      profit: { total: 100, prev: 0, delta: 0, series: [] },
      margin: 10,
      byCategory: {},
    },
  } as unknown as Parameters<typeof offlineCouncil>[1];

  const c = offlineCouncil("where next?", snapshot);
  assert.equal(c.mode, "offline");
  assert.equal(c.advisors.length, 5);
  assert.ok(c.advisors[3].advice.includes("backlog"), "Martell flags the reply backlog");
  assert.ok(c.advisors[4].advice.includes("10% margin"), "Buffett reports the margin");
  assert.ok(c.actions.length >= 1 && c.actions.length <= 5);
});
