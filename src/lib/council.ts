import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withKey } from "./keys";
import { getSettings } from "./settings";
import { db } from "./db";
import { summarizeForAi, type AnalyticsSnapshot } from "./analytics";

export const COUNCIL_MEMBERS = [
  { name: "The Strategist", brief: "Looks at the whole business: where to focus, what to stop doing, what to double down on." },
  { name: "The Growth Marketer", brief: "Channels and reach. Turning DMs, comments, views and visits into paying customers." },
  { name: "The CFO", brief: "Revenue, costs, margin and whether spending is paying back." },
  { name: "The Operator", brief: "Response speed, backlog, workload and follow-up discipline." },
  { name: "The Devil's Advocate", brief: "Challenges the plan, spots wrong assumptions and risks, and points out missing data." },
] as const;

export const CouncilResultSchema = z.object({
  advisors: z
    .array(z.object({ name: z.string().max(60), advice: z.string().max(600) }))
    .min(3)
    .max(6),
  verdict: z.string().max(800),
  actions: z.array(z.string().max(200)).min(1).max(5),
});
export type CouncilResult = z.infer<typeof CouncilResultSchema> & { mode: "live" | "offline"; question: string };

const SYSTEM = `You are the Council: five advisors who review a small agency's business numbers and advise its owner.
The agency sells AI voice receptionists, web development and dropshipping, and tracks Instagram, WhatsApp, YouTube, LinkedIn, email, website forms and finance.
Advisors:
${COUNCIL_MEMBERS.map((m) => `- ${m.name}: ${m.brief}`).join("\n")}
Each advisor speaks in first person, in 2-4 sentences, and must reference a specific number from the data when one is relevant. If the data is missing for something, say so rather than guessing.
Then give a single verdict (2-3 sentences) and 3 to 5 concrete actions for the next 7 days.
Reply with ONLY a JSON object: {"advisors":[{"name":"...","advice":"..."}],"verdict":"...","actions":["..."]}`;

/** Rule-based advice used when no Claude key is configured. Built from the same numbers the AI sees. */
export function offlineCouncil(question: string, s: AnalyticsSnapshot): CouncilResult {
  const metric = (channel: string, key: string) => s.channels.find((c) => c.key === channel)?.metrics.find((m) => m.key === key);
  const dmsIn = metric("INSTAGRAM", "dms_received")?.total ?? 0;
  const dmsOut = metric("INSTAGRAM", "dms_sent")?.total ?? 0;
  const inquiries = metric("INSTAGRAM", "comment_inquiries")?.total ?? 0;
  const formFills = metric("WEBSITE", "form_fills")?.total ?? 0;
  const busiest = s.channels
    .map((c) => ({ label: c.label, total: c.metrics.reduce((a, m) => a + m.total, 0) }))
    .sort((a, b) => b.total - a.total)[0];
  const empty = s.channels.flatMap((c) => c.metrics.filter((m) => m.total === 0 && m.prev === 0).map((m) => `${c.label} ${m.label}`));
  const f = s.finance;

  const advisors = [
    {
      name: "The Strategist",
      advice: busiest && busiest.total > 0
        ? `${busiest.label} carries the most activity in this period (${busiest.total} events). Put the next week's effort there first.`
        : "There is no activity recorded yet. Start by logging real numbers so there is something to decide on.",
    },
    {
      name: "The Growth Marketer",
      advice: `Instagram brought ${dmsIn} DMs and ${inquiries} inquiries from comments, and the website recorded ${formFills} form fills. Route the best-performing post format into more posts.`,
    },
    {
      name: "The CFO",
      advice: f.revenue.total === 0 && f.expenses.total === 0
        ? "No revenue or expenses are logged for this period, so margin can't be judged. Add paid deals and costs first."
        : `Revenue is $${Math.round(f.revenue.total).toLocaleString("en-US")} against $${Math.round(f.expenses.total).toLocaleString("en-US")} of expenses, a ${f.margin}% margin. ${f.margin < 30 ? "That is thin: review the biggest cost category first." : "That is healthy; keep an eye on it as spend grows."}`,
    },
    {
      name: "The Operator",
      advice: dmsIn > dmsOut * 1.5
        ? `You received ${dmsIn} DMs but only sent ${dmsOut} replies. That gap is a response backlog. Clear unanswered threads before starting anything new.`
        : `Replies (${dmsOut}) are keeping pace with incoming DMs (${dmsIn}). Keep follow-ups on the Leads board.`,
    },
    {
      name: "The Devil's Advocate",
      advice: empty.length
        ? `${empty.length} metrics have no data at all (for example: ${empty.slice(0, 3).join(", ")}). Any decision based on them is a guess. Connect the source or log it by hand.`
        : "Every tracked metric has data. Check that the numbers match the source apps, not just the dashboard.",
    },
  ];

  const actions = [
    dmsIn > dmsOut * 1.5 ? "Reply to every open Instagram thread today." : "Follow up on the QUALIFIED and PROPOSAL leads on the Leads board.",
    empty.length ? "Log the missing channels (WhatsApp, YouTube, LinkedIn, email, visits) for the last 7 days." : "Compare the best and worst channel this week and shift one day of effort.",
    f.margin < 30 && f.revenue.total > 0 ? "Review the largest expense category and cancel or downgrade one tool." : "Record every paid deal and expense so profit stays accurate.",
  ];

  return {
    mode: "offline",
    question,
    advisors,
    verdict: `Focus on ${busiest?.label ?? "your strongest channel"}, clear the reply backlog, and make sure every number is logged. (Offline advice: add a Claude key in Integrations for a full council debate.)`,
    actions,
  };
}

/** Asks the five advisors in one Claude call; falls back to offline advice without a key or on any failure. */
export async function askCouncil(question: string, s: AnalyticsSnapshot): Promise<CouncilResult> {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  if (settings.demoMode || !hasKey) return offlineCouncil(question, s);

  try {
    const raw = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: settings.claudeModel,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Business data:\n${summarizeForAi(s)}\n\nQuestion from the owner: ${question || "What should I focus on this week?"}`,
          },
        ],
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text : "";
    });
    const parsed = CouncilResultSchema.parse(JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}"));
    return { ...parsed, mode: "live", question };
  } catch (err) {
    // The council is advice, never a hard failure: fall back to the rule-based one.
    console.error("[council] Claude failed, using offline advice", err);
    return offlineCouncil(question, s);
  }
}
