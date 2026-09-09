import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isExcludedEducationalMesh } from "../src/components/anatomy/neutralPresentation";

function model(name: string) {
  const raw = readFileSync(
    fileURLToPath(new URL(`../public/models/${name}.glb`, import.meta.url)),
  );
  assert.equal(raw.toString("utf8", 0, 4), "glTF");
  assert.equal(raw.readUInt32LE(8), raw.length);
  const jsonLength = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLength).toString());
  return { raw, json, binary: raw.subarray(28 + jsonLength) };
}

function skin(name: string) {
  const asset = model(name);
  const primitive = asset.json.meshes[0].primitives[0];
  const pa = asset.json.accessors[primitive.attributes.POSITION];
  const pv = asset.json.bufferViews[pa.bufferView];
  const ia = asset.json.accessors[primitive.indices];
  const iv = asset.json.bufferViews[ia.bufferView];
  assert.equal(pa.componentType, 5126);
  assert.equal(ia.componentType, 5125);
  const positions = new Float32Array(pa.count * 3);
  const indices = new Uint32Array(ia.count);
  for (let i = 0; i < positions.length; i++)
    positions[i] = asset.binary.readFloatLE(
      (pv.byteOffset || 0) + (pa.byteOffset || 0) + i * 4,
    );
  for (let i = 0; i < indices.length; i++)
    indices[i] = asset.binary.readUInt32LE(
      (iv.byteOffset || 0) + (ia.byteOffset || 0) + i * 4,
    );
  return { ...asset, positions, indices };
}

test("neutral presentation removes actual reproductive structures and their sanitized names", () => {
  const cases: Array<[string, string]> = [
    ["Urethra.001", "organs"],
    ["Urethra001", "visceral"],
    ["Deep artery of penis.l.001", "cardiovascular"],
    ["Dorsal_artery_of_penisl001", "cardiovascular"],
    ["Right testicular vein.001", "cardiovascular"],
    ["Internal pudendal artery.r.001", "cardiovascular"],
    ["Corpus cavernosum of penis.001", "visceral"],
    ["Corpus_spongiosum_of_penis001", "visceral"],
    ["Genital branch of genitofemoral nerve.r.001", "nervous"],
    ["Pudendal_nervel001", "nervous"],
    ["Prostate.001", "visceral"],
    ["Seminal gland.l.001", "visceral"],
    ["Ductus deferens.r.001", "visceral"],
  ];
  for (const [name, source] of cases)
    assert.equal(isExcludedEducationalMesh(name, source), true, name);
});

test("urinary function, pelvic support and similarly named brain structures are preserved", () => {
  const cases: Array<[string, string]> = [
    ["Urinary bladder.001", "organs"],
    ["Kidney.l.001", "organs"],
    ["Ureter.r.001", "organs"],
    ["Renal pelvis.l.001", "organs"],
    ["Pubic bone.l.001", "bones"],
    ["Ischium.r.001", "bones"],
    ["Sacrum.001", "bones"],
    ["Pubococcygeus muscle.l.001", "muscular"],
    ["Iliococcygeus muscle.r.001", "muscular"],
    ["Corpus callosum.001", "nervous"],
    ["Cavernous sinus.l.001", "cardiovascular"],
    ["Anterior intercavernous sinus.001", "cardiovascular"],
    ["Femoral branch of genitofemoral nerve.r.001", "nervous"],
    ["Genitofemoral nerve.l.001", "nervous"],
    ["Inferior labial artery.r.001", "cardiovascular"],
    ["Intramural urethra.001", "organs"],
    ["Urethra.001", "unrelated-reference"],
  ];
  for (const [name, source] of cases)
    assert.equal(isExcludedEducationalMesh(name, source), false, name);
});

test("filter covers the audited bundled model leaks across every optional layer", () => {
  const expected: Record<string, number> = {
    organs: 1,
    muscular: 0,
    cardiovascular: 20,
    nervous: 4,
  };
  for (const [source, count] of Object.entries(expected)) {
    const nodes = model(source).json.nodes as Array<{
      mesh?: number;
      name: string;
    }>;
    const excluded = nodes.filter(
      (n) => n.mesh !== undefined && isExcludedEducationalMesh(n.name, source),
    );
    assert.equal(
      excluded.length,
      count,
      `Unexpected presentation-policy change in ${source}`,
    );
  }
});

test("neutral skin is finite, preserves topology and leaves all geometry outside the local regions intact", () => {
  const original = skin("skin");
  const neutral = skin("skin-neutral");
  const metadata = neutral.json.asset.extras.neutralPresentation;
  assert.equal(
    metadata.sourceSha256,
    createHash("sha256").update(original.raw).digest("hex"),
  );
  assert.equal(original.positions.length, neutral.positions.length);
  assert.deepEqual(
    neutral.indices,
    original.indices,
    "All source connectivity must remain intact",
  );
  const edges = new Map<number, number>();
  const vertexCount = original.positions.length / 3;
  let changed = 0;
  let changedGroin = 0;
  let changedChest = 0;
  let coreSamples = 0;
  for (let i = 0; i < original.positions.length; i += 3) {
    const [x, y, z] = original.positions.slice(i, i + 3);
    const [nx, ny, nz] = neutral.positions.slice(i, i + 3);
    assert.ok(
      Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz),
    );
    assert.equal(nx, x, "Transverse shape is unchanged");
    const groin = Math.abs(x) < 0.064 && y > 0.725 && y < 0.92 && z > -0.005;
    const chest =
      z > 0.03 &&
      ((x + 0.106) ** 2 + (y - 1.274) ** 2 < 0.019 ** 2 ||
        (x - 0.106) ** 2 + (y - 1.274) ** 2 < 0.019 ** 2);
    const modified = x !== nx || y !== ny || z !== nz;
    if (modified) {
      assert.ok(
        groin || chest,
        `Unexpected displacement outside local regions at vertex ${i / 3}`,
      );
      changed++;
      if (groin) changedGroin++;
      if (chest) {
        changedChest++;
        assert.ok(Math.abs(z - nz) <= 0.0027);
      }
    }
    if (Math.abs(x) < 0.017 && y > 0.77 && y < 0.825 && z > 0.04) {
      coreSamples++;
      assert.ok(
        ny >= 0.827 && nz < 0.045,
        "Original anterior protrusion was not sufficiently attenuated",
      );
    }
  }
  assert.ok(coreSamples > 100);
  assert.equal(changed, metadata.modifiedVertices);
  assert.equal(changedGroin, metadata.groinModifiedVertices);
  assert.equal(changedChest, metadata.chestModifiedVertices);
  assert.ok(changed / vertexCount < 0.06, "Modification should remain local");
  for (let i = 0; i < neutral.indices.length; i += 3) {
    const a = neutral.indices[i],
      b = neutral.indices[i + 1],
      c = neutral.indices[i + 2];
    assert.ok(a < vertexCount && b < vertexCount && c < vertexCount);
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = Math.min(u, v) * vertexCount + Math.max(u, v);
      edges.set(key, (edges.get(key) || 0) + 1);
    }
    const p = neutral.positions;
    const u = [
      p[b * 3] - p[a * 3],
      p[b * 3 + 1] - p[a * 3 + 1],
      p[b * 3 + 2] - p[a * 3 + 2],
    ];
    const v = [
      p[c * 3] - p[a * 3],
      p[c * 3 + 1] - p[a * 3 + 1],
      p[c * 3 + 2] - p[a * 3 + 2],
    ];
    assert.ok(
      Math.hypot(
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ) > 0,
      "Degenerate triangle",
    );
  }
  const counts = [...edges.values()];
  assert.equal(
    counts.filter((n) => n === 1).length,
    1512,
    "Preserve existing source boundaries",
  );
  assert.equal(
    counts.filter((n) => n > 2).length,
    0,
    "Do not introduce non-manifold edges",
  );
});
