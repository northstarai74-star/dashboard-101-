import { json, route } from "@/lib/api";
import { MetricInput, upsertMetric } from "@/lib/analytics";

// Manual entry from the Analytics page. Replaces the value for that channel/metric/day.
export const POST = route(async (req) => {
  const input = MetricInput.parse({ ...(await req.json()), source: "manual" });
  const entry = await upsertMetric(input);
  return json(entry, 201);
});
