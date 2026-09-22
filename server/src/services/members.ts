import { store } from "../store.js";
import { maskEmail, maskPhone } from "../lib/text.js";
import type { Subscriber } from "../types.js";

/** How to describe a member's contact back to them, e.g. "+234 ••• ••• 0199 and a•••@example.com". */
export function contactLabel(s: Subscriber, masked = true): string {
  const parts = [
    s.phone && (masked ? maskPhone(s.phone) : s.phone),
    !s.phone && s.whatsapp && `WhatsApp ${masked ? maskPhone(s.whatsapp) : `+${s.whatsapp}`}`,
    s.email && (masked ? maskEmail(s.email) : s.email),
  ].filter(Boolean);
  return parts.join(" and ");
}

/** What a member sees about themselves: their own contact in full, never the password hash. */
export function selfView(s: Subscriber) {
  return {
    id: s.id,
    phone: s.phone ?? null,
    email: s.email ?? null,
    whatsapp: Boolean(s.whatsapp),
    areaIds: s.areaIds,
    hasAccount: Boolean(s.passwordHash),
  };
}

/** What a trusted voice sees about a member: masked contact and roads only. */
export function maskedView(s: Subscriber) {
  return {
    id: s.id,
    phone: s.phone ? maskPhone(s.phone) : null,
    email: s.email ? maskEmail(s.email) : null,
    whatsapp: Boolean(s.whatsapp),
    areaIds: s.areaIds,
    hasAccount: Boolean(s.passwordHash),
  };
}

export function messagesFor(s: Subscriber) {
  return store.deliveries.filter((d) => d.subscriberId === s.id);
}
