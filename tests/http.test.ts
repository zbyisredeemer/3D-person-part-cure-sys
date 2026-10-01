import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { before, after, test } from "node:test";

let server: ChildProcess;
let stopped: Promise<unknown>;
let folder: string;
let base: string;
const origin = "http://allowed.example";
const request = (path: string, init: RequestInit = {}) =>
  fetch(base + path, { ...init, signal: AbortSignal.timeout(3000) });
const post = (body: string, headers: Record<string, string> = {}) =>
  request("/api/health/chat", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });

before(async () => {
  folder = await mkdtemp(join(tmpdir(), "atlas-http-"));
  await mkdir(join(folder, "dist"));
  await writeFile(join(folder, "dist", "index.html"), "<main>Atlas test</main>");
  await writeFile(join(folder, "dist", "asset.js"), "console.log('fixture')");
  await writeFile(join(folder, "private.txt"), "not public");
  server = spawn(process.execPath, ["--import", import.meta.resolve("tsx"), fileURLToPath(new URL("../server/index.ts", import.meta.url))], {
    cwd: folder,
    env: { ...process.env, API_HOST: "127.0.0.1", API_PORT: "0", ALLOWED_ORIGINS: origin, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  });
  stopped = new Promise((done) => { server.once("exit", done); server.once("error", done); });
  const port = await new Promise<number>((done, fail) => {
    const timer = setTimeout(() => fail(new Error("HTTP server startup timeout")), 10000);
    server.once("error", (error) => { clearTimeout(timer); fail(error); });
    server.once("exit", (code) => { clearTimeout(timer); fail(new Error(`Early exit: ${code}`)); });
    server.on("message", (message: unknown) => {
      const ready = message as { type?: string; port?: number };
      if (ready.type === "atlas:ready" && ready.port) { clearTimeout(timer); done(ready.port); }
    });
  });
  base = `http://127.0.0.1:${port}`;
});
after(async () => {
  server?.kill("SIGTERM");
  if (stopped) await stopped;
  if (folder) await rm(folder, { recursive: true, force: true });
});

test("HTTP serves static pages, SPA routes and HEAD with security headers", async () => {
  for (const path of ["/", "/learning"]) {
    const res = await request(path);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Atlas test/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  }
  const head = await request("/asset.js", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.match(head.headers.get("content-type") || "", /javascript/);
  assert.equal(head.headers.get("x-content-type-options"), "nosniff");
});

test("HTTP rejects malformed paths, traversal, missing files and unsupported methods", async () => {
  for (const path of ["/%ZZ", "/%00.txt"]) assert.equal((await request(path)).status, 400);
  assert.equal((await request("/..%2fprivate.txt")).status, 403);
  assert.equal((await request("/missing.js")).status, 404);
  const method = await request("/", { method: "POST" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD");
  assert.equal((await request("/api/missing")).status, 404);
});

test("HTTP health and chat endpoints declare supported methods", async () => {
  const status = await request("/api/health/status");
  assert.deepEqual(await status.json(), { mode: "local" });
  assert.equal(status.headers.get("cache-control"), "no-store");
  const head = await request("/api/health/status", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const wrong = await request("/api/health/status", { method: "POST" });
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "GET, HEAD");
  const chat = await request("/api/health/chat");
  assert.equal(chat.status, 405);
  assert.equal(chat.headers.get("allow"), "POST");
});

test("HTTP validates origin, media type, JSON and body size before answering", async () => {
  const question = JSON.stringify({ question: "如何保护心脏？" });
  assert.equal((await post(question, { Origin: "http://untrusted.example" })).status, 403);
  assert.equal((await post(question, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await post(question, { "Content-Type": "application/json-evil" })).status, 415);
  assert.equal((await post("{broken")).status, 400);
  assert.equal((await post(JSON.stringify({ question: "a".repeat(501) }))).status, 400);
  assert.equal((await post(JSON.stringify({ question: "a".repeat(9000) }))).status, 413);
  const good = await post(question, { Origin: origin, "Content-Type": "Application/JSON; charset=utf-8" });
  assert.equal(good.status, 200);
  assert.equal((await good.json()).mode, "local");
});

test("HTTP applies rate limits to non-browser clients too", async () => {
  let limited: Response | undefined;
  for (let i = 0; i < 21; i++) {
    const res = await post(JSON.stringify({ question: "如何保护心脏？" }));
    await res.text();
    if (res.status === 429) { limited = res; break; }
    assert.equal(res.status, 200);
  }
  assert.ok(limited);
  assert.equal(limited.headers.get("retry-after"), "60");
});
