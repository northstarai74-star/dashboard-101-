import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "./db";
import { decrypt } from "./crypto";
import { withKey, ProviderError } from "./keys";

export const GRAPH = "https://graph.facebook.com/v23.0";

export async function getConnection() {
  // A plain read in the common case. The upsert it replaced ran as a multi-statement transaction on every call.
  const existing = await db.metaConnection.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.metaConnection.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", verifyToken: "bos_" + randomBytes(12).toString("hex") },
    update: {},
  });
}

/** Constant-time string comparison (for webhook verify tokens). */
export function safeEqual(a: string | null, b: string) {
  if (a === null) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function graph(path: string, token: string, init?: RequestInit) {
  const url = `${GRAPH}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = body?.error?.code;
    // Graph uses code 4/17/32/613 for rate limits and 190 for an invalid token
    const status = [4, 17, 32, 613].includes(code) ? 429 : code === 190 ? 401 : res.status;
    throw new ProviderError(body?.error?.message ?? `Meta API error ${res.status}`, status);
  }
  return body;
}

/** Uses the connected page token if present, otherwise rotates across META keys in the vault. */
async function withMetaToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const conn = await getConnection();
  if (conn.accessTokenEnc) return fn(decrypt(conn.accessTokenEnc));
  return withKey("META", fn);
}

/** Sends a DM; the returned `message_id` matches the `mid` of the echo webhook Meta sends back. */
export async function sendInstagramMessage(recipientIgId: string, text: string): Promise<{ recipient_id?: string; message_id?: string }> {
  const conn = await getConnection();
  if (!conn.pageId) throw new Error("Meta page is not connected");
  return withMetaToken((token) =>
    graph(`/${conn.pageId}/messages`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientIgId }, message: { text }, messaging_type: "RESPONSE" }),
    }),
  );
}

export async function replyToComment(commentId: string, text: string) {
  return withMetaToken((token) =>
    graph(`/${commentId}/replies`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    }),
  );
}

export async function fetchLeadgen(leadgenId: string) {
  return withMetaToken((token) => graph(`/${leadgenId}?fields=field_data,created_time,form_id`, token)) as Promise<{
    field_data?: { name: string; values: string[] }[];
    created_time?: string;
    form_id?: string;
  }>;
}

/** Lead forms only carry an ID in the leadgen payload; this looks up the human-readable name. */
export async function fetchFormName(formId: string) {
  const form = (await withMetaToken((token) => graph(`/${formId}?fields=name`, token))) as { name?: string };
  return form.name;
}

export async function fetchProfile(igScopedId: string) {
  return withMetaToken((token) => graph(`/${igScopedId}?fields=name,username`, token)) as Promise<{
    name?: string;
    username?: string;
  }>;
}

type GraphConversation = {
  id: string;
  participants?: { data: { id: string; username?: string; name?: string }[] };
  messages?: { data: { id: string; message?: string; created_time: string; from: { id: string } }[] };
};

/** Pulls recent Instagram DM threads for the connected page (backfill / manual "Sync now"). */
export async function fetchRecentConversations(): Promise<GraphConversation[]> {
  const conn = await getConnection();
  if (!conn.pageId) throw new Error("Add your Facebook Page ID first");
  const res = await withMetaToken((token) =>
    graph(`/${conn.pageId}/conversations?platform=instagram&limit=25&fields=participants,messages.limit(10){id,message,created_time,from}`, token),
  );
  return res.data ?? [];
}

/** Validates a token and returns the account it belongs to (used by the "Test" button). */
export async function testToken(token: string) {
  return graph("/me?fields=id,name", token) as Promise<{ id: string; name: string }>;
}
