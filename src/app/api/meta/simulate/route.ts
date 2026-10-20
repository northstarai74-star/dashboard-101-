import { z } from "zod";
import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { ingestComment, ingestLeadAd, ingestMessage } from "@/lib/ingest";
import { runAiAgent } from "@/lib/agent";

const Body = z.object({ type: z.enum(["dm", "comment", "leadad"]) });

const SAMPLES = {
  dm: [
    "Hi! We're a dental clinic missing lots of calls. Can your AI receptionist handle bookings? What's the price?",
    "Looking for a developer to build a new website for my bakery, budget ~$2,500.",
    "Do you offer a website redesign for my store? I want a quote.",
  ],
  comment: ["How much for an AI receptionist? 🙋", "Can you build a site like this for my salon?", "Where do you source those products?"],
  leadad: ["Need a landing page + Shopify store", "Interested in an AI voice agent demo for my law firm", "Want a booking system for my clinic website"],
};

/** Demo-mode helper: pushes a fake Meta event through the exact same ingestion pipeline the webhook uses. */
export const POST = route(async (req) => {
  const { type } = Body.parse(await req.json());
  const settings = await getSettings();
  if (!settings.demoMode) return json({ error: "Simulation is only available in demo mode" }, 400);

  const n = Math.floor(Math.random() * 3);
  const id = Math.random().toString(36).slice(2, 8);
  const names = ["Jordan Blake", "Sam Rivera", "Taylor Quinn", "Alex Morgan"];
  const name = names[Math.floor(Math.random() * names.length)];
  const handle = name.toLowerCase().replace(" ", "_") + id.slice(0, 2);

  if (type === "dm") {
    const r = await ingestMessage({ igUserId: "sim_" + id, name, handle, text: SAMPLES.dm[n], externalId: "sim_m_" + id });
    // Same as the webhook: if the new lead is routed to the AI agent, it answers.
    const agent = r ? await runAiAgent(r.conversationId) : null;
    return json({ ok: true, type, aiReplied: !!agent?.sent });
  }
  if (type === "comment") await ingestComment({ igUserId: "sim_" + id, handle, text: SAMPLES.comment[n], externalId: "sim_c_" + id, postRef: "reel_demo" });
  if (type === "leadad")
    await ingestLeadAd({ externalId: "sim_l_" + id, formName: "Free Consultation", name, email: `${handle}@example.com`, phone: "+1 555 010 " + Math.floor(1000 + Math.random() * 9000), message: SAMPLES.leadad[n] });

  return json({ ok: true, type });
}, { admin: true });
