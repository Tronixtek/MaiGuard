import "./env.js";
import { createApp } from "./app.js";
import { activeEngine, activeModel } from "./ai/client.js";
import { verifyEmail } from "./services/email.js";

const port = Number(process.env.PORT ?? 8787);

createApp().listen(port, () => {
  const engine = activeEngine();
  console.log(`MaiGuard API on http://localhost:${port} · AI: ${engine === "fallback" ? "rule-based fallback (no API key set)" : `${engine} (${activeModel()})`}`);
});

void verifyEmail();
