import { Router } from "express";
import { checkRumour } from "../services/checkRumour.js";
import { extractMessages, handleMessage, verifySignature, verifySubscription } from "../services/whatsapp.js";

/** Meta's webhook for the WhatsApp Business Platform. */
export const whatsapp = Router();

// Meta calls this once, when the webhook is configured in the app dashboard.
whatsapp.get("/webhook", (req, res) => {
  if (verifySubscription(req.query["hub.mode"], req.query["hub.verify_token"])) {
    return void res.status(200).send(String(req.query["hub.challenge"] ?? ""));
  }
  res.sendStatus(403);
});

whatsapp.post("/webhook", (req, res) => {
  if (!verifySignature(req.rawBody, req.get("x-hub-signature-256"))) return void res.sendStatus(401);
  // Acknowledge at once; Meta retries if we are slow. Replies go out asynchronously.
  res.sendStatus(200);
  for (const msg of extractMessages(req.body)) {
    handleMessage(msg, checkRumour).catch((err) => console.warn(`[whatsapp] ${(err as Error).message}`));
  }
});
