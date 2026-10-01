// Run the existing HTTP smoke checks against an isolated local production server.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.SMOKE_PORT || "18787";
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  API_HOST: "127.0.0.1",
  API_PORT: port,
  ALLOWED_ORIGINS: base,
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  NODE_ENV: "production",
};
const server = spawn(process.execPath, ["dist-server/index.cjs"], { env, stdio: "inherit" });
const stopped = new Promise((resolve, reject) => {
  server.once("exit", resolve);
  server.once("error", reject);
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Production server exited before readiness");
    try {
      const response = await fetch(`${base}/api/health/status`, { signal: AbortSignal.timeout(500) });
      ready = response.ok && (await response.json()).mode === "local";
    } catch { /* Server is starting. */ }
    if (ready) break;
    await delay(250);
  }
  if (!ready) throw new Error("Production server did not become ready");
  const child = spawn(process.execPath, ["scripts/smoke.mjs"], {
    env: { ...env, SMOKE_URL: base },
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
  if (code !== 0) throw new Error(`Smoke checks failed (${code})`);
} finally {
  server.kill("SIGTERM");
  await stopped;
}
