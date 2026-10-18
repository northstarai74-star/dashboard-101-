import { z } from "zod";
import { db } from "./db";
import { getAnalyticsSnapshot, summarizeForAi } from "./analytics";
import { getGoalSnapshot } from "./goals";
import { listChannels } from "./connections";
import { STAGES } from "./constants";

/**
 * Tools the command agent can call. Read tools are free to use. Write tools only change this app's own
 * records (stage, notes) and never contact a customer, spend money or delete anything.
 */
export const AGENT_TOOLS = [
  {
    name: "get_business_snapshot",
    description: "Headline numbers for the last N days: leads, customers, revenue, conversion, per-channel figures.",
    input_schema: {
      type: "object" as const,
      properties: { range_days: { type: "integer", enum: [7, 30, 90], description: "Days to cover. Defaults to 30." } },
    },
  },
  {
    name: "get_goal_progress",
    description: "Progress toward the launch goal: monthly recurring revenue, paying clients, average per client, open pipeline.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_leads",
    description: "List leads, newest first. Filter by pipeline stage and/or service.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: { type: "string", enum: [...STAGES] },
        service: { type: "string", enum: ["AI_VOICE", "WEB_DEV", "UNASSIGNED"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "get_lead",
    description: "Full details of one lead by id, including its recent activity.",
    input_schema: { type: "object" as const, properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "update_lead_stage",
    description: "Move a lead to another pipeline stage. Logs the change on the lead.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string" }, stage: { type: "string", enum: [...STAGES] } },
      required: ["id", "stage"],
    },
  },
  {
    name: "add_lead_note",
    description: "Add an internal note to a lead. The note is never sent to the customer.",
    input_schema: {
      type: "object" as const,
      properties: { id: { type: "string" }, text: { type: "string", maxLength: 2000 } },
      required: ["id", "text"],
    },
  },
  {
    name: "list_connections",
    description: "Status of each connected channel and finance account (connected, error, not connected).",
    input_schema: { type: "object" as const, properties: {} },
  },
];

export type ToolName = (typeof AGENT_TOOLS)[number]["name"];

const LeadId = z.object({ id: z.string().min(1) });

const leadBrief = (l: { id: string; title: string; service: string; stage: string; estimatedValue: number; contact: { name: string } }) => ({
  id: l.id,
  title: l.title,
  contact: l.contact.name,
  service: l.service,
  stage: l.stage,
  estimatedValue: l.estimatedValue,
});

/** Runs one tool call and returns a JSON-safe result. Errors are returned to the model, not thrown. */
export async function runAgentTool(name: string, rawInput: unknown, userId: string): Promise<{ ok: boolean; result: unknown }> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  try {
    switch (name as ToolName) {
      case "get_business_snapshot": {
        const days = [7, 30, 90].includes(Number(input.range_days)) ? Number(input.range_days) : 30;
        const snap = await getAnalyticsSnapshot(days);
        return { ok: true, result: summarizeForAi(snap) };
      }
      case "get_goal_progress": {
        const g = await getGoalSnapshot();
        return { ok: true, result: { mrr: g.mrr, targetMrr: g.goals.targetMrr, activeClients: g.activeClients, targetClients: g.goals.targetClients, avgPerClient: g.avgPerClient, openPipeline: g.pipelineValue, openLeads: g.openLeads } };
      }
      case "list_leads": {
        const limit = Math.min(50, Math.max(1, Number(input.limit) || 15));
        const leads = await db.lead.findMany({
          where: {
            ...(input.stage ? { stage: String(input.stage) } : {}),
            ...(input.service ? { service: String(input.service) } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { contact: { select: { name: true } } },
        });
        return { ok: true, result: leads.map(leadBrief) };
      }
      case "get_lead": {
        const { id } = LeadId.parse(input);
        const lead = await db.lead.findUnique({
          where: { id },
          include: { contact: { select: { name: true } }, activities: { orderBy: { createdAt: "desc" }, take: 10 } },
        });
        if (!lead) return { ok: false, result: "Lead not found" };
        return {
          ok: true,
          result: {
            ...leadBrief(lead),
            source: lead.source,
            score: lead.score,
            aiSummary: lead.aiSummary,
            activities: lead.activities.map((a) => ({ type: a.type, text: a.text, at: a.createdAt })),
          },
        };
      }
      case "update_lead_stage": {
        const { id } = LeadId.parse(input);
        const stage = String(input.stage);
        if (!(STAGES as readonly string[]).includes(stage)) return { ok: false, result: `Unknown stage ${stage}` };
        const lead = await db.lead.findUnique({ where: { id }, select: { id: true, stage: true } });
        if (!lead) return { ok: false, result: "Lead not found" };
        await db.lead.update({ where: { id }, data: { stage } });
        await db.activity.create({ data: { leadId: id, userId, type: "STAGE", text: `Stage changed from ${lead.stage} to ${stage} by the command agent` } });
        return { ok: true, result: { id, stage } };
      }
      case "add_lead_note": {
        const { id } = LeadId.parse(input);
        const text = String(input.text ?? "").trim().slice(0, 2000);
        if (!text) return { ok: false, result: "Note is empty" };
        if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) return { ok: false, result: "Lead not found" };
        await db.activity.create({ data: { leadId: id, userId, type: "NOTE", text } });
        return { ok: true, result: { id, saved: true } };
      }
      case "list_connections": {
        const channels = await listChannels();
        return { ok: true, result: channels.map((c) => ({ name: c.name, status: c.status, lastError: c.lastError })) };
      }
      default:
        return { ok: false, result: `Unknown tool ${name}` };
    }
  } catch (err) {
    return { ok: false, result: err instanceof Error ? err.message : "Tool failed" };
  }
}
