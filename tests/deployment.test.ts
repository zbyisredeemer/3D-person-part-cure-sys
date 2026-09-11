import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/docker.sh", import.meta.url));
function run(action: string, settings: NodeJS.ProcessEnv = {}) {
  const temp = mkdtempSync(join(tmpdir(), "atlas-deploy-"));
  const log = join(temp, "calls");
  writeFileSync(log, "");
  writeFileSync(
    join(temp, "docker"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS_LOG"
case "$*" in
  info) exit "\${ENGINE_EXIT:-0}" ;;
  *"build atlas") exit "\${BUILD_EXIT:-0}" ;;
  *"up -d"*) exit "\${UP_EXIT:-0}" ;;
  *"port atlas 8787") printf '%s\\n' '127.0.0.1:18080' ;;
  *"ps -aq atlas") printf '%s\\n' 'test-container' ;;
esac
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(temp, "curl"),
    '#!/bin/sh\nprintf "curl %s\\n" "$*" >> "$CALLS_LOG"\nexit "${CURL_EXIT:-0}"\n',
    { mode: 0o755 },
  );
  try {
    const result = spawnSync("bash", [script, action], {
      // The wrapper must work outside the repository, including paths containing spaces.
      cwd: temp,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        CALLS_LOG: log,
        ...settings,
      },
      timeout: 10000,
    });
    return { ...result, calls: readFileSync(log, "utf8") };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("Docker wrapper handles help and invalid actions without contacting Docker", () => {
  const help = run("help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  assert.equal(help.calls, "");
  assert.equal(run("delete-everything").status, 2);
});
test("Docker wrapper builds before updating and checks the actual published port", () => {
  const result = run("up");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /-p zhiti-atlas build atlas/);
  assert.match(
    result.calls,
    /up -d --no-build --wait --wait-timeout 120 atlas/,
  );
  assert.match(
    result.calls,
    /curl .*http:\/\/127.0.0.1:18080\/api\/health\/status/,
  );
  assert.match(result.calls, /SMOKE_ORIGIN=http:\/\/127.0.0.1:18080/);
  assert.doesNotMatch(result.calls, /prune|--volumes|--remove-orphans/);
});
test("Docker wrapper preserves running deployment on build failure and never reports false readiness", () => {
  const build = run("up", { BUILD_EXIT: "1" });
  assert.notEqual(build.status, 0);
  assert.doesNotMatch(build.calls, /up -d/);
  for (const settings of [
    { ENGINE_EXIT: "1" },
    { UP_EXIT: "1" },
    { CURL_EXIT: "1" },
  ]) {
    const result = run("up", settings);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /Atlas is ready/);
  }
});
test("restart does not rebuild or recreate containers, and down stays project-scoped", () => {
  const restart = run("restart");
  assert.equal(restart.status, 0, restart.stderr);
  assert.match(restart.calls, /restart atlas/);
  assert.doesNotMatch(restart.calls, /up -d|build atlas/);
  const down = run("down");
  assert.equal(down.status, 0);
  assert.match(down.calls, /-p zhiti-atlas down/);
});
