import { existsSync } from "node:fs";
import path from "node:path";

/**
 * `next dev`/`next build` load `.env.local` themselves; a plain vitest
 * run does not, so any module that reads `serverEnv` at import time
 * (config/env.ts) would otherwise fail before a single test runs. Uses
 * Node's own built-in loader (stable since Node 20.6) rather than
 * pulling in a dotenv dependency — and only fills in variables not
 * already set, matching that same convention, so CI can still override
 * via real environment variables.
 */
const envLocalPath = path.resolve(__dirname, ".env.local");
if (existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}
