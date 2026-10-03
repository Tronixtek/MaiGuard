import { store } from "../store.js";
import { clockTime } from "../lib/text.js";
import { translateAlert } from "../ai/translate.js";
import type { Language } from "../lib/languages.js";
import type { Alert, AlertKind, Delivery, Subscriber } from "../types.js";
import { sendWhatsAppText } from "./whatsapp.js";
import { sendEmail } from "./email.js";
import { sendSms } from "./sms.js";

const KIND_LABEL: Record<AlertKind, string> = { danger: "ALERT", advisory: "NOTICE", all_clear: "ALL CLEAR" };

/** The alert as one message, in the reader's language when a translation exists. */
export function smsBody(alert: Alert, language: Language = "en"): string {
  const voice = store.trustedVoice(alert.trustedVoiceId);
  const t = language === alert.language ? alert : alert.translations?.[language] ?? alert;
  const lines = [`MaiGuard ${KIND_LABEL[alert.kind]} · ${t.where}`, t.what];
  if (t.action) lines.push(`WHAT TO DO: ${t.action}`);
  lines.push(`Verified by ${voice?.name ?? "a trusted voice"}${voice ? `, ${voice.role}` : ""} · ${clockTime(alert.createdAt)}`);
  return lines.join("\n");
}

/**
 * Send one message to every channel a member has given us. Each channel is sent
 * for real once it is configured (SMS provider, SMTP, WhatsApp) and always
 * recorded in the delivery log.
 */
function deliverTo(sub: Subscriber, msg: Pick<Delivery, "body" | "kind" | "urgency" | "alertId">) {
  // Seeded demo contacts are invented numbers and addresses: log them, never send.
  const send = !sub.simulated;
  if (sub.phone) {
    store.addDelivery({ ...msg, subscriberId: sub.id, channel: "sms", to: sub.phone });
    if (send) void sendSms(sub.phone, msg.body);
  }
  if (sub.email) {
    store.addDelivery({ ...msg, subscriberId: sub.id, channel: "email", to: sub.email });
    // The first line of the message ("MaiGuard ALERT · Old Bridge Road") doubles as the subject.
    const [subject = "MaiGuard alert", ...rest] = msg.body.split("\n");
    if (send) void sendEmail(sub.email, subject.replace(/:$/, ""), rest.join("\n"));
  }
  if (sub.whatsapp) {
    store.addDelivery({ ...msg, subscriberId: sub.id, channel: "whatsapp", to: `+${sub.whatsapp}` });
    if (send) void sendWhatsAppText(sub.whatsapp, msg.body);
  }
}

export type PublishInput = Omit<Alert, "id" | "createdAt" | "status" | "resolvedBy">;

/**
 * Publish a confirmed alert to the verified store, deliver it to everyone
 * linked to the affected areas, and keep any follow-up promises for those areas.
 */
export async function publishAndDeliver(input: PublishInput) {
  // Translate first, so everyone is reached in their own language in one go.
  const translations = await translateAlert(input, input.language ?? "en");
  const alert = store.publishAlert({ ...input, translations });

  const recipients = store.subscribers.filter((s) => s.areaIds.some((id) => alert.areaIds.includes(id)));
  for (const s of recipients) {
    deliverTo(s, { body: smsBody(alert, s.language ?? "en"), kind: "broadcast", urgency: alert.urgency, alertId: alert.id });
  }

  let followUpsKept = 0;
  for (const f of store.followUps) {
    if (f.status !== "pending" || !f.areaIds.some((id) => alert.areaIds.includes(id))) continue;
    const s = store.subscriber(f.subscriberId);
    if (!s) continue;
    const check = store.checks.find((c) => c.id === f.checkId);
    deliverTo(s, {
      body: `MaiGuard UPDATE on what you asked about${check ? ` ("${truncate(check.text, 60)}")` : ""}:\n${smsBody(alert, s.language ?? "en")}`,
      kind: "follow_up",
      urgency: alert.urgency,
      alertId: alert.id,
    });
    f.status = "fulfilled";
    f.fulfilledAt = new Date().toISOString();
    followUpsKept++;
  }

  return { alert, recipients: recipients.length, followUpsKept };
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
