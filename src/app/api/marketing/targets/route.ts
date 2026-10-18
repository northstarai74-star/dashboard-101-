import { json, route } from "@/lib/api";
import { TargetInput, setLeadTarget } from "@/lib/marketing";

/** Sets the new-lead target for one month. Admins only, to match the other planning settings. */
export const PUT = route(
  async (req) => {
    const b = TargetInput.parse(await req.json());
    const targets = await setLeadTarget(b.month, b.target);
    return json({ targets });
  },
  { admin: true },
);
