// Verify the exact child process, using an OS-assigned port and IPC readiness.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function verifyProduction(entry, cwd = process.cwd()) {
  const origin = "http://127.0.0.1";
  const env = {
    ...process.env,
    API_HOST: "127.0.0.1",
    API_PORT: "0",
    ALLOWED_ORIGINS: origin,
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    NODE_ENV: "production",
  };
  const server = spawn(process.execPath, [resolve(entry)], {
    cwd, env, stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const stopped = new Promise((done) => {
    server.once("exit", done);
    server.once("error", done);
  });
  try {
    const port = await new Promise((done, fail) => {
      const cleanup = () => {
        clearTimeout(timer);
        server.off("message", ready);
        server.off("exit", exited);
        server.off("error", failed);
      };
      const failed = (error) => { cleanup(); fail(error); };
      const exited = (code) => failed(new Error(`Production server exited before readiness (${code})`));
      const ready = (message) => {
        if (message?.type !== "atlas:ready" || !Number.isInteger(message.port)) return;
        cleanup();
        done(message.port);
      };
      const timer = setTimeout(() => failed(new Error("Production server readiness timed out")), 15000);
      server.on("message", ready);
      server.once("exit", exited);
      server.once("error", failed);
    });
    const child = spawn(process.execPath, [fileURLToPath(new URL("smoke.mjs", import.meta.url))], {
      env: { ...env, SMOKE_URL: `http://127.0.0.1:${port}`, SMOKE_ORIGIN: origin },
      stdio: "inherit",
    });
    const code = await new Promise((done, fail) => {
      child.once("exit", done);
      child.once("error", fail);
    });
    if (code !== 0) throw new Error(`Smoke checks failed (${code})`);
  } finally {
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 12000);
    await stopped;
    clearTimeout(timer);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyProduction("dist-server/index.cjs");
}
