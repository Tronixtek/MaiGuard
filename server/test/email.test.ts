import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const sent: { to: string; subject: string; text: string; from: string }[] = [];
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: { to: string; subject: string; text: string; from: string }) => void sent.push(m),
      verify: async () => true,
    }),
  },
}));

delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
Object.assign(process.env, { SMTP_HOST: "smtp.example.com", SMTP_FROM: "MaiGuard <alerts@example.com>", PUBLIC_APP_URL: "https://maiguard.example" });
const { createApp } = await import("../src/app.js");
const { store } = await import("../src/store.js");
const app = createApp();
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  store.reset();
  sent.length = 0;
});

describe("email over SMTP", () => {
  it("welcomes a member who signs up with an email", async () => {
    await request(app).post("/api/members/signup").send({ email: "ada@example.com", password: "long-enough", areaIds: ["riverside"] });
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "ada@example.com", subject: "Welcome to MaiGuard", from: "MaiGuard <alerts@example.com>" });
    expect(sent[0]!.text).toContain("Riverside Way");
  });

  it("emails a published alert to members on that road, with a way to change their roads", async () => {
    await request(app).post("/api/members/signup").send({ email: "north@example.com", password: "long-enough", areaIds: ["north-gate"] });
    sent.length = 0;
    const voice = await request(app).post("/api/auth/login").send({ identifier: "0806 555 0172", secret: "529617" });
    await request(app)
      .post("/api/alerts")
      .set("Authorization", `Bearer ${voice.body.token}`)
      .send({ what: "Road blocked by a fallen truck.", where: "North Gate Road", kind: "advisory", areaIds: ["north-gate"], urgency: "available", action: "Use Ward 3 road." });
    await settle();
    const toNorth = sent.filter((m) => m.to === "north@example.com");
    expect(toNorth).toHaveLength(1);
    expect(toNorth[0]!.subject).toBe("MaiGuard NOTICE · North Gate Road");
    expect(toNorth[0]!.text).toContain("Road blocked by a fallen truck.");
    expect(toNorth[0]!.text).toContain("https://maiguard.example/account");
    // Seeded contact with an email on another road gets nothing.
    expect(sent.some((m) => m.to === "ada.o@example.com")).toBe(false);
  });
});
