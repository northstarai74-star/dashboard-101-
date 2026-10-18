// Integration tests against a real Postgres (CI runs them after `prisma migrate deploy`).
// Skipped when DATABASE_URL isn't set, so `npm test` still works without a database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const skip = !process.env.DATABASE_URL && "DATABASE_URL not set";

test("rateLimit is shared through the database and resets", { skip }, async () => {
  const { rateLimit, resetRateLimit } = await import("../src/lib/rate-limit");
  const key = `test:${randomUUID()}`;
  for (let i = 0; i < 3; i++) assert.equal((await rateLimit(key, 3, 60_000)).ok, true);
  const blocked = await rateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  await resetRateLimit(key);
  assert.equal((await rateLimit(key, 3, 60_000)).ok, true);
  await resetRateLimit(key);
  // An expired window starts over
  const old = Date.now() - 120_000;
  const k2 = `test:${randomUUID()}`;
  for (let i = 0; i < 5; i++) await rateLimit(k2, 3, 60_000, old);
  assert.equal((await rateLimit(k2, 3, 60_000)).ok, true);
  await resetRateLimit(k2);
});

test("AI agent replies to leads assigned to it and hands off on request (demo mode)", { skip }, async (t) => {
  const { db } = await import("../src/lib/db");
  const { saveSettings, getSettings } = await import("../src/lib/settings");
  const { ingestMessage } = await import("../src/lib/ingest");
  const { runAiAgent } = await import("../src/lib/agent");

  const before = await getSettings();
  const prevRule = await db.assignmentRule.findUnique({ where: { service: "AI_VOICE" } });
  const owner = await db.user.create({ data: { name: "Agent Test Owner", email: `owner-${randomUUID()}@test.local`, passwordHash: "x" } });
  await saveSettings({ demoMode: true, autoAssign: true, aiAgent: true });
  await db.assignmentRule.upsert({
    where: { service: "AI_VOICE" },
    create: { service: "AI_VOICE", agent: "AI", userId: owner.id },
    update: { agent: "AI", userId: owner.id },
  });
  const igUserId = `test_${randomUUID()}`;

  t.after(async () => {
    await db.contact.deleteMany({ where: { igUserId } });
    await db.user.delete({ where: { id: owner.id } }).catch(() => {});
    if (prevRule) await db.assignmentRule.update({ where: { id: prevRule.id }, data: { agent: prevRule.agent, userId: prevRule.userId } });
    else await db.assignmentRule.deleteMany({ where: { service: "AI_VOICE" } });
    await saveSettings(before);
  });

  const r = await ingestMessage({ igUserId, name: "Test Prospect", text: "Can your AI receptionist answer missed calls? price?",externalId: `m_${randomUUID()}` });
  assert.ok(r);
  const lead = await db.lead.findFirstOrThrow({ where: { contactId: r.contactId } });
  assert.equal(lead.assignedAgent, "AI");

  const first = await runAiAgent(r.conversationId);
  assert.ok(first?.sent);
  assert.equal(first.handoff, false);
  const aiMsgs = await db.message.findMany({ where: { conversationId: r.conversationId, byAi: true } });
  assert.equal(aiMsgs.length, 1);
  assert.equal((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage, "CONTACTED");

  // Not its turn: the last message is the agent's own reply
  assert.equal(await runAiAgent(r.conversationId), null);

  await ingestMessage({ igUserId, text: "Can I talk to a real person?", externalId: `m_${randomUUID()}` });
  const second = await runAiAgent(r.conversationId);
  assert.equal(second?.handoff, true);
  const handed = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.equal(handed.assignedAgent, "HUMAN");
  assert.equal(handed.assignedUserId, owner.id);

  // Once a person owns the lead the agent stays quiet
  await ingestMessage({ igUserId, text: "hello?", externalId: `m_${randomUUID()}` });
  assert.equal(await runAiAgent(r.conversationId), null);
});

test("an echo of a message we already sent is not stored twice", { skip }, async (t) => {
  const { db } = await import("../src/lib/db");
  const { ingestMessage } = await import("../src/lib/ingest");
  const { recordOutgoing } = await import("../src/lib/outbox");
  const igUserId = `test_${randomUUID()}`;
  t.after(async () => {
    await db.contact.deleteMany({ where: { igUserId } });
  });

  const r = await ingestMessage({ igUserId, text: "hi", externalId: `m_${randomUUID()}` });
  assert.ok(r);
  const mid = `mid_${randomUUID()}`;
  // Echo arrives first (webhook), then the send call records the same mid
  await ingestMessage({ igUserId, text: "Thanks for writing!", externalId: mid, direction: "OUT" });
  await recordOutgoing(r.conversationId, "Thanks for writing!", { externalId: mid, byAi: true });
  const out = await db.message.findMany({ where: { conversationId: r.conversationId, direction: "OUT" } });
  assert.equal(out.length, 1);
  assert.equal(out[0].byAi, true);
});

test("ADMIN_EMAIL + ADMIN_PASSWORD recover the admin account", { skip }, async (t) => {
  const bcrypt = (await import("bcryptjs")).default;
  const { db } = await import("../src/lib/db");
  const { signInWithEnvAdmin, PUBLISHED_DEFAULT_PASSWORD } = await import("../src/lib/admin-recovery");
  const env = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  const adminEmail = `owner-${randomUUID()}@test.local`;
  // Make sure the database isn't empty, so this exercises recovery rather than first-run creation
  const other = await db.user.create({ data: { name: "Other", email: `other-${randomUUID()}@test.local`, passwordHash: "x" } });
  t.after(async () => {
    process.env.ADMIN_EMAIL = env.email;
    process.env.ADMIN_PASSWORD = env.password;
    await db.user.deleteMany({ where: { email: { in: [adminEmail, other.email] } } });
    await db.$disconnect();
  });

  process.env.ADMIN_EMAIL = adminEmail.toUpperCase();
  process.env.ADMIN_PASSWORD = "Recover-me-42";

  // Email renamed in the environment: the account doesn't exist yet, so it is created as an admin
  const created = await signInWithEnvAdmin(undefined, "Recover-me-42");
  assert.equal(created?.email, adminEmail);
  assert.equal(created?.role, "ADMIN");

  // Password changed elsewhere (or forgotten): the env credentials reset it
  await db.user.update({ where: { email: adminEmail }, data: { passwordHash: await bcrypt.hash("something-else", 10), role: "MEMBER" } });
  const reset = await signInWithEnvAdmin(adminEmail, "Recover-me-42");
  assert.equal(reset?.id, created?.id);
  assert.equal(reset?.role, "ADMIN");
  assert.ok(await bcrypt.compare("Recover-me-42", reset!.passwordHash));

  // Wrong password, or a different email, is not an env sign-in
  assert.equal(await signInWithEnvAdmin(adminEmail, "Recover-me-43"), null);
  assert.equal(await signInWithEnvAdmin(other.email, "Recover-me-42"), null);

  // The published example password never works as a recovery key
  process.env.ADMIN_PASSWORD = PUBLISHED_DEFAULT_PASSWORD;
  assert.equal(await signInWithEnvAdmin(adminEmail, PUBLISHED_DEFAULT_PASSWORD), null);
});
