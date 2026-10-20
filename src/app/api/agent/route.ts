import { json, route } from "@/lib/api";
import { CommandInput, runCommand } from "@/lib/command-agent";

export const POST = route(async (req, _ctx, user) => {
  const input = CommandInput.parse(await req.json());
  return json(await runCommand(input, user.id));
}, { admin: true });
