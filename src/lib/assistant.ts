import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withKey } from "./keys";
import { getSettings } from "./settings";
import { db } from "./db";
import { getAnalyticsSnapshot, summarizeForAi } from "./analytics";
import { askCouncil, type CouncilResult } from "./council";

export const AssistantInput = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

const COUNCIL_TRIGGER = /^\s*ask\s+the\s+council\b[\s:,.-]*([\s\S]*)$/i;

/** "ask the council should I raise prices?" → "should I raise prices?". Returns null when it isn't a council request. */
export function parseCouncilTrigger(text: string): string | null {
  const m = text.match(COUNCIL_TRIGGER);
  if (!m) return null;
  return m[1].trim() || "What should I focus on this week?";
}

export type AssistantReply = { role: "assistant"; content: string; council?: CouncilResult };

const CHAT_SYSTEM = `You are the business assistant inside Vanita Business OS, the owner's dashboard for an agency with three services: AI voice receptionists, web development and dropshipping.
You can see the owner's latest numbers (below). Answer briefly and concretely, quote the numbers you use, and say when a number is missing rather than guessing.
If the owner wants a decision weighed from several angles, suggest they type "ask the council" followed by their question.`;

/** Plain-text council reply for the chat bubble; the widget also renders the structured result. */
export function formatCouncil(c: CouncilResult) {
  const advisors = c.advisors.map((a) => `${a.name}: ${a.advice}`).join("\n\n");
  const actions = c.actions.map((a, i) => `${i + 1}. ${a}`).join("\n");
  return `${advisors}\n\nVerdict: ${c.verdict}\n\nNext 7 days:\n${actions}`;
}

export async function assistantReply(messages: z.infer<typeof AssistantInput>["messages"]): Promise<AssistantReply> {
  const last = messages[messages.length - 1];
  const snapshot = await getAnalyticsSnapshot(30);

  const question = last.role === "user" ? parseCouncilTrigger(last.content) : null;
  if (question !== null) {
    const council = await askCouncil(question, snapshot);
    return { role: "assistant", content: formatCouncil(council), council };
  }

  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  if (settings.demoMode || !hasKey) {
    return {
      role: "assistant",
      content:
        "I can answer questions with live AI once a Claude key is added in Integrations and demo mode is off. Until then here is your current snapshot:\n\n" +
        summarizeForAi(snapshot) +
        '\n\nType "ask the council" followed by your question for advice from the five advisors.',
    };
  }

  try {
    const text = await withKey("CLAUDE", async (apiKey) => {
      const client = new Anthropic({ apiKey });
      const res = await client.messages.create({
        model: settings.claudeModel,
        max_tokens: 800,
        system: `${CHAT_SYSTEM}\n\nLatest numbers:\n${summarizeForAi(snapshot)}`,
        messages: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      });
      const block = res.content.find((b) => b.type === "text");
      return block && block.type === "text" ? block.text.trim() : "";
    });
    return { role: "assistant", content: text || "I couldn't come up with an answer. Try rephrasing." };
  } catch (err) {
    console.error("[assistant] Claude failed", err);
    return { role: "assistant", content: "Claude is unavailable right now (check the API keys in Integrations). Your numbers are still up to date on the dashboard." };
  }
}
