import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  anatomyAsset,
  decodeAnatomyResponse,
  HUMAN_ATLAS_REVISION,
  mapAtlasPart,
  type AtlasPart,
} from "../src/components/anatomy/humanAtlas";
import { organNames } from "../src/components/anatomy/organMapping";

const root = new URL("../public/models/human-atlas/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", root), "utf8"),
);
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
function model(file: string) {
  const compressed = readFileSync(new URL(file, root));
  const raw = gunzipSync(compressed);
  assert.equal(raw.toString("utf8", 0, 4), "glTF");
  assert.equal(raw.readUInt32LE(8), raw.length);
  const size = raw.readUInt32LE(12);
  return {
    compressed,
    raw,
    doc: JSON.parse(raw.subarray(20, 20 + size).toString()),
    binary: raw.subarray(28 + size),
  };
}

test("Human Atlas imports cover every existing organ, with explicit legacy supplements", () => {
  assert.equal(manifest.revision, HUMAN_ATLAS_REVISION);
  assert.equal(
    manifest.importedParts + manifest.omitted.length,
    manifest.sourceParts,
  );
  const organs = new Set(["lungs"]);
  const sourceIds = new Set<string>();
  for (const asset of manifest.assets) {
    const { doc } = model(asset.file);
    assert.equal(doc.nodes.length, asset.meshes);
    for (const node of doc.nodes) {
      organs.add(node.extras.organ);
      assert.ok(organNames[node.extras.organ]);
      for (const part of node.extras.atlasParts) {
        assert.ok(
          !sourceIds.has(part.id),
          `Duplicated source structure: ${part.id}`,
        );
        sourceIds.add(part.id);
        const mapping = mapAtlasPart({
          ...part,
          bounds: [
            [0, 0, 0],
            [0, 0, 0],
          ],
        });
        assert.equal(mapping?.organ, node.extras.organ, part.name);
        assert.equal(mapping?.source, node.extras.source, part.name);
      }
    }
  }
  assert.equal(sourceIds.size, manifest.importedParts);
  assert.deepEqual([...organs].sort(), Object.keys(organNames).sort());
  assert.equal(anatomyAsset("lungs").url, "/models/organs.glb");
  assert.equal(
    anatomyAsset("cranial").url,
    "/models/human-atlas/nervous.glb.gz",
  );
  assert.equal(anatomyAsset("nervous").url, "/models/nervous.glb");
});

test("repacking preserves every imported source position, normal and triangle", () => {
  for (const asset of manifest.assets) {
    const { raw, compressed, doc, binary } = model(asset.file);
    assert.equal(hash(compressed), asset.sha256, asset.file);
    assert.equal(raw.length, asset.uncompressedBytes);
    assert.equal(compressed.length, asset.bytes);
    let triangles = 0;
    for (const node of doc.nodes) {
      const primitive = doc.meshes[node.mesh].primitives[0];
      const pa = doc.accessors[primitive.attributes.POSITION];
      const na = doc.accessors[primitive.attributes.NORMAL];
      const ia = doc.accessors[primitive.indices];
      assert.equal(pa.componentType, 5126);
      assert.equal(na.componentType, 5122);
      assert.equal(na.normalized, true);
      assert.equal(ia.componentType, 5125);
      const positions = doc.bufferViews[pa.bufferView].byteOffset;
      const normals = doc.bufferViews[na.bufferView].byteOffset;
      const indices = doc.bufferViews[ia.bufferView].byteOffset;
      let vertexOffset = 0,
        indexOffset = 0;
      for (const part of node.extras.atlasParts) {
        const p = binary.subarray(
          positions + vertexOffset * 12,
          positions + (vertexOffset + part.vertexCount) * 12,
        );
        const n = binary.subarray(
          normals + vertexOffset * 6,
          normals + (vertexOffset + part.vertexCount) * 6,
        );
        const localIndices = Buffer.alloc(part.indexCount * 4);
        for (let i = 0; i < part.indexCount; i++) {
          const index =
            binary.readUInt32LE(indices + (indexOffset + i) * 4) - vertexOffset;
          assert.ok(index >= 0 && index < part.vertexCount, part.id);
          localIndices.writeUInt32LE(index, i * 4);
        }
        for (let i = 0; i < p.length; i += 12) {
          const x = p.readFloatLE(i),
            y = p.readFloatLE(i + 4),
            z = p.readFloatLE(i + 8);
          assert.ok(Number.isFinite(x + y + z), part.id);
          assert.ok(
            Math.abs(x) < 0.5 && y > -0.01 && y < 1.8 && Math.abs(z) < 0.3,
            part.id,
          );
        }
        assert.equal(
          hash(Buffer.concat([p, n, localIndices])),
          part.geometrySha256,
          `Source geometry changed: ${part.id}`,
        );
        vertexOffset += part.vertexCount;
        indexOffset += part.indexCount;
      }
      assert.equal(vertexOffset, pa.count);
      assert.equal(indexOffset, ia.count);
      triangles += ia.count / 3;
    }
    assert.equal(triangles, asset.triangles);
  }
});

test("source display misclassifications do not leak into organ selection", () => {
  function organ(name: string, system: string) {
    return mapAtlasPart({
      name,
      system,
      bounds: [
        [0, 1.5, 0],
        [0, 1.7, 0],
      ],
    } as AtlasPart)?.organ;
  }
  assert.equal(organ("Third ventricle", "cardiac"), "brain");
  assert.equal(
    organ("Choroid plexus of cerebral hemisphere", "sensory"),
    "brain",
  );
  assert.equal(organ("Hepatovenous segment VIII", "venous"), "liver");
  assert.equal(organ("Right hepatic vein", "venous"), "vessels");
  assert.equal(organ("Left lacrimal bone", "sensory"), "bones");
  assert.equal(
    organ("Flexor retinaculum of right wrist", "sensory"),
    "muscles",
  );
  assert.equal(organ("Left posterior ethmoidal nerve", "nervous"), "nerves");
  assert.equal(
    organ("Lateral papillary muscle of left ventricle", "muscular"),
    "heart",
  );
  assert.equal(organ("Urethra", "urinary"), undefined);
  assert.equal(organ("Left deferent duct", "reproductive"), undefined);
  assert.equal(organ("Urinary bladder", "urinary"), "bladder");
  assert.equal(organ("Pubic hair", "integumentary"), undefined);
});

test("model downloads handle raw GLB, gzip and hosts that already decompressed gzip", async () => {
  const { raw } = model("heart.glb.gz");
  for (const response of [
    new Response(raw),
    new Response(gzipSync(raw)),
    new Response(raw, { headers: { "Content-Encoding": "gzip" } }),
  ])
    assert.deepEqual(Buffer.from(await decodeAnatomyResponse(response)), raw);
  await assert.rejects(
    decodeAnatomyResponse(new Response("missing", { status: 404 })),
    /404/,
  );
  await assert.rejects(
    decodeAnatomyResponse(new Response("<html>not a model</html>")),
    /Invalid anatomy/,
  );
});
