import { callApi, channelCredentials, telegram } from "./connections";

/** Sends a WhatsApp text through the Cloud API. Free-form text only works inside WhatsApp's 24-hour reply window. */
export async function sendWhatsApp(phone: string, text: string): Promise<string | undefined> {
  const creds = await channelCredentials("WHATSAPP");
  if (!creds.phoneNumberId || !creds.accessToken) throw new Error("Connect WhatsApp on the Integrations page first");
  const to = phone.replace(/\D/g, "");
  if (!to) throw new Error("This contact has no phone number to message");
  const data = await callApi(`https://graph.facebook.com/v21.0/${encodeURIComponent(creds.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  return (data.messages as { id?: string }[] | undefined)?.[0]?.id;
}

/** Sends a Telegram message to a chat. Returns an id unique across chats (message ids repeat per chat). */
export async function sendTelegram(chatId: string, text: string): Promise<string | undefined> {
  const creds = await channelCredentials("TELEGRAM");
  if (!creds.botToken) throw new Error("Connect Telegram on the Integrations page first");
  const data = await telegram(creds.botToken, "sendMessage", { chat_id: chatId, text });
  const id = (data.result as { message_id?: number } | undefined)?.message_id;
  return id === undefined ? undefined : `${chatId}:${id}`;
}
