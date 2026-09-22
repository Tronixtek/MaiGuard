import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { store, type StoreEvent } from "../store.js";
import type { Delivery } from "../types.js";
import { activeEngine, activeModel } from "../ai/client.js";
import { draftAlert } from "../ai/draftAlert.js";
import { publishAndDeliver } from "../services/broadcast.js";
import { checkRumour } from "../services/checkRumour.js";
import { maskedView } from "../services/members.js";
import { members } from "./members.js";
import { whatsapp } from "./whatsapp.js";
import { checkTrends } from "../services/trends.js";
import { TOWN_NAME } from "../data/seed.js";
import { maskEmail, maskPhone, TOWN_TZ, townClock } from "../lib/text.js";
import { clearLoginFailures, issueToken, loginBlocked, recordLoginFailure, requireMember, requireTrustedVoice, verifyLogin } from "../auth.js";

export const api = Router();
api.use("/members", members);
api.use("/whatsapp", whatsapp);

const parse = <T extends z.ZodType>(schema: T, req: Request, res: Response): z.infer<T> | undefined => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request", issues: z.flattenError(result.error).fieldErrors });
    return undefined;
  }
  return result.data;
};

api.get("/health", (_req, res) => {
  res.json({ ok: true, engine: activeEngine() });
});

api.get("/meta", (_req, res) => {
  res.json({
    town: TOWN_NAME,
    timeZone: TOWN_TZ,
    clock: townClock().label,
    engine: activeEngine(),
    model: activeModel(),
    areas: store.areas,
    trustedVoices: store.trustedVoices,
  });
});

const LoginBody = z.object({
  identifier: z.string().trim().min(6, "Enter your phone number or email.").max(120),
  secret: z.string().min(4, "Enter your PIN or password.").max(200),
});

api.post("/auth/login", (req, res) => {
  const ip = req.ip ?? "unknown";
  if (loginBlocked(ip)) return void res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  const body = parse(LoginBody, req, res);
  if (!body) return;
  const voice = verifyLogin(body.identifier, body.secret);
  if (!voice) {
    recordLoginFailure(ip);
    return void res.status(401).json({ error: "Those sign-in details are incorrect." });
  }
  clearLoginFailures(ip);
  res.json({ ...issueToken(voice.id, "voice"), voice });
});

api.get("/auth/me", requireTrustedVoice, (req, res) => {
  res.json({ voice: req.trustedVoice });
});

api.get("/alerts", (_req, res) => {
  res.json(store.alerts);
});

const DraftBody = z.object({
  transcript: z.string().trim().min(8, "Say a little more so there is something to structure.").max(4000),
  clock: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
});

api.post("/alerts/draft", requireTrustedVoice, async (req, res) => {
  const body = parse(DraftBody, req, res);
  if (!body) return;
  res.json(await draftAlert(body.transcript, body.clock));
});

const PublishBody = z.object({
  what: z.string().trim().min(3).max(400),
  where: z.string().trim().min(2).max(200),
  action: z.string().trim().max(300).default(""),
  kind: z.enum(["danger", "advisory", "all_clear"]),
  areaIds: z.array(z.string()).min(1, "Pick at least one affected area."),
  urgency: z.enum(["interrupt", "available"]),
  urgencyReason: z.string().max(300).default(""),
  transcript: z.string().max(4000).default(""),
});

/** Only a signed-in trusted voice's explicit confirmation writes to the verified store. */
api.post("/alerts", requireTrustedVoice, (req, res) => {
  const body = parse(PublishBody, req, res);
  if (!body) return;
  const unknownArea = body.areaIds.find((id) => !store.area(id));
  if (unknownArea) return void res.status(400).json({ error: `Unknown area: ${unknownArea}` });

  // Attributed to whoever is signed in, never to an id supplied by the client.
  res.status(201).json(publishAndDeliver({ ...body, trustedVoiceId: req.trustedVoice!.id }));
});

const CheckBody = z.object({
  text: z.string().trim().min(5, "Paste the message you received.").max(2000),
});

api.post("/checks", requireMember, async (req, res) => {
  const body = parse(CheckBody, req, res);
  if (!body) return;
  res.json(await checkRumour(body.text, req.member!));
});

// Member contacts are private: trusted voices see them masked, the public never sees them.
const maskDelivery = (d: Delivery) => ({ ...d, to: d.channel === "email" ? maskEmail(d.to) : maskPhone(d.to) });


api.get("/subscribers", requireTrustedVoice, (_req, res) => {
  res.json(store.subscribers.map(maskedView));
});

api.get("/checks", requireTrustedVoice, (_req, res) => {
  res.json(store.checks);
});

api.get("/checks/trends", requireTrustedVoice, (_req, res) => {
  res.json(checkTrends());
});

api.get("/deliveries", requireTrustedVoice, (_req, res) => {
  res.json(store.deliveries.map(maskDelivery));
});

api.post("/demo/reset", requireTrustedVoice, (_req, res) => {
  store.reset();
  res.json({ ok: true });
});

/** Server-Sent Events: the simulated SMS gateway and live dashboards listen here. */
api.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);

  const onEvent = (e: StoreEvent) => {
    // The stream is public: never send numbers or the text of what someone asked about.
    const safe = e.type === "delivery" ? { ...e, delivery: maskDelivery(e.delivery) } : e.type === "check" ? { type: "check" } : e;
    res.write(`event: ${e.type}\ndata: ${JSON.stringify(safe)}\n\n`);
  };
  const ping = setInterval(() => res.write(`: ping\n\n`), 20_000);
  store.events.on("event", onEvent);
  req.on("close", () => {
    clearInterval(ping);
    store.events.off("event", onEvent);
  });
});
