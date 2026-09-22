import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { store } from "./store.js";
import { normalizePhone } from "./lib/text.js";
import type { Subscriber, TrustedVoice } from "./types.js";

/**
 * Two kinds of session, both signed, expiring bearer tokens:
 * - trusted voices sign in with phone + PIN, and alone may draft or publish
 *   alerts or see rumour-check trends;
 * - community members get a session when they leave a contact or sign in to
 *   their optional account, and need one to check rumours.
 *
 * Demo PINs are seeded here (see README). A real deployment would issue PINs
 * out of band and store only the hashes.
 */
const DEMO_PINS: Record<string, string> = {
  "tv-hauwa": "418203",
  "tv-musa": "529617",
  "tv-ifeanyi": "630482",
  "tv-grace": "741936",
  "tv-yusuf": "852074",
};

/**
 * voice: a trusted voice. member: a community member signed in to their account.
 * contact: a community member who only left a phone number (quick, one-time path).
 */
export type Role = "voice" | "member" | "contact";
const SESSION_HOURS: Record<Role, number> = { voice: 12, member: 24 * 30, contact: 24 * 90 };
// Without AUTH_SECRET, sessions last until the server restarts.
const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString("hex");
const SALT = "maiguard-pin";

/**
 * Email + password sign-in for the coordinator's desk account. Only a scrypt
 * hash lives in the environment (DESK_PASSWORD_HASH); without it, this login
 * is disabled. The repo is public, so the password itself is never stored here.
 */
const DESK_EMAIL = (process.env.DESK_EMAIL || "trustedvoice@local.com").toLowerCase();
const DESK_VOICE_ID = "tv-desk";

const pinHashes = new Map(Object.entries(DEMO_PINS).map(([id, pin]) => [id, scryptSync(pin, `${SALT}:${id}`, 32)]));

/** Trusted-voice sign-in: phone number + PIN, or the desk's email + password. */
export function verifyLogin(identifier: string, secret: string): TrustedVoice | undefined {
  if (identifier.includes("@")) {
    const ok = verifyPassword(secret, process.env.DESK_PASSWORD_HASH || undefined) && identifier.trim().toLowerCase() === DESK_EMAIL;
    return ok ? store.trustedVoice(DESK_VOICE_ID) : undefined;
  }
  return verifyPinLogin(identifier, secret);
}

function verifyPinLogin(phone: string, pin: string): TrustedVoice | undefined {
  const voice = store.trustedVoices.find((v) => normalizePhone(v.phone) === normalizePhone(phone));
  // Hash even when the phone is unknown so response time doesn't reveal which numbers exist.
  const expected = (voice && pinHashes.get(voice.id)) ?? scryptSync("", SALT, 32);
  const actual = scryptSync(pin, `${SALT}:${voice?.id ?? ""}`, 32);
  return voice && timingSafeEqual(expected, actual) ? voice : undefined;
}

const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function issueToken(sub: string, role: Role): { token: string; expiresAt: string } {
  const exp = Date.now() + SESSION_HOURS[role] * 3600_000;
  const payload = Buffer.from(JSON.stringify({ sub, role, exp })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

function readToken(token: string | undefined): { sub: string; role: Role } | undefined {
  if (!token) return undefined;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return undefined;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  try {
    const { sub, role, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; role: Role; exp: number };
    if (Date.now() > exp) return undefined;
    return { sub, role };
  } catch {
    return undefined;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      trustedVoice?: TrustedVoice;
      member?: Subscriber;
      memberHasAccountSession?: boolean;
      rawBody?: Buffer;
    }
  }
}

const bearer = (req: Request) => {
  const header = req.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
};

export function requireTrustedVoice(req: Request, res: Response, next: NextFunction) {
  const t = readToken(bearer(req));
  const voice = t?.role === "voice" ? store.trustedVoice(t.sub) : undefined;
  if (!voice) return void res.status(401).json({ error: "Sign in as a trusted voice to do this." });
  req.trustedVoice = voice;
  next();
}

/** A member session of either kind: account sign-in or the one-time phone number. */
export function requireMember(req: Request, res: Response, next: NextFunction) {
  const t = readToken(bearer(req));
  const member = t && t.role !== "voice" ? store.subscriber(t.sub) : undefined;
  if (!member) return void res.status(401).json({ error: "Enter your phone number or sign in first." });
  req.member = member;
  req.memberHasAccountSession = t!.role === "member";
  next();
}

/** Account-only actions (seeing your contact details and messages, changing roads) need a password sign-in. */
export function requireAccount(req: Request, res: Response, next: NextFunction) {
  requireMember(req, res, () => {
    if (!req.memberHasAccountSession) return void res.status(403).json({ error: "Sign in to your account to do this." });
    next();
  });
}

/** Account passwords: scrypt with a per-account random salt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  const [salt, hash] = (stored ?? "0:" + "00".repeat(32)).split(":");
  const actual = scryptSync(password, salt!, 32);
  const expected = Buffer.from(hash!, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual) && Boolean(stored);
}

/** Small in-memory limiter: 5 failed sign-ins per IP per 10 minutes. */
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 5;

export function loginBlocked(ip: string): boolean {
  const f = failures.get(ip);
  if (!f || Date.now() > f.until) return false;
  return f.count >= MAX_FAILURES;
}

export function recordLoginFailure(ip: string) {
  const f = failures.get(ip);
  if (!f || Date.now() > f.until) failures.set(ip, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count++;
}

export function clearLoginFailures(ip: string) {
  failures.delete(ip);
}
