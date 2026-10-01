import "dotenv/config";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import {
  answerHealthQuestion,
  HealthServiceError,
  isOnline,
} from "./health-service";

const config = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL,
  baseUrl: process.env.OPENAI_BASE_URL,
};
const port = Number(process.env.API_PORT || 8787);
const host = process.env.API_HOST || "127.0.0.1";
const root = resolve("dist");
const origins = new Set(
  (
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787"
  )
    .split(",")
    .map((s) => s.trim()),
);
const limits = new Map<string, { count: number; expires: number }>();
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const json = (status: number, value: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  };
  try {
    let path: string;
    let decodedPath: string;
    try {
      path = new URL(req.url || "/", "http://localhost").pathname;
      decodedPath = decodeURIComponent(path);
      if (decodedPath.includes("\0")) throw new Error("Invalid path");
    } catch {
      json(400, { error: "请求路径无效。" });
      return;
    }
    if (path === "/api/health/status") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");
        json(405, { error: "仅支持 GET 或 HEAD 请求。" });
        return;
      }
      json(200, { mode: isOnline(config) ? "online" : "local" });
      return;
    }
    if (path === "/api/health/chat") {
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        json(405, { error: "仅支持 POST 请求。" });
        return;
      }
      if (req.headers.origin && !origins.has(req.headers.origin)) {
        json(403, { error: "请求来源不被允许。" });
        return;
      }
      if (req.headers["sec-fetch-site"] === "cross-site") {
        json(403, { error: "不接受跨站请求。" });
        return;
      }
      if (
        req.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase() !==
        "application/json"
      ) {
        json(415, { error: "请使用 JSON 格式。" });
        return;
      }
      const now = Date.now();
      for (const [key, item] of limits)
        if (item.expires < now) limits.delete(key);
      const address = req.socket.remoteAddress || "local";
      const limit = limits.get(address) || { count: 0, expires: now + 60000 };
      limit.count++;
      limits.set(address, limit);
      if (limit.count > 20) {
        res.setHeader("Retry-After", "60");
        json(429, { error: "提问过于频繁，请稍后再试。" });
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 8192) {
          json(413, { error: "请求内容过长。" });
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        json(400, { error: "问题格式无效。" });
        return;
      }
      json(200, await answerHealthQuestion(body, config));
      return;
    }
    if (path.startsWith("/api/")) {
      json(404, { error: "接口不存在。" });
      return;
    }
    if (!["GET", "HEAD"].includes(req.method || "")) {
      res.setHeader("Allow", "GET, HEAD");
      json(405, { error: "此路径不支持该请求。" });
      return;
    }
    let filename = resolve(root, `.${decodedPath}`);
    if (!filename.startsWith(root + sep) && filename !== root) {
      json(403, { error: "路径无效。" });
      return;
    }
    if (path === "/" || !extname(path)) filename = resolve(root, "index.html");
    let file;
    try {
      file = await stat(filename);
    } catch {
      json(404, { error: "文件未找到。请先运行 npm run build。" });
      return;
    }
    if (!file.isFile()) {
      json(404, { error: "文件未找到。" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(filename)] || "application/octet-stream",
      "Content-Length": file.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control":
        extname(filename) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filename)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch (error) {
    if (!res.headersSent)
      json(error instanceof HealthServiceError ? error.status : 500, {
        error:
          error instanceof HealthServiceError
            ? error.message
            : "服务暂时不可用，请稍后重试。",
      });
    else res.end();
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
server.listen(port, host, () => {
  const address = server.address();
  if (!address || typeof address === "string") return;
  console.log(
    `Atlas API: http://${host}:${address.port} (${isOnline(config) ? "online AI" : "local education"})`,
  );
  // An IPC parent can verify this exact process is listening, without port polling.
  process.send?.({ type: "atlas:ready", port: address.port });
});
