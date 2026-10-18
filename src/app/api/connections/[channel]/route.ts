import { z } from "zod";
import { json, route } from "@/lib/api";
import { CHANNEL_IDS, disconnectChannel, saveChannel } from "@/lib/connections";

type Ctx = { params: Promise<{ channel: string }> };

const Channel = z.enum(CHANNEL_IDS as [string, ...string[]]);

/** Saves a channel's fields. Blank secret fields keep what is already stored. */
export const PUT = route<Ctx>(
  async (req, { params }) => {
    const channel = Channel.parse((await params).channel);
    const body = (await req.json()) as Record<string, unknown>;
    await saveChannel(channel as Parameters<typeof saveChannel>[0], body);
    return json({ ok: true });
  },
  { admin: true },
);

export const DELETE = route<Ctx>(
  async (_req, { params }) => {
    const channel = Channel.parse((await params).channel);
    await disconnectChannel(channel as Parameters<typeof disconnectChannel>[0]);
    return json({ ok: true });
  },
  { admin: true },
);
