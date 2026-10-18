import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { withKey } from "./keys";
import { getSettings } from "./settings";
import { db } from "./db";
import { AGENT_TOOLS, runAgentTool } from "./agent-tools";
import { money } from "./utils";

export const CommandInput = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).optional(),
});

export type ToolRun = { tool: string; input: unknown; ok: boolean; result: unknown };
export type CommandReply = { reply: string; mode: "live" | "offline"; actions: ToolRun[] };

const MAX_STEPS = 6;

const SYSTEM = `You are the command agent for North Star AI OS, the owner's dashboard for an agency with two services: AI voice receptionists and web development.
Use the tools to look up real data before answering. Never invent numbers, names or lead ids.
You may change lead stages and add internal notes. You cannot message customers, spend money, edit connections or delete anything. If asked to do one of those, say the owner must do it in the app.
Keep answers short and concrete. After making a change, state exactly what changed.`;

/** Live mode: Claude picks the tools and the loop runs until it answers or hits the step limit. */
async function runLive(message: string, history: { role: "user" | "assistant"; content: string }[], userId: string, model: string): Promise<CommandReply> {
  const actions: ToolRun[] = [];
  const reply = await withKey("CLAUDE", async (apiKey) => {
    const client = new Anthropic({ apiKey });
    const messages: Anthropic.MessageParam[] = [...history.slice(-10), { role: "user", content: message }];

    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.messages.create({
        model,
        max_tokens: 1000,
        system: SYSTEM,
        tools: AGENT_TOOLS as Anthropic.Tool[],
        messages,
      });

      if (res.stop_reason !== "tool_use") {
        const text = res.content.find((b) => b.type === "text");
        return text && text.type === "text" ? text.text.trim() : "Done.";
      }

      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const run = await runAgentTool(block.name, block.input, userId);
        actions.push({ tool: block.name, input: block.input, ok: run.ok, result: run.result });
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(run.result),
          is_error: !run.ok,
        });
      }
      messages.push({ role: "user", content: results });
    }
    return "I stopped after several steps without finishing. Try a narrower command.";
  });
  return { reply, mode: "live", actions };
}

/** Offline mode (demo mode or no Claude key): simple keyword routing to the same read tools. */
async function runOffline(message: string, userId: string): Promise<CommandReply> {
  const text = message.toLowerCase();
  const actions: ToolRun[] = [];
  const call = async (tool: string, input: Record<string, unknown> = {}) => {
    const run = await runAgentTool(tool, input, userId);
    actions.push({ tool, input, ok: run.ok, result: run.result });
    return run;
  };

  if (/goal|target|mrr|recurring|client/.test(text)) {
    const run = await call("get_goal_progress");
    const g = run.result as { mrr: number; targetMrr: number; activeClients: number; targetClients: number };
    return {
      mode: "offline",
      actions,
      reply: `Recurring revenue is ${money(g.mrr)} of ${money(g.targetMrr)}, with ${g.activeClients} of ${g.targetClients} clients.`,
    };
  }

  const stage = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"].find((s) => text.includes(s.toLowerCase()));
  if (/lead|pipeline/.test(text)) {
    const run = await call("list_leads", stage ? { stage, limit: 10 } : { limit: 10 });
    const leads = run.result as { title: string; contact: string; stage: string }[];
    return {
      mode: "offline",
      actions,
      reply: leads.length
        ? `${leads.length} lead${leads.length === 1 ? "" : "s"}:\n` + leads.map((l) => `- ${l.contact}: ${l.title} (${l.stage})`).join("\n")
        : "No leads match that.",
    };
  }

  if (/connect|channel|integration/.test(text)) {
    const run = await call("list_connections");
    const rows = run.result as { name: string; status: string }[];
    return { mode: "offline", actions, reply: rows.map((r) => `${r.name}: ${r.status.toLowerCase().replace("_", " ")}`).join("\n") };
  }

  const run = await call("get_business_snapshot", { range_days: 30 });
  return {
    mode: "offline",
    actions,
    reply: `Here is your last 30 days:\n\n${String(run.result)}\n\nAdd a Claude key in Integrations and turn off demo mode for free-form answers.`,
  };
}

export async function runCommand(input: z.infer<typeof CommandInput>, userId: string): Promise<CommandReply> {
  const settings = await getSettings();
  const hasKey = (await db.apiKey.count({ where: { provider: "CLAUDE", status: "ACTIVE" } })) > 0;
  if (settings.demoMode || !hasKey) return runOffline(input.message, userId);

  try {
    return await runLive(input.message, input.history ?? [], userId, settings.claudeModel);
  } catch (err) {
    console.error("[command-agent] Claude failed, using offline routing", err);
    const fallback = await runOffline(input.message, userId);
    return { ...fallback, reply: `Claude is unavailable right now, so here is a basic answer. ${fallback.reply}` };
  }
}
