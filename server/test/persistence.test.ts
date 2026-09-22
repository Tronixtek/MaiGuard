import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

// Point the store at a temporary data directory before it loads.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maiguard-"));
process.env.MAIGUARD_DATA_DIR = dir;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
const { createApp } = await import("../src/app.js");
const { store } = await import("../src/store.js");
const app = createApp();

describe("member accounts survive a restart", () => {
  it("saves accounts to disk and signs back in after the data is reloaded", async () => {
    const up = await request(app).post("/api/members/signup").send({ email: "keep.me@example.com", password: "long-enough", areaIds: ["riverside"] });
    expect(up.status).toBe(201);

    const saved = JSON.parse(fs.readFileSync(path.join(dir, "subscribers.json"), "utf8")) as { email?: string; passwordHash?: string }[];
    const account = saved.find((s) => s.email === "keep.me@example.com");
    expect(account?.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(JSON.stringify(saved)).not.toContain("long-enough");

    store.reset(); // what a restart does: reload from disk, not the seed
    const login = await request(app).post("/api/members/login").send({ identifier: "keep.me@example.com", password: "long-enough" });
    expect(login.status).toBe(200);
    expect(login.body.member.areaIds).toEqual(["riverside"]);
  });
});
