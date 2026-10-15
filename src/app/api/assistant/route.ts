import { json, route } from "@/lib/api";
import { AssistantInput, assistantReply } from "@/lib/assistant";

export const POST = route(async (req) => {
  const { messages } = AssistantInput.parse(await req.json());
  return json(await assistantReply(messages));
});
