import { createHmac, timingSafeEqual } from "node:crypto";
import { store } from "../store.js";
import { clockTime } from "../lib/text.js";
import type { CheckResponse } from "../types.js";

/**
 * WhatsApp via Meta's WhatsApp Business Platform (Cloud API).
 * Residents forward a rumour to MaiGuard's WhatsApp number and get the same
 * honest check as on the web, in the chat. Their WhatsApp number becomes their
 * contact, so follow-ups and alerts for the roads they asked about come back there.
 *
 * Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
 * optionally WHATSAPP_APP_SECRET (verifies Meta's signature) and WHATSAPP_API_VERSION.
 */
const config = () => ({
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  version: process.env.WHATSAPP_API_VERSION || "v23.0",
});

export const whatsappEnabled = () => Boolean(config().token && config().phoneNumberId);

export function verifySubscription(mode: unknown, token: unknown): boolean {
  const { verifyToken } = config();
  return mode === "subscribe" && Boolean(verifyToken) && token === verifyToken;
}

/** Meta signs each webhook with the app secret. Skipped only when no secret is configured. */
export function verifySignature(rawBody: Buffer | undefined, header: string | undefined): boolean {
  const { appSecret } = config();
  if (!appSecret) return true;
  if (!rawBody || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const { token, phoneNumberId, version } = config();
  if (!token || !phoneNumberId) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: body.slice(0, 4000) } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.warn(`[whatsapp] send failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.ok;
  } catch (err) {
    console.warn(`[whatsapp] send failed: ${(err as Error).message}`);
    return false;
  }
}

const GREETING = /^\s*(hi|hello|hey|hallo|good (morning|afternoon|evening)|start|help|menu|sannu|bawo|ndewo)\b[\s!.]*$/i;

export const WELCOME = [
  "*MaiGuard* · verified community alerts",
  "",
  "Heard something and not sure it's true? Forward the message here, or type what you heard and where.",
  "",
  "We compare it with what trusted local people have confirmed and tell you honestly: *confirmed*, *not true*, or *nothing verified yet*.",
].join("\n");

/** The web answer, rewritten for a chat. WhatsApp supports *bold* and _italics_. */
export function formatReply(r: CheckResponse): string {
  const lines: string[] = [];
  if (r.outcome === "match" && r.alert) {
    lines.push("✅ *Confirmed*", r.alert.what);
  } else if (r.outcome === "contradict" && r.alert) {
    lines.push("❌ *Not true as told*", `Latest verified word: ${r.alert.what}`);
  } else {
    lines.push("⚠️ *Nothing verified yet*", r.summary);
    if (r.known.length) lines.push("", "*What is known*", ...r.known.map((k) => `• ${k}`));
  }
  if (r.guidance.length) lines.push("", "*What to do*", ...r.guidance.map((g) => `• ${g}`));
  if (r.alert) {
    const voice = store.trustedVoice(r.alert.trustedVoiceId);
    lines.push("", `_Verified by ${voice?.name ?? "a trusted voice"}${voice ? `, ${voice.role}` : ""} · ${clockTime(r.alert.createdAt)}_`);
  }
  if (r.contact && r.outcome === "unverified") lines.push("", `*Ask:* ${r.contact.name} (${r.contact.role}) · ${r.contact.phone}`);
  if (r.followUp?.promised) {
    const place = r.contact?.areaName ?? "this";
    lines.push("", `We'll message you here as soon as a trusted voice says anything about ${place}.`);
  } else if (r.followUp) {
    lines.push("", r.followUp.message);
  }
  return lines.join("\n");
}

/** Meta retries deliveries; remember recent message ids so each is answered once. */
const seen = new Set<string>();
const remember = (id: string) => {
  seen.add(id);
  if (seen.size > 2000) seen.delete(seen.values().next().value!);
};

interface InboundMessage {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
}

/** Pull the messages out of a webhook payload (entry[].changes[].value.messages[]). */
export function extractMessages(payload: unknown): InboundMessage[] {
  const entries = (payload as { entry?: { changes?: { value?: { messages?: InboundMessage[] } }[] }[] })?.entry ?? [];
  return entries.flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);
}

/** Answer one incoming message. `check` is injected so this stays free of the AI imports in tests. */
export async function handleMessage(
  msg: InboundMessage,
  check: (text: string, member: ReturnType<typeof store.addSubscriber>) => Promise<CheckResponse>,
): Promise<string | undefined> {
  if (!msg.id || seen.has(msg.id)) return undefined;
  remember(msg.id);

  const waId = msg.from.replace(/\D/g, "");
  let member = store.findSubscriber({ phone: waId });
  if (member) {
    if (!member.whatsapp) {
      member.whatsapp = waId;
      store.touchSubscriber();
    }
  } else {
    member = store.addSubscriber({ whatsapp: waId, areaIds: [] });
  }

  let reply: string;
  const text = msg.type === "text" ? msg.text?.body?.trim() ?? "" : "";
  if (msg.type !== "text") {
    reply = "Please send the rumour as a text message (you can forward it, or type what you heard and where). Voice notes and photos aren't supported yet.";
  } else if (!text || GREETING.test(text)) {
    reply = WELCOME;
  } else {
    reply = formatReply(await check(text, member));
  }
  await sendWhatsAppText(waId, reply);
  return reply;
}
