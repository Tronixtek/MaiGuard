import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

// Point the store at a temporary database before it loads.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maiguard-"));
process.env.MAIGUARD_DB = path.join(dir, "maiguard.db");
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
const { createApp } = await import("../src/app.js");
const { store } = await import("../src/store.js");
const { load, closeDb } = await import("../src/db.js");
const app = createApp();

let auth = "";
beforeAll(async () => {
  const res = await request(app).post("/api/auth/login").send({ identifier: "0806 555 0172", secret: "529617" });
  auth = `Bearer ${res.body.token}`;
});

describe("SQLite persistence", () => {
  it("keeps accounts, alerts, checks, deliveries and follow-up promises across a restart", async () => {
    await request(app).post("/api/members/signup").send({ email: "keep.me@example.com", password: "long-enough", areaIds: ["old-bridge"] });
    const contact = await request(app).post("/api/members/contact").send({ phone: "0813 555 0199" });
    await request(app).post("/api/checks").set("Authorization", `Bearer ${contact.body.token}`).send({ text: "kidnappers at old bridge road" });
    await request(app)
      .post("/api/alerts")
      .set("Authorization", auth)
      .send({ what: "Old Bridge Road is open.", where: "Old Bridge Road", kind: "all_clear", areaIds: ["old-bridge"], urgency: "available" });
    store.persist();

    // What a restart reads back.
    closeDb();
    const saved = load()!;
    expect(saved.subscribers.find((s) => s.email === "keep.me@example.com")?.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(saved.alerts.some((a) => a.what === "Old Bridge Road is open.")).toBe(true);
    expect(saved.checks).toHaveLength(1);
    expect(saved.deliveries.length).toBeGreaterThan(0);
    expect(saved.followUps.every((f) => f.status === "fulfilled")).toBe(true);
    expect(JSON.stringify(saved)).not.toContain("long-enough");

    const login = await request(app).post("/api/members/login").send({ identifier: "keep.me@example.com", password: "long-enough" });
    expect(login.status).toBe(200);
    expect(login.body.member.areaIds).toEqual(["old-bridge"]);
  });

  it("resets the demo data but keeps members", async () => {
    store.reset();
    store.persist();
    expect(store.alerts).toHaveLength(3); // back to the seeded alerts
    expect(store.checks).toHaveLength(0);
    expect(store.findSubscriber({ email: "keep.me@example.com" })).toBeDefined();
    expect(load()!.subscribers.some((s) => s.email === "keep.me@example.com")).toBe(true);
  });
});
