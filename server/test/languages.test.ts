import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { store } from "../src/store.js";
import { smsBody } from "../src/services/broadcast.js";
import type { Alert } from "../src/types.js";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
const app = createApp();

let auth = "";
beforeEach(async () => {
  store.reset();
  const res = await request(app).post("/api/auth/login").send({ identifier: "0806 555 0172", secret: "529617" });
  auth = `Bearer ${res.body.token}`;
});

const hausaAlert = (): Alert => ({
  ...store.alerts[0]!,
  what: "An ga mutane da bindigogi kusa da shingen North Gate.",
  where: "Titin North Gate",
  action: "Ku guji titin North Gate da dare.",
  language: "ha",
  translations: { en: { what: "Armed men were seen near the North Gate checkpoint.", where: "North Gate Road", action: "Avoid North Gate Road after dark." } },
});

describe("local languages", () => {
  it("sends each member the alert in their own language", () => {
    const alert = hausaAlert();
    expect(smsBody(alert, "ha")).toContain("Ku guji titin North Gate da dare.");
    expect(smsBody(alert, "en")).toContain("Avoid North Gate Road after dark.");
    // No translation for Yoruba yet: the reader still gets the original rather than nothing.
    expect(smsBody(alert, "yo")).toContain("Ku guji titin North Gate da dare.");
  });

  it("keeps the language a trusted voice published in", async () => {
    const res = await request(app)
      .post("/api/alerts")
      .set("Authorization", auth)
      .send({ what: "Hanya don lafiya.", where: "Riverside Way", kind: "all_clear", areaIds: ["riverside"], urgency: "available", language: "ha" });
    expect(res.status).toBe(201);
    expect(res.body.alert.language).toBe("ha");
  });

  it("stores a member's language and offers the list of languages", async () => {
    const up = await request(app).post("/api/members/signup").send({ email: "hausa.reader@example.com", password: "long-enough", areaIds: ["north-gate"], language: "ha" });
    expect(up.body.member.language).toBe("ha");
    const login = await request(app).post("/api/members/login").send({ identifier: "hausa.reader@example.com", password: "long-enough" });
    const changed = await request(app).put("/api/members/me/areas").set("Authorization", `Bearer ${login.body.token}`).send({ areaIds: ["north-gate"], language: "pcm" });
    expect(changed.body.member.language).toBe("pcm");
    const meta = await request(app).get("/api/meta");
    expect(meta.body.languages.map((l: { code: string }) => l.code)).toEqual(["en", "ha", "pcm", "yo", "ig"]);
  });
});
