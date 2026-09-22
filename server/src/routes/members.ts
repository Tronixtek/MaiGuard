import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { store } from "../store.js";
import {
  clearLoginFailures,
  hashPassword,
  issueToken,
  loginBlocked,
  recordLoginFailure,
  requireAccount,
  requireMember,
  verifyPassword,
} from "../auth.js";
import { normalizePhone } from "../lib/text.js";
import { maskedView, messagesFor, selfView } from "../services/members.js";
import { sendEmail } from "../services/email.js";

/**
 * Community members. Anyone can check a rumour after leaving a phone number
 * once; an account (phone and/or email + password) is optional.
 */
export const members = Router();

const phoneField = z
  .string()
  .trim()
  .refine((p) => /^\+?[\d\s()-]+$/.test(p) && normalizePhone(p).length >= 10 && normalizePhone(p).length <= 15, "Enter a valid phone number.");
const emailField = z.string().trim().toLowerCase().email("Enter a valid email address.");

const parse = <T extends z.ZodType>(schema: T, req: Request, res: Response): z.infer<T> | undefined => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    res.status(400).json({ error: first?.message ?? "Invalid request" });
    return undefined;
  }
  return result.data;
};

const session = (id: string, role: "member" | "contact") => issueToken(id, role);

/** Quick path: a phone number, once. Finds the existing contact or adds one. */
members.post("/contact", (req, res) => {
  const body = parse(z.object({ phone: phoneField }), req, res);
  if (!body) return;
  const sub = store.findSubscriber({ phone: body.phone }) ?? store.addSubscriber({ phone: body.phone, areaIds: [] });
  res.json({ ...session(sub.id, "contact"), member: maskedView(sub) });
});

const SignupBody = z
  .object({
    phone: phoneField.optional().or(z.literal("").transform(() => undefined)),
    email: emailField.optional().or(z.literal("").transform(() => undefined)),
    password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
    areaIds: z.array(z.string()).default([]),
  })
  .refine((b) => b.phone || b.email, { message: "Enter a phone number, an email, or both." });

members.post("/signup", (req, res) => {
  const body = parse(SignupBody, req, res);
  if (!body) return;
  const areaIds = body.areaIds.filter((id) => store.area(id));

  const byPhone = body.phone ? store.findSubscriber({ phone: body.phone }) : undefined;
  const byEmail = body.email ? store.findSubscriber({ email: body.email }) : undefined;
  if (byPhone?.passwordHash || byEmail?.passwordHash) {
    return void res.status(409).json({ error: "An account already exists for that contact. Sign in instead." });
  }
  if (byPhone && byEmail && byPhone.id !== byEmail.id) {
    return void res.status(409).json({ error: "That phone number and email belong to different contacts." });
  }

  // Someone who already left their number (quick path) keeps their history and roads.
  const existing = byPhone ?? byEmail;
  let sub;
  if (existing) {
    existing.phone ??= body.phone;
    existing.email ??= body.email;
    existing.passwordHash = hashPassword(body.password);
    store.addAreas(existing, areaIds);
    store.touchSubscriber();
    sub = existing;
  } else {
    sub = store.addSubscriber({ phone: body.phone, email: body.email, areaIds, passwordHash: hashPassword(body.password) });
  }
  if (sub.email) {
    const roads = sub.areaIds.map((id) => store.area(id)?.name ?? id);
    void sendEmail(
      sub.email,
      "Welcome to MaiGuard",
      roads.length
        ? `You'll get verified alerts for ${roads.join(", ")} at this address as soon as a trusted voice publishes them.`
        : "You're signed up. Choose the roads you want alerts for in your account, and you'll get verified alerts at this address.",
    );
  }
  res.status(201).json({ ...session(sub.id, "member"), member: selfView(sub) });
});

members.post("/login", (req, res) => {
  const ip = req.ip ?? "unknown";
  if (loginBlocked(ip)) return void res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  const body = parse(z.object({ identifier: z.string().trim().min(3, "Enter your phone number or email."), password: z.string().min(1, "Enter your password.") }), req, res);
  if (!body) return;
  const sub = body.identifier.includes("@") ? store.findSubscriber({ email: body.identifier }) : store.findSubscriber({ phone: body.identifier });
  // verifyPassword runs even when there is no such account, so timing doesn't reveal who is registered.
  if (!verifyPassword(body.password, sub?.passwordHash) || !sub) {
    recordLoginFailure(ip);
    return void res.status(401).json({ error: "Those details don't match an account." });
  }
  clearLoginFailures(ip);
  res.json({ ...session(sub.id, "member"), member: selfView(sub) });
});

/** Quick-path sessions only see their contact masked: typing a number must not reveal someone's account. */
members.get("/me", requireMember, (req, res) => {
  res.json({ member: req.memberHasAccountSession ? selfView(req.member!) : maskedView(req.member!) });
});

members.put("/me/areas", requireAccount, (req, res) => {
  const body = parse(z.object({ areaIds: z.array(z.string()) }), req, res);
  if (!body) return;
  req.member!.areaIds = [...new Set(body.areaIds.filter((id) => store.area(id)))];
  store.touchSubscriber();
  res.json({ member: selfView(req.member!) });
});

members.get("/me/messages", requireAccount, (req, res) => {
  res.json(messagesFor(req.member!));
});
