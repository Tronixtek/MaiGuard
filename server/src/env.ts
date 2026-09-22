import dotenv from "dotenv";

// Imported first by index.ts so env vars exist before other modules read them.
// Works from the repo root or from server/.
dotenv.config({ path: [".env", "../.env"], quiet: true });
