import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { getConnection } from "./meta";

export type ChannelId = "WHATSAPP" | "TELEGRAM" | "INSTAGRAM" | "LINKEDIN" | "YOUTUBE" | "EMAIL" | "MAILCHIMP" | "HUBSPOT" | "META_ADS" | "WEBSITE" | "FINANCE";

import { GROUPS, type GroupId } from "./connections-groups";

export { GROUPS };
export type { GroupId };

type Field = { key: string; label: string; secret?: boolean; required?: boolean; placeholder?: string; help?: string };

type ChannelDef = {
  id: ChannelId;
  group: GroupId;
  name: string;
  blurb: string;
  color: string;
  fields: Field[];
  /** Instagram is configured on the Integrations page (Meta) and only reported here. */
  managedBy?: "meta";
  /** Path (on this app) the provider must be pointed at, shown on the card so it can be copied. */
  webhookPath?: string;
  /** Calls the provider with the saved credentials; returns a short account label or throws. */
  test?: (cfg: Record<string, string>) => Promise<string>;
  /** Runs after a successful test (e.g. registering a webhook). Returns a note for the user; failures never fail the test. */
  setup?: (cfg: Record<string, string>) => Promise<string | void>;
};

/** Reads a provider error body (each API nests its message differently). */
function errorText(data: unknown, status: number) {
  const d = data as { error?: unknown; message?: unknown } | null;
  const e = d?.error;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  if (typeof d?.message === "string") return d.message;
  return `Provider responded with HTTP ${status}`;
}

export async function callApi(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorText(data, res.status));
  return data as Record<string, unknown>;
}

/** Telegram Bot API call. Errors come back as `{ ok: false, description }`. */
export async function telegram(token: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: unknown };
  if (!res.ok || !data.ok) throw new Error(data.description ?? `Telegram responded with HTTP ${res.status}`);
  return data;
}

export const CHANNELS: ChannelDef[] = [
  {
    id: "WHATSAPP",
    group: "MESSAGING",
    name: "WhatsApp Business",
    blurb: "WhatsApp Cloud API. Lets the agent send and receive WhatsApp messages from your business number.",
    color: "bg-emerald-500",
    webhookPath: "/api/whatsapp/webhook",
    fields: [
      { key: "phoneNumberId", label: "Phone number ID", required: true, help: "From Meta → WhatsApp → API Setup." },
      { key: "businessAccountId", label: "WhatsApp Business Account ID" },
      { key: "accessToken", label: "Permanent access token", secret: true, required: true },
      { key: "verifyToken", label: "Webhook verify token", secret: true, help: "Any string you choose; paste the same value in Meta's webhook settings." },
      { key: "appSecret", label: "App secret", secret: true, help: "From your Meta app's Basic settings. Used to verify incoming messages." },
    ],
    test: async (cfg) => {
      const data = await callApi(`https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${cfg.accessToken}` },
      });
      return `${data.verified_name ?? "WhatsApp"} · ${data.display_phone_number ?? cfg.phoneNumberId}`;
    },
  },
  {
    id: "TELEGRAM",
    group: "MESSAGING",
    name: "Telegram",
    blurb: "A Telegram bot. People who message it appear in the Inbox and you can reply from there.",
    color: "bg-sky-500",
    webhookPath: "/api/telegram/webhook",
    fields: [
      { key: "botToken", label: "Bot token", secret: true, required: true, help: "From @BotFather after /newbot." },
      { key: "webhookSecret", label: "Webhook secret", secret: true, required: true, placeholder: "letters, numbers, _ and -", help: "Any string of 1-256 letters, numbers, _ or -. Telegram sends it with every message so only Telegram can post to this app." },
    ],
    test: async (cfg) => {
      const data = await telegram(cfg.botToken, "getMe");
      const me = data.result as { username?: string; first_name?: string };
      return `@${me.username ?? me.first_name ?? "bot"}`;
    },
    setup: async (cfg) => {
      const base = process.env.APP_URL ?? "";
      if (!base.startsWith("https://")) return "Webhook not registered: set APP_URL to your public https address, then Save and test again.";
      await telegram(cfg.botToken, "setWebhook", { url: `${base.replace(/\/$/, "")}/api/telegram/webhook`, secret_token: cfg.webhookSecret, allowed_updates: ["message"] });
      return "Webhook registered with Telegram.";
    },
  },
  {
    id: "INSTAGRAM",
    group: "MESSAGING",
    name: "Instagram",
    blurb: "Direct messages, comments and lead ads. Connected through the Meta app on the Integrations page.",
    color: "bg-pink-500",
    fields: [],
    managedBy: "meta",
  },
  {
    id: "LINKEDIN",
    group: "SOCIAL",
    name: "LinkedIn",
    blurb: "Read the connected member or company page. Paste an access token from a LinkedIn app with the OpenID scopes.",
    color: "bg-sky-600",
    webhookPath: "/api/inquiries/ingest",
    fields: [
      { key: "accessToken", label: "Access token", secret: true, required: true },
      { key: "organizationId", label: "Company page ID (optional)", help: "Numeric ID of the company page you post for." },
      { key: "ingestToken", label: "Inquiry ingest token", secret: true, help: "Any long random string. Your LinkedIn automation sends it as a Bearer token to POST /api/inquiries/ingest." },
    ],
    test: async (cfg) => {
      const data = await callApi("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
      return String(data.name ?? data.email ?? "LinkedIn account");
    },
  },
  {
    id: "YOUTUBE",
    group: "SOCIAL",
    name: "YouTube",
    blurb: "Channel details and public stats via the YouTube Data API.",
    color: "bg-red-600",
    fields: [
      { key: "apiKey", label: "YouTube Data API key", secret: true, required: true },
      { key: "channelId", label: "Channel ID", required: true, placeholder: "UCxxxxxxxxxxxxxxxxxxxxxx" },
    ],
    test: async (cfg) => {
      const params = new URLSearchParams({ part: "snippet", id: cfg.channelId, key: cfg.apiKey });
      const data = await callApi(`https://www.googleapis.com/youtube/v3/channels?${params}`);
      const items = data.items as { snippet?: { title?: string } }[] | undefined;
      const title = items?.[0]?.snippet?.title;
      if (!title) throw new Error("No YouTube channel found for that channel ID");
      return title;
    },
  },
  {
    id: "EMAIL",
    group: "MARKETING",
    name: "Email (Brevo)",
    blurb: "Brevo (formerly Sendinblue) for email campaigns and transactional sends.",
    color: "bg-blue-600",
    fields: [
      { key: "apiKey", label: "Brevo API key (v3)", secret: true, required: true, help: "From Brevo → SMTP & API → API keys." },
      { key: "senderEmail", label: "Sender email", required: true, placeholder: "hello@yourbusiness.com" },
    ],
    test: async (cfg) => {
      const data = await callApi("https://api.brevo.com/v3/account", { headers: { "api-key": cfg.apiKey, Accept: "application/json" } });
      const company = (data.companyName as string | undefined) ?? (data.email as string | undefined) ?? "Brevo account";
      return `${company} · ${cfg.senderEmail}`;
    },
  },
  {
    id: "MAILCHIMP",
    group: "MARKETING",
    name: "Mailchimp",
    blurb: "Audiences and email campaigns. The API key ends with your data centre, e.g. -us21.",
    color: "bg-yellow-500",
    fields: [{ key: "apiKey", label: "Mailchimp API key", secret: true, required: true, placeholder: "xxxxxxxxxxxxxxxx-us21", help: "From Mailchimp > Profile > Extras > API keys." }],
    test: async (cfg) => {
      const dc = cfg.apiKey.split("-")[1];
      if (!dc || !/^[a-z0-9]+$/i.test(dc)) throw new Error("That doesn't look like a Mailchimp key: it should end with a dash and a data centre such as -us21");
      const data = await callApi(`https://${dc}.api.mailchimp.com/3.0/?fields=account_name,email`, {
        headers: { Authorization: `Basic ${Buffer.from(`bos:${cfg.apiKey}`).toString("base64")}` },
      });
      return String(data.account_name ?? data.email ?? "Mailchimp account");
    },
  },
  {
    id: "HUBSPOT",
    group: "MARKETING",
    name: "HubSpot",
    blurb: "CRM, forms and marketing email. Use a private app token with read access to contacts.",
    color: "bg-orange-500",
    fields: [{ key: "accessToken", label: "Private app access token", secret: true, required: true, placeholder: "pat-...", help: "From HubSpot > Settings > Integrations > Private apps." }],
    test: async (cfg) => {
      const data = await callApi("https://api.hubapi.com/account-info/v3/details", { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
      return `HubSpot portal ${data.portalId ?? ""}`.trim();
    },
  },
  {
    id: "META_ADS",
    group: "MARKETING",
    name: "Meta Ads",
    blurb: "Facebook and Instagram ad account, for spend and results. Needs a token with the ads_read permission.",
    color: "bg-blue-600",
    fields: [
      { key: "adAccountId", label: "Ad account ID", required: true, placeholder: "act_1234567890", help: "From Meta Ads Manager. The act_ prefix is optional." },
      { key: "accessToken", label: "Access token (ads_read)", secret: true, required: true },
    ],
    test: async (cfg) => {
      const id = cfg.adAccountId.replace(/^act_/i, "").trim();
      if (!/^\d+$/.test(id)) throw new Error("The ad account ID should be numbers only (with an optional act_ prefix)");
      const data = await callApi(`https://graph.facebook.com/v21.0/act_${id}?fields=name,currency,account_status`, {
        headers: { Authorization: `Bearer ${cfg.accessToken}` },
      });
      if (data.account_status !== undefined && data.account_status !== 1) throw new Error(`Ad account "${data.name ?? id}" is not active (status ${data.account_status})`);
      return `${data.name ?? `Ad account ${id}`} · ${data.currency ?? ""}`.trim();
    },
  },
  {
    id: "WEBSITE",
    group: "EMAIL_WEB",
    name: "Website",
    blurb: "Your public site. The check confirms it is reachable; forms and tracking are added per site.",
    color: "bg-violet-500",
    fields: [{ key: "siteUrl", label: "Site URL", required: true, placeholder: "https://yourbusiness.com" }],
    test: async (cfg) => {
      const url = new URL(cfg.siteUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Site URL must start with http:// or https://");
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Site responded with HTTP ${res.status}`);
      return url.hostname;
    },
  },
  {
    id: "FINANCE",
    group: "FINANCE",
    name: "Finance (Stripe)",
    blurb: "Stripe balance and payments, used by the Analytics and Finance views. Read-only key recommended.",
    color: "bg-indigo-600",
    fields: [{ key: "secretKey", label: "Stripe secret key", secret: true, required: true, placeholder: "sk_live_… or rk_live_…" }],
    test: async (cfg) => {
      const auth = `Basic ${Buffer.from(`${cfg.secretKey}:`).toString("base64")}`;
      const data = await callApi("https://api.stripe.com/v1/balance", { headers: { Authorization: auth } });
      return data.livemode ? "Stripe · live account" : "Stripe · test account";
    },
  },
];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id);

export function channelDef(id: string) {
  return CHANNELS.find((c) => c.id === id);
}

export type ChannelState = {
  id: ChannelId;
  group: GroupId;
  name: string;
  blurb: string;
  color: string;
  managedBy: string | null;
  webhookPath: string | null;
  fields: Field[];
  config: Record<string, string>;
  hasSecret: Record<string, boolean>;
  status: "NOT_CONNECTED" | "CONNECTED" | "ERROR";
  accountLabel: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

function readSecrets(enc: string | null): Record<string, string> {
  if (!enc) return {};
  try {
    return JSON.parse(decrypt(enc)) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Everything the Connections page needs. Secret values are never returned, only whether they are saved. */
export async function listChannels(): Promise<ChannelState[]> {
  const [rows, meta] = await Promise.all([db.connection.findMany(), getConnection()]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  return CHANNELS.map((def): ChannelState => {
    if (def.managedBy === "meta") {
      return {
        id: def.id, group: def.group, name: def.name, blurb: def.blurb, color: def.color, managedBy: "meta", webhookPath: null, fields: [], config: {}, hasSecret: {},
        status: meta.connected ? "CONNECTED" : "NOT_CONNECTED",
        accountLabel: meta.pageId ? `Page ${meta.pageId}` : null,
        lastCheckedAt: meta.lastSyncAt?.toISOString() ?? null,
        lastError: null,
      };
    }
    const row = byId.get(def.id);
    const secrets = readSecrets(row?.secretsEnc ?? null);
    return {
      id: def.id, group: def.group, name: def.name, blurb: def.blurb, color: def.color, managedBy: null, webhookPath: def.webhookPath ?? null, fields: def.fields,
      config: row ? (JSON.parse(row.config) as Record<string, string>) : {},
      hasSecret: Object.fromEntries(def.fields.filter((f) => f.secret).map((f) => [f.key, Boolean(secrets[f.key])])),
      status: (row?.status as ChannelState["status"]) ?? "NOT_CONNECTED",
      accountLabel: row?.accountLabel ?? null,
      lastCheckedAt: row?.lastCheckedAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
    };
  });
}

/** Saves fields for a channel. Blank secret fields keep the stored value. Status resets until the next test. */
export async function saveChannel(id: ChannelId, input: Record<string, unknown>) {
  const def = channelDef(id);
  if (!def || def.managedBy) throw new Error("This channel can't be configured here");

  const existing = await db.connection.findUnique({ where: { id } });
  const config = existing ? (JSON.parse(existing.config) as Record<string, string>) : {};
  const secrets = readSecrets(existing?.secretsEnc ?? null);

  for (const f of def.fields) {
    const raw = typeof input[f.key] === "string" ? (input[f.key] as string).trim() : "";
    if (f.secret) {
      if (raw) secrets[f.key] = raw;
    } else {
      config[f.key] = raw;
    }
  }

  const missing = def.fields.filter((f) => f.required && !(f.secret ? secrets[f.key] : config[f.key]));
  if (missing.length) throw new Error(`Missing: ${missing.map((f) => f.label).join(", ")}`);

  await db.connection.upsert({
    where: { id },
    create: { id, config: JSON.stringify(config), secretsEnc: encrypt(JSON.stringify(secrets)), status: "NOT_CONNECTED" },
    update: { config: JSON.stringify(config), secretsEnc: encrypt(JSON.stringify(secrets)), status: "NOT_CONNECTED", lastError: null },
  });
}

/** Calls the provider with the saved credentials and records the result. */
export async function testChannel(id: ChannelId): Promise<{ ok: boolean; detail: string }> {
  const def = channelDef(id);
  if (!def || def.managedBy) throw new Error("This channel can't be tested here");
  const row = await db.connection.findUnique({ where: { id } });
  if (!row) throw new Error("Save the connection details first");

  const cfg = { ...(JSON.parse(row.config) as Record<string, string>), ...readSecrets(row.secretsEnc) };
  try {
    const label = await def.test!(cfg);
    await db.connection.update({
      where: { id },
      data: { status: "CONNECTED", accountLabel: label, lastError: null, lastCheckedAt: new Date() },
    });
    let note = "";
    if (def.setup) {
      try {
        note = (await def.setup(cfg)) ?? "";
      } catch (err) {
        note = `The webhook setup failed: ${err instanceof Error ? err.message : "unknown error"}`;
      }
    }
    return { ok: true, detail: `Connected: ${label}${note ? `. ${note}` : ""}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test failed";
    await db.connection.update({
      where: { id },
      data: { status: "ERROR", lastError: message.slice(0, 300), lastCheckedAt: new Date() },
    });
    return { ok: false, detail: message };
  }
}

/** Saved non-secret and secret values for a channel, for server-side use (webhooks, automations). */
export async function channelCredentials(id: ChannelId): Promise<Record<string, string>> {
  const row = await db.connection.findUnique({ where: { id } });
  if (!row) return {};
  return { ...(JSON.parse(row.config) as Record<string, string>), ...readSecrets(row.secretsEnc) };
}

export async function disconnectChannel(id: ChannelId) {
  const def = channelDef(id);
  if (!def || def.managedBy) throw new Error("This channel can't be disconnected here");
  await db.connection.deleteMany({ where: { id } });
}
