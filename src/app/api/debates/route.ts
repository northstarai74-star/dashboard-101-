import { z } from "zod";
import { db } from "@/lib/db";
import { json, route } from "@/lib/api";
import { getAnalyticsSnapshot } from "@/lib/analytics";
import { askCouncil } from "@/lib/council";

const Body = z.object({ question: z.string().trim().min(10, "Describe the issue in a sentence or two").max(1000) });

export const GET = route(async () =>
  json(await db.debateResult.findMany({ orderBy: { createdAt: "desc" }, take: 20 })),
);

export const POST = route(async (req) => {
  const { question } = Body.parse(await req.json());
  const snapshot = await getAnalyticsSnapshot(30);
  const result = await askCouncil(question, snapshot);
  const saved = await db.debateResult.create({
    data: {
      question,
      mode: result.mode,
      verdict: result.verdict,
      actions: result.actions,
      advisors: result.advisors,
    },
  });
  return json(saved, 201);
});
