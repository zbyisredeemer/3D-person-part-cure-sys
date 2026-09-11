import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";

const base =
  process.env.SMOKE_URL || `http://127.0.0.1:${process.env.API_PORT || 8787}`;
const origin = process.env.SMOKE_ORIGIN || new URL(base).origin;
const request = (path, init = {}) =>
  fetch(new URL(path, base), { ...init, signal: AbortSignal.timeout(15000) });

const page = await request("/");
assert.equal(page.status, 200, "frontend response");
const html = await page.text();
assert.match(html, /id="root"/, "React root");
const script = html.match(/src="(\/assets\/[^\"]+\.js)"/);
assert.ok(script, "production JS entry");
assert.equal(
  (await request(script[1], { method: "HEAD" })).status,
  200,
  "JS asset",
);

const status = await request("/api/health/status");
assert.equal(status.status, 200);
assert.ok(["local", "online"].includes((await status.json()).mode));
const manifest = await request("/models/human-atlas/manifest.json");
assert.equal(manifest.status, 200);
assert.equal((await manifest.json()).importedParts, 2193);
const asset = await request("/models/human-atlas/heart.glb.gz");
assert.equal(asset.status, 200);
const bytes = Buffer.from(await asset.arrayBuffer());
const glb = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
assert.equal(glb.toString("ascii", 0, 4), "glTF", "compressed anatomy model");
assert.equal(
  (await request("/models/skin-neutral.glb", { method: "HEAD" })).status,
  200,
  "legacy supplement",
);
assert.equal(
  (await request("/models/draco/draco_decoder.wasm", { method: "HEAD" }))
    .status,
  200,
  "local Draco decoder",
);

// Emergency input always uses local rules, even when online AI is configured.
const chat = await request("/api/health/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ question: "胸痛，呼吸困难并出冷汗" }),
});
assert.equal(chat.status, 200, "published-origin API access");
const answer = await chat.json();
assert.equal(answer.mode, "local");
assert.equal(answer.answer.urgent, true);
const rejected = await request("/api/health/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://untrusted.example",
  },
  body: JSON.stringify({ question: "test" }),
});
assert.equal(rejected.status, 403, "untrusted origin rejected");
console.log(
  "Smoke checks passed: frontend, API, model, decoder, local reply and origin policy.",
);
