import "./env.js";
import { createApp } from "./app.js";
import { activeEngine, activeModel } from "./ai/client.js";
import { verifyEmail } from "./services/email.js";
import { store } from "./store.js";
import { closeDb } from "./db.js";

const port = Number(process.env.PORT ?? 8787);

const server = createApp().listen(port, () => {
  const engine = activeEngine();
  console.log(`MaiGuard API on http://localhost:${port} · AI: ${engine === "fallback" ? "rule-based fallback (no API key set)" : `${engine} (${activeModel()})`}`);
});

void verifyEmail();

// Write anything still pending before the container stops.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
    store.persist();
    closeDb();
    process.exit(0);
  });
}
