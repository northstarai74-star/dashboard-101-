import { json, route } from "@/lib/api";
import { listChannels } from "@/lib/connections";

// Read-only for every signed-in user. Secrets are never included in the response.
export const GET = route(async () => json(await listChannels()));
