import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { store } from "../src/store.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
const app = createApp();

const sent: { to: string; body: string }[] = [];
const until = async (n: number) => {
  for (let i = 0; i < 300 && sent.length < n; i++) await new Promise((r) => setTimeout(r, 10));
};
let seq = 0;
const inbound = (from: string, text: string) => ({
  entry: [{ changes: [{ value: { messages: [{ id: `wamid.${Date.now()}.${seq++}`, from, type: "text", text: { body: text } }] } }] }],
});

beforeEach(() => {
  store.reset();
  sent.length = 0;
  Object.assign(process.env, { WHATSAPP_TOKEN: "test-token", WHATSAPP_PHONE_NUMBER_ID: "12345", WHATSAPP_VERIFY_TOKEN: "verify-me" });
  delete process.env.WHATSAPP_APP_SECRET;
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    const b = JSON.parse(init.body);
    expect(url).toContain("/12345/messages");
    sent.push({ to: b.to, body: b.text.body });
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("WhatsApp", () => {
  it("completes Meta's webhook verification only with the right token", async () => {
    const ok = await request(app).get("/api/whatsapp/webhook").query({ "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42" });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe("42");
    const bad = await request(app).get("/api/whatsapp/webhook").query({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42" });
    expect(bad.status).toBe(403);
  });

  it("answers a forwarded rumour in the chat and keeps the follow-up promise there", async () => {
    await request(app).post("/api/whatsapp/webhook").send(inbound("2348135550123", "Kidnappers at old bridge road this evening!!"));
    await until(1);
    expect(sent[0]!.to).toBe("2348135550123");
    expect(sent[0]!.body).toContain("Nothing verified yet");
    expect(sent[0]!.body).toContain("Musa Bello");
    expect(sent[0]!.body).toContain("We'll message you here");

    const voice = await request(app).post("/api/auth/login").send({ identifier: "0806 555 0172", secret: "529617" });
    await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${voice.body.token}`)
      .send({ what: "Old Bridge Road is calm and open.", where: "Old Bridge Road", kind: "all_clear", areaIds: ["old-bridge"], urgency: "available" });
    await until(3);
    const toThem = sent.filter((m) => m.to === "2348135550123");
    expect(toThem.some((m) => m.body.startsWith("MaiGuard UPDATE on what you asked about"))).toBe(true);
  });

  it("replies to a greeting with how to use it, and answers each message once", async () => {
    const payload = inbound("2348135550124", "hello");
    await request(app).post("/api/whatsapp/webhook").send(payload);
    await request(app).post("/api/whatsapp/webhook").send(payload); // Meta retry
    await until(2);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toContain("Forward the message here");
  });

  it("rejects webhooks with a bad signature when the app secret is set", async () => {
    process.env.WHATSAPP_APP_SECRET = "shh";
    const body = JSON.stringify(inbound("2348135550125", "shooting at the market"));
    const good = `sha256=${createHmac("sha256", "shh").update(body).digest("hex")}`;
    const bad = await request(app).post("/api/whatsapp/webhook").set("content-type", "application/json").set("x-hub-signature-256", "sha256=00").send(body);
    expect(bad.status).toBe(401);
    const ok = await request(app).post("/api/whatsapp/webhook").set("content-type", "application/json").set("x-hub-signature-256", good).send(body);
    expect(ok.status).toBe(200);
    await until(1);
    expect(sent[0]!.body).toContain("Not true as told");
  });
});
