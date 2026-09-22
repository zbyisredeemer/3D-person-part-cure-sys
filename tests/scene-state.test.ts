import assert from "node:assert/strict";
import test from "node:test";
import {
  createSourceLoader,
  optionalAnatomySources,
  sameLabels,
  type ProjectedLabel,
} from "../src/components/anatomy/sceneState";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("anatomy source loads share in-flight work and retain successful models", async () => {
  const response = deferred();
  let requests = 0;
  const loader = createSourceLoader(() => {
    requests++;
    return response.promise;
  }, () => {});
  assert.equal(loader.status("muscular"), "idle");
  const first = loader.load("muscular");
  assert.equal(loader.status("muscular"), "loading");
  assert.equal(loader.load("muscular"), first);
  response.resolve();
  await first;
  assert.equal(loader.status("muscular"), "ready");
  assert.equal(loader.load("muscular"), first);
  await loader.retry("muscular");
  assert.equal(requests, 1);
});

test("a failed optional model waits for explicit retry while other sources finish", async () => {
  const failures = deferred();
  const vessels = deferred();
  const attempts = new Map<string, number>();
  const events: string[] = [];
  const loader = createSourceLoader((source) => {
    const count = (attempts.get(source) || 0) + 1;
    attempts.set(source, count);
    if (source === "muscular") return count === 1 ? failures.promise : Promise.resolve();
    return vessels.promise;
  }, () => {
    events.push(`${loader.status("muscular")}/${loader.status("cardiovascular")}`);
  });
  const muscle = loader.load("muscular");
  const vascular = loader.load("cardiovascular");
  failures.reject(new Error("connection interrupted"));
  await assert.rejects(muscle, /connection interrupted/);
  assert.equal(loader.status("muscular"), "error");
  assert.equal(loader.status("cardiovascular"), "loading");
  assert.equal(loader.load("muscular"), muscle);
  await assert.rejects(loader.load("muscular"));
  vessels.resolve();
  await vascular;
  assert.equal(attempts.get("muscular"), 1);
  await loader.retry("muscular");
  assert.equal(loader.status("muscular"), "ready");
  assert.equal(loader.status("cardiovascular"), "ready");
  assert.equal(attempts.get("muscular"), 2);
  assert.equal(attempts.get("cardiovascular"), 1);
  assert.ok(events.includes("error/loading"));
  assert.ok(events.includes("loading/ready"));
});

test("only active optional layers contribute loading and error feedback", async () => {
  assert.deepEqual(optionalAnatomySources({ skin: true, organs: true }), []);
  assert.deepEqual(optionalAnatomySources({ nerves: true }), ["nervous", "cranial"]);
  const loader = createSourceLoader(() => Promise.reject(new Error("offline")), () => {});
  await assert.rejects(loader.load("muscular"));
  const visibleErrors = (layers: Record<string, boolean>) =>
    optionalAnatomySources(layers).filter((source) => loader.status(source) === "error");
  assert.deepEqual(visibleErrors({ muscles: true }), ["muscular"]);
  assert.deepEqual(visibleErrors({ muscles: false, nerves: true }), []);
});

test("labels skip hidden and subpixel updates but preserve selection and visible movement", () => {
  const label: ProjectedLabel = {
    id: "heart", x: 20, y: 30, anchorX: 40, anchorY: 50,
    left: false, selected: true,
  };
  assert.equal(sameLabels([], []), true);
  assert.equal(sameLabels([label], [{ ...label }]), true);
  assert.equal(sameLabels([label], [{ ...label, anchorY: 50.2 }]), true);
  assert.equal(sameLabels([label], [{ ...label, anchorY: 50.6 }]), false);
  assert.equal(sameLabels([label], [{ ...label, selected: false }]), false);
  assert.equal(sameLabels([label], [{ ...label, id: "lungs" }]), false);
  assert.equal(sameLabels([label], []), false);
});
