import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { areas, seedAlerts, seedSubscribers, trustedVoices } from "./data/seed.js";
import { normalizeEmail, normalizePhone } from "./lib/text.js";
import type { Alert, Area, Check, Delivery, FollowUp, Subscriber, TrustedVoice } from "./types.js";

export type StoreEvent =
  | { type: "alert"; alert: Alert }
  | { type: "delivery"; delivery: Delivery }
  | { type: "check"; check: Check }
  | { type: "subscriber" }
  | { type: "reset" };

/**
 * In-memory store. The verified alert list is the single source of truth:
 * only `publishAlert` writes to it, and only the trusted-voice route calls that.
 */
class Store {
  readonly events = new EventEmitter();
  alerts: Alert[] = [];
  deliveries: Delivery[] = [];
  checks: Check[] = [];
  followUps: FollowUp[] = [];
  subscribers: Subscriber[] = [];

  constructor() {
    this.events.setMaxListeners(100);
    this.reset();
  }

  reset() {
    this.alerts = seedAlerts();
    this.subscribers = seedSubscribers();
    this.deliveries = [];
    this.checks = [];
    this.followUps = [];
    this.emit({ type: "reset" });
  }

  emit(event: StoreEvent) {
    this.events.emit("event", event);
  }

  get areas(): Area[] {
    return areas;
  }
  get trustedVoices(): TrustedVoice[] {
    return trustedVoices;
  }

  area(id: string) {
    return areas.find((a) => a.id === id);
  }
  subscriber(id: string) {
    return this.subscribers.find((s) => s.id === id);
  }

  /** The member with this phone number or email, if any. */
  findSubscriber({ phone, email }: { phone?: string; email?: string }): Subscriber | undefined {
    const p = phone ? normalizePhone(phone) : undefined;
    const e = email ? normalizeEmail(email) : undefined;
    return this.subscribers.find(
      (s) => (p && ((s.phone && normalizePhone(s.phone) === p) || s.whatsapp === p)) || (e && s.email && normalizeEmail(s.email) === e),
    );
  }

  addSubscriber(sub: Omit<Subscriber, "id" | "createdAt">): Subscriber {
    const created: Subscriber = { ...sub, email: sub.email ? normalizeEmail(sub.email) : undefined, id: newId("s"), createdAt: now() };
    this.subscribers.push(created);
    this.emit({ type: "subscriber" });
    return created;
  }

  /** Merge roads into a member's alerts, e.g. the roads they just asked about. */
  addAreas(sub: Subscriber, areaIds: string[]) {
    const merged = [...new Set([...sub.areaIds, ...areaIds])];
    if (merged.length === sub.areaIds.length) return;
    sub.areaIds = merged;
    this.emit({ type: "subscriber" });
  }

  touchSubscriber() {
    this.emit({ type: "subscriber" });
  }
  trustedVoice(id: string) {
    return trustedVoices.find((t) => t.id === id);
  }
  alert(id: string) {
    return this.alerts.find((a) => a.id === id);
  }

  publishAlert(alert: Omit<Alert, "id" | "createdAt" | "status">): Alert {
    const saved: Alert = { ...alert, id: newId("a"), createdAt: now(), status: "active" };
    // A newer word from a trusted voice about the same place supersedes the old one.
    for (const old of this.alerts) {
      if (old.status === "active" && old.areaIds.some((id) => saved.areaIds.includes(id))) {
        old.status = "resolved";
        old.resolvedBy = saved.id;
      }
    }
    this.alerts.unshift(saved);
    this.emit({ type: "alert", alert: saved });
    return saved;
  }

  addDelivery(d: Omit<Delivery, "id" | "createdAt">): Delivery {
    const saved: Delivery = { ...d, id: newId("d"), createdAt: now() };
    this.deliveries.unshift(saved);
    this.emit({ type: "delivery", delivery: saved });
    return saved;
  }

  addCheck(c: Omit<Check, "id" | "createdAt">): Check {
    const saved: Check = { ...c, id: newId("c"), createdAt: now() };
    this.checks.unshift(saved);
    this.emit({ type: "check", check: saved });
    return saved;
  }

  addFollowUp(f: Omit<FollowUp, "id" | "createdAt" | "status">): FollowUp {
    const saved: FollowUp = { ...f, id: newId("f"), createdAt: now(), status: "pending" };
    this.followUps.push(saved);
    return saved;
  }
}

export const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;
export const now = () => new Date().toISOString();

export const store = new Store();
