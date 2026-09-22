import type { Alert, AlertDraft, CheckResponse, Delivery, Member, Meta, PublishResult, Subscriber, Trend, TrustedVoice } from "./types";

/** Where the API lives. Empty in development and when served from the same origin. */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Two independent sessions: a trusted voice's, and a community member's. */
export type Scope = "voice" | "member";

const tokens: Record<Scope, string | null> = { voice: null, member: null };
const onUnauthorized: Partial<Record<Scope, () => void>> = {};

export const setAuthToken = (scope: Scope, t: string | null) => {
  tokens[scope] = t;
};
export const setOnUnauthorized = (scope: Scope, fn: () => void) => {
  onUnauthorized[scope] = fn;
};

async function call<T>(path: string, init?: { method?: string; json?: unknown; auth?: Scope }): Promise<T> {
  const token = init?.auth ? tokens[init.auth] : null;
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
    headers: {
      ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  // An expired or revoked session signs that person out; a failed sign-in attempt does not.
  if (res.status === 401 && token && init?.auth) onUnauthorized[init.auth]?.();
  if (!res.ok) {
    const issues = data.issues ? Object.values(data.issues as Record<string, string[]>).flat()[0] : undefined;
    throw new ApiError(issues ?? data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

type Session<T> = { token: string; expiresAt: string } & T;

export const api = {
  // Public
  meta: () => call<Meta>("/meta"),
  alerts: () => call<Alert[]>("/alerts"),

  // Trusted voice
  login: (identifier: string, secret: string) => call<Session<{ voice: TrustedVoice }>>("/auth/login", { json: { identifier, secret } }),
  me: () => call<{ voice: TrustedVoice }>("/auth/me", { auth: "voice" }),
  deliveries: () => call<Delivery[]>("/deliveries", { auth: "voice" }),
  trends: () => call<Trend[]>("/checks/trends", { auth: "voice" }),
  subscribers: () => call<Subscriber[]>("/subscribers", { auth: "voice" }),
  draft: (transcript: string, clock?: string) => call<AlertDraft>("/alerts/draft", { json: { transcript, clock }, auth: "voice" }),
  publish: (body: Omit<AlertDraft, "grounding" | "engine"> & { transcript: string }) =>
    call<PublishResult>("/alerts", { json: body, auth: "voice" }),

  // Community member
  memberContact: (phone: string) => call<Session<{ member: Member }>>("/members/contact", { json: { phone } }),
  memberSignup: (body: { phone?: string; email?: string; password: string; areaIds: string[] }) =>
    call<Session<{ member: Member }>>("/members/signup", { json: body }),
  memberLogin: (identifier: string, password: string) => call<Session<{ member: Member }>>("/members/login", { json: { identifier, password } }),
  memberMe: () => call<{ member: Member }>("/members/me", { auth: "member" }),
  memberSetAreas: (areaIds: string[]) => call<{ member: Member }>("/members/me/areas", { method: "PUT", json: { areaIds }, auth: "member" }),
  memberMessages: () => call<Delivery[]>("/members/me/messages", { auth: "member" }),
  check: (text: string) => call<CheckResponse>("/checks", { json: { text }, auth: "member" }),
};
