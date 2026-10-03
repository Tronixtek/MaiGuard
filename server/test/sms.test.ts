import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { store } from "../src/store.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
const app = createApp();

const calls: { url: string; body: string; headers: Record<string, string> }[] = [];
const settle = () => new Promise((r) => setTimeout(r, 30));

async function publish() {
  const voice = await request(app).post("/api/auth/login").send({ identifier: "0806 555 0172", secret: "529617" });
  await request(app)
    .post("/api/alerts")
    .set("Authorization", `Bearer ${voice.body.token}`)
    .send({ what: "Road blocked.", where: "North Gate Road", kind: "danger", areaIds: ["north-gate"], urgency: "interrupt" });
  await settle();
}

beforeEach(() => {
  store.reset();
  calls.length = 0;
  for (const key of ["SMS_PROVIDER", "SMS_API_KEY", "SMS_SENDER", "SMS_USERNAME", "SMS_ACCOUNT_SID"]) delete process.env[key];
  vi.stubGlobal("fetch", async (url: string, init: { body: BodyInit; headers: Record<string, string> }) => {
    calls.push({ url, body: String(init.body), headers: init.headers });
    return new Response("{}", { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("SMS delivery", () => {
  it("sends nothing until a provider is configured", async () => {
    await publish();
    expect(calls).toHaveLength(0);
    expect(store.deliveries.filter((d) => d.channel === "sms").length).toBeGreaterThan(0); // still logged
  });

  it("never texts the seeded demo numbers", async () => {
    Object.assign(process.env, { SMS_PROVIDER: "bulksmslive", SMS_API_KEY: "key", SMS_SENDER: "MaiGuard" });
    await publish(); // North Gate has seeded contacts only
    expect(calls).toHaveLength(0);
    expect(store.deliveries.filter((d) => d.channel === "sms").length).toBeGreaterThan(0);
  });

  it("texts a real member through BulkSMSLive", async () => {
    Object.assign(process.env, { SMS_PROVIDER: "bulksmslive", SMS_API_KEY: "key", SMS_SENDER: "MaiGuard" });
    await request(app).post("/api/members/signup").send({ phone: "0815 555 0133", password: "long-enough", areaIds: ["north-gate"] });
    await publish();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.bulksmslive.com/v2/app/sendsms");
    expect(calls[0]!.headers.Authorization).toBe("Bearer key");
    expect(calls[0]!.body).toContain("recipients=%2B2348155550133");
    expect(calls[0]!.body).toContain("sender_name=MaiGuard");
  });

  it("sends through Africa's Talking", async () => {
    await request(app).post("/api/members/signup").send({ phone: "0815 555 0134", password: "long-enough", areaIds: ["north-gate"] });
    Object.assign(process.env, { SMS_PROVIDER: "africastalking", SMS_API_KEY: "key", SMS_USERNAME: "maiguard", SMS_SENDER: "MaiGuard" });
    await publish();
    expect(calls[0]!.url).toBe("https://api.africastalking.com/version1/messaging");
    expect(calls[0]!.headers.apiKey).toBe("key");
    expect(calls[0]!.body).toContain("to=%2B234"); // +234… international format
    expect(calls[0]!.body).toContain("from=MaiGuard");
  });

  it("sends through Termii", async () => {
    Object.assign(process.env, { SMS_PROVIDER: "termii", SMS_API_KEY: "key", SMS_SENDER: "MaiGuard" });
    await request(app).post("/api/members/signup").send({ phone: "0815 555 0135", password: "long-enough", areaIds: ["north-gate"] });
    await publish();
    expect(calls[0]!.url).toContain("termii.com");
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ from: "MaiGuard", api_key: "key", channel: "generic" });
  });

  it("sends through Twilio", async () => {
    Object.assign(process.env, { SMS_PROVIDER: "twilio", SMS_API_KEY: "token", SMS_ACCOUNT_SID: "AC123", SMS_SENDER: "+15550001111" });
    await request(app).post("/api/members/signup").send({ phone: "0815 555 0136", password: "long-enough", areaIds: ["north-gate"] });
    await publish();
    expect(calls[0]!.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(calls[0]!.headers.Authorization).toBe(`Basic ${Buffer.from("AC123:token").toString("base64")}`);
  });
});
