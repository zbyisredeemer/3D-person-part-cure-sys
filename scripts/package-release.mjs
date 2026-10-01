// Assemble an explicit allowlist: never archive the working tree or .env files.
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error("Expected a stable semver version");
const name = `zhiti-atlas-${pkg.version}`;
const output = resolve("artifacts/releases");
const temp = await mkdtemp(join(tmpdir(), "atlas-package-"));
try {
  const folder = join(temp, name);
  await mkdir(folder);
  for (const path of ["dist", "dist-server", "LICENSE", "NOTICE", "SECURITY.md", ".env.example"]) {
    await cp(path, join(folder, path), { recursive: true });
  }
  await mkdir(join(folder, "docs"));
  for (const doc of ["PRIVACY.md", "DEPLOYMENT.md"]) {
    await cp(`docs/${doc}`, join(folder, "docs", doc));
  }
  await writeFile(join(folder, "start.mjs"), `import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL(".", import.meta.url)));
await import("./dist-server/index.cjs");
`);
  await writeFile(join(folder, "package.json"), JSON.stringify({
    name: pkg.name, version: pkg.version, private: true, type: "module",
    engines: pkg.engines, scripts: { start: "node start.mjs" },
  }, null, 2) + "\n");
  await writeFile(join(folder, "README.txt"), `知体 Atlas ${pkg.version} / Ready-to-run release

Requires Node.js 22.12+ (22 or 24 recommended). No npm install or build required.
需要 Node.js 22.12+，无需安装 npm 依赖、无需重新构建。

Run / 启动：node start.mjs
Open / 访问：http://127.0.0.1:8787
Stop / 停止：Ctrl+C

You can also invoke start.mjs by absolute path from another directory.
也可从任意目录使用 start.mjs 的绝对路径启动。

Default: local education mode, no API key. To configure online AI, copy
.env.example to .env in this extracted folder, edit privately, then restart.
默认本地科普模式。可复制 .env.example 为本目录的 .env，填写配置后重启。
Read SECURITY.md before public deployment. Never expose a paid AI key without
authentication, quotas and a spending limit at your gateway.

Original application code: MIT. Bundled anatomical assets retain their own
licenses, including upstream noncommercial component notices. The complete
asset bundle is NOT universally cleared for commercial use.
See NOTICE, dist/models/ATTRIBUTION.md and dist/THIRD_PARTY_NOTICES.txt.

Educational demonstration only; not a diagnostic or clinical product.
科普演示，不能替代医生诊断或治疗。素材不承诺全部可商用。

Source: https://github.com/zbyisredeemer/3D-person-part-cure-sys
`);
  await mkdir(output, { recursive: true });
  const archive = join(output, `${name}.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", temp, name]);
  const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
  await writeFile(`${archive}.sha256`, `${digest}  ${name}.tar.gz\n`);
  console.log(`Release package: ${archive}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
