import { z } from "zod";
import { json, route } from "@/lib/api";
import { getAnalyticsSnapshot } from "@/lib/analytics";
import { askCouncil } from "@/lib/council";

const Body = z.object({ question: z.string().trim().max(1000).default("") });

export const POST = route(async (req) => {
  const { question } = Body.parse(await req.json());
  const snapshot = await getAnalyticsSnapshot(30);
  return json(await askCouncil(question, snapshot));
});
