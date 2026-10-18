import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withKey } from "./keys";
import { getSettings } from "./settings";
import { db } from "./db";
import { summarizeForAi, type AnalyticsSnapshot } from "./analytics";
import { SEATS, type Seat } from "./council-seats";

/** One answer per seat, plus the Chair's verdict. Shape is shared by live and offline councils. */
export const CouncilResultSchema = z.object({
  advisors: z
    .array(z.object({ name: z.string().max(60), advice: z.string().max(900) }))
    .min(1)
    .max(7),
  verdict: z.string().max(800),
  actions: z.array(z.string().max(200)).min(1).max(5),
});
export type CouncilResult = z.infer<typeof CouncilResultSchema> & { mode: "live" | "offline"; question: string };

const SEAT_TASK = `Answer the owner's question from your seat only. Speak in the first person, 2-4 sentences, and use a specific number from the business data when one is relevant. If the data you need is missing, say so and state the assumption you are making. Finish with two lines:
Vote: YES, NO or CONDITIONAL
Score: a number from 1 to 10 for how strongly this decision is worth making now`;

const CHAIR = `You are the Chair of a council of seven advisors. You have their written answers. Weigh them, note where they disagree, and give one verdict.
Reply with ONLY a JSON object: {"verdict":"2-3 sentences, plain English","actions":["3 to 5 concrete actions for the next 7 days"]}`;

function seatPrompt(seat: Seat) {
  return `${seat.persona}\n\n# Your brain (the compiled notes you reason from)\n${seat.brain}\n\n# Rules for this council\nYou have no tools and no other files. Your brain above is all you know about your expert. ${SEAT_TASK}`;
}

/** Rule-based advice used when no Claude key is configured. Only the seats whose lens the data can speak to. */
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
  const seat = (id: string) => SEATS.find((x) => x.id === id)!;

  const advisors = [
    {
      name: seat("bezos").name,
      advice: busiest && busiest.total > 0
        ? `${busiest.label} carries the most activity in this period (${busiest.total} events). Put the next week's effort there first, and keep the rest reversible.`
        : "There is no activity recorded yet. Start by logging real numbers so there is something to decide on.",
    },
    {
      name: seat("graham").name,
      advice: empty.length
        ? `${empty.length} metrics have no data at all (for example: ${empty.slice(0, 3).join(", ")}). I can't tell whether people want this yet until the numbers exist.`
        : "Every tracked metric has data. Check that the numbers match the source apps before you read demand into them.",
    },
    {
      name: seat("hormozi").name,
      advice: `Instagram brought ${dmsIn} DMs and ${inquiries} inquiries from comments, and the website recorded ${formFills} form fills. Close the conversations you already have before you buy more reach.`,
    },
    {
      name: seat("martell").name,
      advice: dmsIn > dmsOut * 1.5
        ? `You received ${dmsIn} DMs but only sent ${dmsOut} replies. That gap is a response backlog, and it is your time, not a new hire's, that has to clear it.`
        : `Replies (${dmsOut}) are keeping pace with incoming DMs (${dmsIn}). Keep follow-ups on the Leads board.`,
    },
    {
      name: seat("buffett").name,
      advice: f.revenue.total === 0 && f.expenses.total === 0
        ? "No revenue or expenses are logged for this period, so I can't judge the cash math. Add paid deals and costs first."
        : `Revenue is $${Math.round(f.revenue.total).toLocaleString("en-US")} against $${Math.round(f.expenses.total).toLocaleString("en-US")} of expenses, a ${f.margin}% margin. ${f.margin < 30 ? "That is thin: review the biggest cost category first." : "That is healthy; keep an eye on it as spend grows."}`,
    },
  ];

  const actions = [
    dmsIn > dmsOut * 1.5 ? "Reply to every open Instagram thread today." : "Follow up on the qualified and proposal leads on the Leads board.",
    empty.length ? "Log the missing channels (WhatsApp, YouTube, LinkedIn, email, visits) for the last 7 days." : "Compare the best and worst channel this week and shift one day of effort.",
    f.margin < 30 && f.revenue.total > 0 ? "Review the largest expense category and cancel or downgrade one tool." : "Record every paid deal and expense so profit stays accurate.",
  ];

  return {
    mode: "offline",
    question,
    advisors,
    verdict: `Focus on ${busiest?.label ?? "your strongest channel"}, clear the reply backlog, and make sure every number is logged. Five of seven seats are shown offline; add a Claude key in Integrations for the full council.`,
    actions,
  };
}

/** Seven seats answer in parallel, then the Chair weighs them. Falls back to offline advice without a key or on any failure. */
export async function askCouncil(question: string, s: AnalyticsSnapshot): Promise<CouncilResult> {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  if (settings.demoMode || !hasKey) return offlineCouncil(question, s);

  const ask = question || "What should I focus on this week?";
  const businessData = `Business data:\n${summarizeForAi(s)}\n\nQuestion from the owner: ${ask}`;

  try {
    const result = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const text = (res: Anthropic.Message) => {
        const block = res.content.find((b) => b.type === "text");
        return block && block.type === "text" ? block.text.trim() : "";
      };

      const answers = await Promise.all(
        SEATS.map(async (seat) => {
          const res = await client.messages.create({
            model: settings.claudeModel,
            max_tokens: 500,
            system: seatPrompt(seat),
            messages: [{ role: "user", content: businessData }],
          });
          return { name: seat.name, advice: text(res) || "No answer from this seat." };
        }),
      );

      const chairRes = await client.messages.create({
        model: settings.claudeModel,
        max_tokens: 600,
        system: CHAIR,
        messages: [
          {
            role: "user",
            content: `${businessData}\n\nSeat answers:\n${answers.map((a) => `${a.name}: ${a.advice}`).join("\n\n")}`,
          },
        ],
      });
      const chair = JSON.parse(text(chairRes).match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      return { advisors: answers, verdict: chair.verdict, actions: chair.actions };
    });
    const parsed = CouncilResultSchema.parse(result);
    return { ...parsed, mode: "live", question };
  } catch (err) {
    // The council is advice, never a hard failure: fall back to the rule-based one.
    console.error("[council] Claude failed, using offline advice", err);
    return offlineCouncil(question, s);
  }
}
