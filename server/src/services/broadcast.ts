import { store } from "../store.js";
import { clockTime } from "../lib/text.js";
import type { Alert, AlertKind, Delivery, Subscriber } from "../types.js";
import { sendWhatsAppText } from "./whatsapp.js";
import { sendEmail } from "./email.js";

const KIND_LABEL: Record<AlertKind, string> = { danger: "ALERT", advisory: "NOTICE", all_clear: "ALL CLEAR" };

export function smsBody(alert: Alert): string {
  const voice = store.trustedVoice(alert.trustedVoiceId);
  const lines = [`MaiGuard ${KIND_LABEL[alert.kind]} · ${alert.where}`, alert.what];
  if (alert.action) lines.push(`WHAT TO DO: ${alert.action}`);
  lines.push(`Verified by ${voice?.name ?? "a trusted voice"}${voice ? `, ${voice.role}` : ""} · ${clockTime(alert.createdAt)}`);
  return lines.join("\n");
}

/**
 * Send one message to every channel a member has given us. SMS is simulated in
 * this prototype; email (SMTP) and WhatsApp are sent for real when configured.
 */
function deliverTo(sub: Subscriber, msg: Pick<Delivery, "body" | "kind" | "urgency" | "alertId">) {
  if (sub.phone) store.addDelivery({ ...msg, subscriberId: sub.id, channel: "sms", to: sub.phone });
  if (sub.email) {
    store.addDelivery({ ...msg, subscriberId: sub.id, channel: "email", to: sub.email });
    // The first line of the message ("MaiGuard ALERT · Old Bridge Road") doubles as the subject.
    const [subject = "MaiGuard alert", ...rest] = msg.body.split("\n");
    void sendEmail(sub.email, subject.replace(/:$/, ""), rest.join("\n"));
  }
  if (sub.whatsapp) {
    store.addDelivery({ ...msg, subscriberId: sub.id, channel: "whatsapp", to: `+${sub.whatsapp}` });
    void sendWhatsAppText(sub.whatsapp, msg.body);
  }
}

export type PublishInput = Omit<Alert, "id" | "createdAt" | "status" | "resolvedBy">;

/**
 * Publish a confirmed alert to the verified store, deliver it to everyone
 * linked to the affected areas, and keep any follow-up promises for those areas.
 */
export function publishAndDeliver(input: PublishInput) {
  const alert = store.publishAlert(input);
  const body = smsBody(alert);

  const recipients = store.subscribers.filter((s) => s.areaIds.some((id) => alert.areaIds.includes(id)));
  for (const s of recipients) {
    deliverTo(s, { body, kind: "broadcast", urgency: alert.urgency, alertId: alert.id });
  }

  let followUpsKept = 0;
  for (const f of store.followUps) {
    if (f.status !== "pending" || !f.areaIds.some((id) => alert.areaIds.includes(id))) continue;
    const s = store.subscriber(f.subscriberId);
    if (!s) continue;
    const check = store.checks.find((c) => c.id === f.checkId);
    deliverTo(s, {
      body: `MaiGuard UPDATE on what you asked about${check ? ` ("${truncate(check.text, 60)}")` : ""}:\n${body}`,
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
