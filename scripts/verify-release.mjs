import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyProduction } from "./verify-production.mjs";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const name = `zhiti-atlas-${version}`;
const archive = resolve(`artifacts/releases/${name}.tar.gz`);
const expected = (await readFile(`${archive}.sha256`, "utf8")).split(" ")[0];
assert.equal(createHash("sha256").update(await readFile(archive)).digest("hex"), expected);
const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
for (const entry of entries) {
  assert.ok(entry.startsWith(`${name}/`), "archive paths stay inside one directory");
  assert.ok(!entry.split("/").includes(".."));
  assert.ok(!/(^|\/)(node_modules|\.git|\.env)(\/|$)/.test(entry), "no dependencies, Git history or secrets");
}
for (const file of ["start.mjs", "dist/index.html", "dist-server/index.cjs", "dist/LICENSE.txt", "dist/NOTICE.txt", "dist/THIRD_PARTY_NOTICES.txt"]) {
  assert.ok(entries.includes(`${name}/${file}`), `release contains ${file}`);
}
const temp = await mkdtemp(join(tmpdir(), "atlas-release-check-"));
try {
  execFileSync("tar", ["-xzf", archive, "-C", temp]);
  // Deliberately launch outside the extracted project; no node_modules are present.
  await verifyProduction(join(temp, name, "start.mjs"), temp);
  console.log("Release checksum, contents and standalone startup verified.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
