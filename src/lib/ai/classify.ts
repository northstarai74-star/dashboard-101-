import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { withKey } from "../keys";
import { getSettings } from "../settings";
import { db } from "../db";

export const ClassificationSchema = z.object({
  service: z.enum(["AI_VOICE", "WEB_DEV", "UNASSIGNED"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().max(300),
  suggestedAgent: z.enum(["AI", "HUMAN"]),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const KEYWORDS: Record<"AI_VOICE" | "WEB_DEV", RegExp> = {
  AI_VOICE: /(receptionist|voice|call|phone|answer(ing)? calls|missed calls|appointment|booking|ai agent|front desk)/i,
  WEB_DEV: /(website|web ?site|web app|landing page|shopify theme|redesign|seo|ecommerce site|portfolio|developer|build (me )?a (site|app))/i,
};

/** Offline fallback used in demo mode or when no Claude key is available. */
export function heuristicClassify(text: string): Classification {
  let best: Classification["service"] = "UNASSIGNED";
  let hits = 0;
  for (const [service, re] of Object.entries(KEYWORDS)) {
    const count = (text.match(new RegExp(re.source, "gi")) ?? []).length;
    if (count > hits) {
      hits = count;
      best = service as Classification["service"];
    }
  }
  const intent = /(price|quote|cost|how much|interested|book|buy|order|call me|dm me|asap|urgent|budget)/i.test(text);
  const score = Math.min(95, 25 + hits * 15 + (intent ? 25 : 0));
  return {
    service: best,
    score: best === "UNASSIGNED" ? Math.min(score, 30) : score,
    summary: text.length > 140 ? text.slice(0, 137) + "…" : text,
    suggestedAgent: best === "AI_VOICE" ? "AI" : "HUMAN",
  };
}

const SYSTEM = `You qualify inbound leads for a small agency with two services:
- AI_VOICE: AI voice receptionist agents that answer business phone calls and book appointments
- WEB_DEV: website / web app development
Given a message from a prospect, reply with ONLY a JSON object:
{"service":"AI_VOICE|WEB_DEV|UNASSIGNED","score":0-100 purchase-intent score,"summary":"one sentence <=200 chars","suggestedAgent":"AI|HUMAN"}
Use HUMAN when the lead is high value, complex or emotional; AI for simple FAQ-style enquiries. Use UNASSIGNED when it fits none of the services.`;

export async function classifyText(text: string): Promise<Classification> {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  if (settings.demoMode || !hasKey) return heuristicClassify(text);

  try {
    const raw = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: settings.claudeModel,
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    });
    const match = raw.match(/\{[\s\S]*\}/);
    return ClassificationSchema.parse(JSON.parse(match?.[0] ?? "{}"));
  } catch {
    // Never lose a lead because classification failed.
    return heuristicClassify(text);
  }
}

const TEMPLATE_BODY: Record<Classification["service"], string> = {
  AI_VOICE: "Our AI voice receptionist answers every call, books appointments and never misses a lead. Want a quick 10-min demo this week?",
  WEB_DEV: "We build fast, conversion-focused websites. Could you share your business, goals and a rough budget so I can send a proposal?",
  UNASSIGNED: "Could you tell me a bit more about what you're looking for so I can point you to the right person?",
};

/** Canned reply used offline, in demo mode, or when Claude is unavailable. */
export function templateReply(lastInbound: string) {
  return `Hi! Thanks for reaching out 👋 ${TEMPLATE_BODY[heuristicClassify(lastInbound).service]}`;
}

const lastInbound = (history: { direction: string; text: string }[]) =>
  [...history].reverse().find((m) => m.direction === "IN")?.text ?? "";

const toTranscript = (history: { direction: string; text: string }[]) =>
  history
    .slice(-12)
    .map((m) => `${m.direction === "IN" ? "Prospect" : "Us"}: ${m.text}`)
    .join("\n");

async function claudeAvailable() {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  return { settings, live: !settings.demoMode && hasKey };
}

export async function suggestReply(history: { direction: string; text: string }[]): Promise<string> {
  const { settings, live } = await claudeAvailable();
  const fallback = templateReply(lastInbound(history));
  if (!live) return fallback;
  try {
    const text = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: settings.claudeModel,
        max_tokens: 1024,
        system:
          "You write short, friendly Instagram DM replies for an agency offering AI voice receptionists and web development. Reply with only the message text (max 3 sentences), ending with a clear next step.",
        messages: [{ role: "user", content: toTranscript(history) }],
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text.trim() : "";
    });
    return text || fallback;
  } catch (err) {
    // A draft is a convenience: never fail the button because Claude is down or out of keys.
    console.error("[suggestReply] Claude failed, using template", err);
    return fallback;
  }
}

export const AgentDecisionSchema = z.object({
  reply: z.string(),
  handoff: z.boolean(),
  reason: z.string(),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

const HANDOFF_RE =
  /(human|real person|someone real|speak (to|with)|talk (to|with)|call me|phone me|manager|owner|complain|refund|cancel|angry|scam|lawyer|contract|invoice)/i;

/** Offline agent: canned reply, hands off when the prospect asks for a person or the topic is sensitive. */
export function heuristicAgentDecision(lastText: string): AgentDecision {
  if (HANDOFF_RE.test(lastText)) {
    return {
      reply: "Thanks! I'm passing this to a teammate who'll get back to you shortly 🙏",
      handoff: true,
      reason: "Prospect asked for a person or raised a sensitive topic",
    };
  }
  return { reply: templateReply(lastText), handoff: false, reason: "" };
}

const AGENT_SYSTEM = `You are the first-line AI assistant replying to Instagram DMs for a small agency with three services:
- AI voice receptionist agents that answer business phone calls and book appointments
- Website / web app development
Write the next reply to the prospect: friendly, max 3 short sentences, ending with a clear next step (a question, a demo, or asking for details).
Never invent prices, discounts, deadlines or guarantees.
Set handoff=true when a human should take over: the prospect asks for a person or a call, wants a quote or contract, is upset, the request is complex or high-value, or you are unsure. When handing off, the reply should tell them a teammate will follow up. Give a short reason for the decision.`;

/** Decides the AI agent's next DM: what to say and whether to hand the lead to a human. */
export async function agentDecision(history: { direction: string; text: string }[]): Promise<AgentDecision> {
  const { settings, live } = await claudeAvailable();
  const last = lastInbound(history);
  if (!live) return heuristicAgentDecision(last);
  try {
    const decision = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.parse({
        model: settings.claudeModel,
        max_tokens: 2048,
        system: AGENT_SYSTEM,
        messages: [{ role: "user", content: toTranscript(history) }],
        output_config: { format: zodOutputFormat(AgentDecisionSchema) },
      });
      return res.parsed_output;
    });
    // A refusal or unparseable answer leaves no decision: let a person handle it.
    if (!decision?.reply.trim()) return { ...heuristicAgentDecision(last), handoff: true, reason: "AI could not draft a reply" };
    return { ...decision, reply: decision.reply.trim() };
  } catch (err) {
    console.error("[agent] Claude failed, using offline agent", err);
    return heuristicAgentDecision(last);
  }
}
