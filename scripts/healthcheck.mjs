try {
  const base = `http://127.0.0.1:${process.env.API_PORT || 8787}`;
  const status = await fetch(`${base}/api/health/status`, {
    signal: AbortSignal.timeout(2000),
  });
  if (!status.ok || !["local", "online"].includes((await status.json()).mode))
    throw new Error("API is not ready");
  const page = await fetch(base, {
    method: "HEAD",
    signal: AbortSignal.timeout(2000),
  });
  if (!page.ok || !page.headers.get("content-type")?.startsWith("text/html"))
    throw new Error("Built frontend is not ready");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
