export type Urgency = "interrupt" | "available";
export type AlertKind = "danger" | "advisory" | "all_clear";
export type AlertStatus = "active" | "resolved";
export type CheckOutcome = "match" | "contradict" | "unverified";
export type Channel = "sms" | "email" | "whatsapp";
export type DeliveryKind = "broadcast" | "follow_up";
export type AiEngine = "claude" | "gemini" | "fallback";

export interface TrustedVoice {
  id: string;
  name: string;
  role: string;
  phone: string;
}

export interface Area {
  id: string;
  name: string;
  /** Other ways people refer to this place: landmarks, junctions, nicknames. */
  aliases: string[];
  neighbours: string[];
  trustedVoiceId: string;
}

/**
 * A community member as a way to reach them, not a profile: a phone number
 * and/or email, and the roads that matter to them. No names. An account
 * (password) is optional and only lets them manage this from any device.
 */
export interface Subscriber {
  id: string;
  phone?: string;
  email?: string;
  /** WhatsApp id (international number, digits only) when they have messaged MaiGuard on WhatsApp. */
  whatsapp?: string;
  /** Roads the member lives on, travels through or has asked about; alerts for these reach them. */
  areaIds: string[];
  /** Present only for members who created an account. Never sent to clients. */
  passwordHash?: string;
  createdAt: string;
}

/** Each field of an alert is tied back to the words the trusted voice actually said. */
export interface Grounding {
  quote: string;
  grounded: boolean;
}

export interface AlertDraft {
  what: string;
  where: string;
  action: string;
  kind: AlertKind;
  areaIds: string[];
  urgency: Urgency;
  urgencyReason: string;
  grounding: { what: Grounding; where: Grounding; action: Grounding };
  engine: AiEngine;
}

export interface Alert {
  id: string;
  what: string;
  where: string;
  action: string;
  kind: AlertKind;
  areaIds: string[];
  urgency: Urgency;
  urgencyReason: string;
  status: AlertStatus;
  transcript: string;
  trustedVoiceId: string;
  createdAt: string;
  resolvedBy?: string;
}

export interface Delivery {
  id: string;
  subscriberId: string;
  channel: Channel;
  /** Phone number or email address the message went to. */
  to: string;
  body: string;
  kind: DeliveryKind;
  urgency: Urgency;
  alertId?: string;
  createdAt: string;
}

export interface Check {
  id: string;
  text: string;
  /** Who asked, so the follow-up can reach them. Never shown in trends. */
  subscriberId?: string;
  areaIds: string[];
  topic: string;
  outcome: CheckOutcome;
  alertId?: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  checkId: string;
  subscriberId: string;
  areaIds: string[];
  status: "pending" | "fulfilled";
  createdAt: string;
  fulfilledAt?: string;
}

export interface CheckResponse {
  checkId: string;
  outcome: CheckOutcome;
  headline: string;
  summary: string;
  alert?: Alert;
  known: string[];
  unknown: string[];
  guidance: string[];
  contact?: TrustedVoice & { areaName: string };
  /** When nothing is verified yet, the member is told how they will hear back. */
  followUp?: { promised: boolean; message: string };
  reason: string;
  engine: AiEngine;
}
