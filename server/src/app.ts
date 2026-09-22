import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { api } from "./routes/api.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Behind Render's proxy, so req.ip is the client address (used by the sign-in limiter).
  app.set("trust proxy", 1);
  // Keep the raw body too: WhatsApp webhooks are verified against it.
  app.use(express.json({ limit: "100kb", verify: (req, _res, buf) => void ((req as Request).rawBody = buf) }));

  // The web app is hosted separately (Firebase), so allow its origins to call the API.
  // Auth uses bearer tokens, not cookies, so credentials are not needed.
  const allowed = new Set((process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean));
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && allowed.has(origin)) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
    }
    if (req.method === "OPTIONS") return void res.sendStatus(origin && allowed.has(origin) ? 204 : 403);
    next();
  });

  app.use("/api", api);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // In production the built React app is served from the same origin.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: "1h", index: false }));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  return app;
}
