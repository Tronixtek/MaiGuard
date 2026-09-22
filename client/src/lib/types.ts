// Mirrors server/src/types.ts: the shapes the API returns.
export type Urgency = "interrupt" | "available";
export type AlertKind = "danger" | "advisory" | "all_clear";
export type CheckOutcome = "match" | "contradict" | "unverified";
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
  aliases: string[];
  neighbours: string[];
  trustedVoiceId: string;
}

/** A community member as a way to reach them: phone and/or email, and roads. No names. */
export interface Subscriber {
  id: string;
  /** Masked when a trusted voice or a quick-path session is looking. */
  phone: string | null;
  email: string | null;
  /** Has messaged MaiGuard on WhatsApp. */
  whatsapp: boolean;
  areaIds: string[];
  hasAccount: boolean;
}

/** The signed-in member's own view of themselves. */
export type Member = Subscriber;

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
  status: "active" | "resolved";
  transcript: string;
  trustedVoiceId: string;
  createdAt: string;
  resolvedBy?: string;
}

export interface Delivery {
  id: string;
  subscriberId: string;
  channel: "sms" | "email" | "whatsapp";
  to: string;
  body: string;
  kind: "broadcast" | "follow_up";
  urgency: Urgency;
  alertId?: string;
  createdAt: string;
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
  followUp?: { promised: boolean; message: string };
  reason: string;
  engine: AiEngine;
}

export interface Trend {
  key: string;
  areaId: string | null;
  areaName: string;
  topic: string;
  topicLabel: string;
  count: number;
  unverifiedCount: number;
  latestText: string;
  latestAt: string;
  needsAnswer: boolean;
}

export interface Meta {
  town: string;
  timeZone: string;
  clock: string;
  engine: AiEngine;
  model: string | null;
  areas: Area[];
  trustedVoices: TrustedVoice[];
}

export interface PublishResult {
  alert: Alert;
  recipients: number;
  followUpsKept: number;
}
