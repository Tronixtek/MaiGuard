import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { store } from "../src/store.js";
import { enforce } from "../src/ai/matchClaim.js";
import { finalizeDraft } from "../src/ai/draftAlert.js";
import { hashPassword } from "../src/auth.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
const app = createApp();

// Musa Bello, the Old Bridge Road trusted voice (demo PIN from src/auth.ts).
let auth = "";
// A community member on the quick path: a phone number, left once.
let member = "";
beforeEach(async () => {
  store.reset();
  const res = await request(app).post("/api/auth/login").send({ identifier: "+234 806 555 0172", secret: "529617" });
  auth = `Bearer ${res.body.token}`;
  const m = await request(app).post("/api/members/contact").send({ phone: "0813 555 0199" });
  member = `Bearer ${m.body.token}`;
});

const check = (text: string, as = member) => request(app).post("/api/checks").set("Authorization", as).send({ text });

describe("trusted-voice access", () => {
  it("rejects drafting, publishing and trends without signing in", async () => {
    expect((await request(app).post("/api/alerts/draft").send({ transcript: "armed men at old bridge road" })).status).toBe(401);
    expect((await request(app).post("/api/alerts").send({})).status).toBe(401);
    expect((await request(app).get("/api/checks/trends")).status).toBe(401);
    expect((await request(app).post("/api/demo/reset")).status).toBe(401);
  });

  it("accepts the local phone format", async () => {
    expect((await request(app).post("/api/auth/login").send({ identifier: "0806 555 0172", secret: "529617" })).status).toBe(200);
  });

  it("rejects a wrong PIN and a tampered token", async () => {
    expect((await request(app).post("/api/auth/login").send({ identifier: "+234 806 555 0172", secret: "000000" })).status).toBe(401);
    const forged = auth.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect((await request(app).get("/api/auth/me").set("Authorization", forged)).status).toBe(401);
  });

  it("attributes a published alert to the signed-in voice", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .set("Authorization", auth)
      .send({ what: "Road blocked.", where: "North Gate Road", action: "", kind: "danger", areaIds: ["north-gate"], urgency: "interrupt", trustedVoiceId: "tv-grace" });
    expect(res.status).toBe(201);
    expect(res.body.alert.trustedVoiceId).toBe("tv-musa");
  });

  it("signs the coordinator desk in with email and password, and publishes as the desk", async () => {
    process.env.DESK_PASSWORD_HASH = hashPassword("correct horse battery");
    const bad = await request(app).post("/api/auth/login").send({ identifier: "trustedvoice@local.com", secret: "wrong password" });
    expect(bad.status).toBe(401);
    const res = await request(app).post("/api/auth/login").send({ identifier: "TrustedVoice@Local.com", secret: "correct horse battery" });
    expect(res.status).toBe(200);
    expect(res.body.voice.name).toBe("MaiGuard Desk");
    const pub = await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${res.body.token}`)
      .send({ what: "Road blocked.", where: "Riverside Way", kind: "danger", areaIds: ["riverside"], urgency: "interrupt" });
    expect(pub.body.alert.trustedVoiceId).toBe("tv-desk");
    delete process.env.DESK_PASSWORD_HASH;
  });

  it("disables email sign-in when no desk password is configured", async () => {
    expect((await request(app).post("/api/auth/login").send({ identifier: "trustedvoice@local.com", secret: "anything" })).status).toBe(401);
  });

  it("lets anyone check a rumour after leaving a phone number once", async () => {
    expect((await request(app).post("/api/checks").send({ text: "bandits at north gate" })).status).toBe(401);
    expect((await check("bandits at north gate")).status).toBe(200);
  });

  it("never exposes subscriber numbers publicly, and masks them for trusted voices", async () => {
    const meta = (await request(app).get("/api/meta")).body;
    expect(JSON.stringify(meta)).not.toContain("555 0101");
    expect((await request(app).get("/api/subscribers")).status).toBe(401);
    expect((await request(app).get("/api/deliveries")).status).toBe(401);
    const subs = (await request(app).get("/api/subscribers").set("Authorization", auth)).body;
    expect(subs[0].phone).toBe("+234 ••• ••• 0101");
    expect(subs.find((x: { email: string | null }) => x.email)?.email).toBe("a•••@example.com");
  });
});

describe("community member accounts", () => {
  it("rejects an invalid phone number on the quick path", async () => {
    expect((await request(app).post("/api/members/contact").send({ phone: "call me" })).status).toBe(400);
  });

  it("signs up with email only, chooses roads, and signs back in", async () => {
    const up = await request(app).post("/api/members/signup").send({ email: "New.Member@Example.com", password: "long-enough", areaIds: ["riverside"] });
    expect(up.status).toBe(201);
    expect(up.body.member).toMatchObject({ email: "new.member@example.com", phone: null, areaIds: ["riverside"], hasAccount: true });
    expect(JSON.stringify(up.body)).not.toContain("passwordHash");

    expect((await request(app).post("/api/members/login").send({ identifier: "new.member@example.com", password: "wrong-one" })).status).toBe(401);
    const login = await request(app).post("/api/members/login").send({ identifier: "new.member@example.com", password: "long-enough" });
    expect(login.status).toBe(200);
    const put = await request(app).put("/api/members/me/areas").set("Authorization", `Bearer ${login.body.token}`).send({ areaIds: ["riverside", "ward-3"] });
    expect(put.body.member.areaIds).toEqual(["riverside", "ward-3"]);
  });

  it("upgrades a quick-path number to an account, keeping its roads", async () => {
    await check("kidnappers at old bridge road");
    const up = await request(app).post("/api/members/signup").send({ phone: "+234 813 555 0199", email: "me@example.com", password: "long-enough" });
    expect(up.status).toBe(201);
    expect(up.body.member.areaIds).toContain("old-bridge");
    expect(store.subscribers.filter((x) => x.phone && x.phone.endsWith("0199"))).toHaveLength(1);
  });

  it("refuses a second account for the same contact", async () => {
    await request(app).post("/api/members/signup").send({ phone: "0813 555 0177", password: "long-enough" });
    expect((await request(app).post("/api/members/signup").send({ phone: "+234 813 555 0177", password: "another-one" })).status).toBe(409);
  });

  it("gets email alerts on the email channel", async () => {
    await request(app).post("/api/members/signup").send({ email: "north@example.com", password: "long-enough", areaIds: ["north-gate"] });
    await request(app)
      .post("/api/alerts")
      .set("Authorization", auth)
      .send({ what: "Road blocked.", where: "North Gate Road", kind: "danger", areaIds: ["north-gate"], urgency: "interrupt" });
    expect(store.deliveries.some((d) => d.channel === "email" && d.to === "north@example.com")).toBe(true);
  });

  it("does not reveal an account's details to someone who only typed its number", async () => {
    await request(app).post("/api/members/signup").send({ phone: "0813 555 0166", email: "private@example.com", password: "long-enough" });
    const quick = await request(app).post("/api/members/contact").send({ phone: "0813 555 0166" });
    const me = await request(app).get("/api/members/me").set("Authorization", `Bearer ${quick.body.token}`);
    expect(me.body.member.email).toBe("p•••@example.com");
    expect((await request(app).get("/api/members/me/messages").set("Authorization", `Bearer ${quick.body.token}`)).status).toBe(403);
  });
});

describe("broadcast path", () => {
  const transcript =
    "Musa here at the motor park. There are armed men blocking Old Bridge Road near the bridge junction. Avoid Old Bridge Road, use Riverside Way.";

  it("drafts an alert grounded in what the speaker said", async () => {
    const res = await request(app).post("/api/alerts/draft").set("Authorization", auth).send({ transcript });
    expect(res.status).toBe(200);
    expect(res.body.areaIds).toContain("old-bridge");
    expect(res.body.kind).toBe("danger");
    expect(res.body.urgency).toBe("interrupt");
    expect(res.body.grounding.what.grounded).toBe(true);
    expect(res.body.action).toMatch(/avoid old bridge road/i);
  });

  it("does not publish anything until a person confirms", async () => {
    const before = store.alerts.length;
    await request(app).post("/api/alerts/draft").set("Authorization", auth).send({ transcript });
    expect(store.alerts.length).toBe(before);
  });

  it("delivers only to residents linked to the affected area", async () => {
    const draft = (await request(app).post("/api/alerts/draft").set("Authorization", auth).send({ transcript })).body;
    const res = await request(app).post("/api/alerts").set("Authorization", auth).send({ ...draft, transcript });
    expect(res.status).toBe(201);
    const recipients = store.deliveries.map((d) => d.subscriberId);
    expect(recipients).toContain("s-01"); // Market Road + Old Bridge
    expect(recipients).not.toContain("s-08"); // North Gate only
    expect(res.body.recipients).toBe(store.subscribers.filter((s) => s.areaIds.includes("old-bridge")).length);
  });

  it("lets advisories wait at night", async () => {
    const res = await request(app)
      .post("/api/alerts/draft")
      .set("Authorization", auth)
      .send({ transcript: "Riverside Way will be closed tomorrow for road repairs.", clock: "02:00" });
    expect(res.body.kind).toBe("advisory");
    expect(res.body.urgency).toBe("available");
  });
});

describe("rumour check: three honest outcomes", () => {
  it("confirms a rumour that matches an active verified alert", async () => {
    const res = await check("Bandits at north gate!! armed men everywhere");
    expect(res.body.outcome).toBe("match");
    expect(res.body.alert.id).toBe("a-seed-northgate");
  });

  it("contradicts a rumour that a trusted voice has corrected", async () => {
    const res = await check("They are shooting at the market, run!");
    expect(res.body.outcome).toBe("contradict");
    expect(res.body.alert.kind).toBe("all_clear");
  });

  it("never calls a road safe without a source, and gives the right contact", async () => {
    const res = await check("Heard there are kidnappers at old bridge road tonight");
    expect(res.body.outcome).toBe("unverified");
    expect(res.body.summary).toMatch(/does not mean the road is safe/i);
    expect(res.body.contact.id).toBe("tv-musa");
    expect(res.body.followUp.promised).toBe(true);
    expect(res.body.followUp.message).toMatch(/\+234 ••• ••• 0199/);
  });

  it("keeps the follow-up promise to the member who asked", async () => {
    await check("kidnappers at old bridge road");
    const transcript = "Musa here. Old Bridge Road is calm, no kidnappers, it is open.";
    const draft = (await request(app).post("/api/alerts/draft").set("Authorization", auth).send({ transcript })).body;
    const res = await request(app).post("/api/alerts").set("Authorization", auth).send({ ...draft, transcript });
    expect(res.body.followUpsKept).toBe(1);
    const newcomer = store.findSubscriber({ phone: "0813 555 0199" })!;
    expect(newcomer.areaIds).toContain("old-bridge");
    expect(store.deliveries.some((d) => d.kind === "follow_up" && d.subscriberId === newcomer.id)).toBe(true);
    expect(store.followUps.every((f) => f.status === "fulfilled")).toBe(true);
  });

  it("surfaces clusters of unanswered checks to the trusted voice", async () => {
    for (let i = 0; i < 3; i++) await check("kidnapping at old bridge!");
    const trends = (await request(app).get("/api/checks/trends").set("Authorization", auth)).body;
    expect(trends[0]).toMatchObject({ areaId: "old-bridge", topic: "kidnapping", count: 3, needsAnswer: true });
  });
});

describe("guardrails", () => {
  it("downgrades a match that points at no real alert", () => {
    const m = enforce(
      { outcome: "match", alert_id: "made-up", claim_area_ids: ["old-bridge"], topic: "gunfire", claim_summary: "x", reason: "x" },
      "shooting at old bridge",
      "claude",
    );
    expect(m.outcome).toBe("unverified");
    expect(m.alert).toBeUndefined();
  });

  it("turns a match on a superseded alert into the correction", () => {
    const m = enforce(
      { outcome: "match", alert_id: "a-seed-market-danger", claim_area_ids: ["market-road"], topic: "gunfire", claim_summary: "x", reason: "x" },
      "bangs at market road",
      "claude",
    );
    expect(m.outcome).toBe("contradict");
    expect(m.alert?.id).toBe("a-seed-market-clear");
  });

  it("flags draft lines that the speaker never said", () => {
    const d = finalizeDraft(
      {
        what: "Soldiers have arrived.",
        what_quote: "soldiers have arrived",
        where: "Market Road",
        where_quote: "market road",
        action: "",
        action_quote: "",
        kind: "danger",
        area_ids: ["market-road", "not-a-place"],
        urgency: "interrupt",
        urgency_reason: "x",
      },
      "There is trouble on market road",
      false,
      "claude",
    );
    expect(d.grounding.what.grounded).toBe(false);
    expect(d.grounding.where.grounded).toBe(true);
    expect(d.areaIds).toEqual(["market-road"]);
  });
});
