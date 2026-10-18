import { z } from "zod";
import { json, route } from "@/lib/api";
import { CHANNEL_IDS, testChannel } from "@/lib/connections";

type Ctx = { params: Promise<{ channel: string }> };

/** Runs a live check against the provider and records the result on the connection. */
export const POST = route<Ctx>(
  async (_req, { params }) => {
    const channel = z.enum(CHANNEL_IDS as [string, ...string[]]).parse((await params).channel);
    return json(await testChannel(channel as Parameters<typeof testChannel>[0]));
  },
  { admin: true },
);
