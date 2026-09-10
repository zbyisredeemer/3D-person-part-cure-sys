import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  HUMAN_ATLAS_REVISION,
  mapAtlasPart,
  type AtlasPart,
  type AtlasGroup,
} from "../src/components/anatomy/humanAtlas";

const upstream = process.argv[2];
if (!upstream)
  throw new Error(
    "Usage: npx tsx scripts/import-human-atlas.ts <human-atlas checkout>",
  );
const root = resolve(upstream, "public/models");
const output = resolve("public/models/human-atlas");
const expectedManifestSha =
  "c359f4bcd2cba90b7411d66d5e9fc04dc81294d46cd5c1e8b212c824f2e5bbee";
if (
  createHash("sha256")
    .update(readFileSync(resolve(root, "atlas.json")))
    .digest("hex") !== expectedManifestSha
) {
  throw new Error(
    `Use the reviewed Human Atlas revision ${HUMAN_ATLAS_REVISION}`,
  );
}
const atlas = JSON.parse(readFileSync(resolve(root, "atlas.json"), "utf8")) as {
  parts: AtlasPart[];
  chunks: { gzip: string; bytes: number }[];
};
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const buffers = atlas.chunks.map((chunk) => {
  const binary = gunzipSync(
    readFileSync(resolve(root, chunk.gzip.split("/").pop()!)),
  );
  if (binary.length !== chunk.bytes)
    throw new Error(`Invalid chunk: ${chunk.gzip}`);
  return binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength,
  ) as ArrayBuffer;
});
type Batch = AtlasGroup & {
  parts: AtlasPart[];
  geometries: THREE.BufferGeometry[];
};
const batches = new Map<string, Batch>();
const omitted: { id: string; name: string; system: string }[] = [];
for (const part of atlas.parts) {
  const mapping = mapAtlasPart(part);
  if (!mapping) {
    omitted.push({ id: part.id, name: part.name, system: part.system });
    continue;
  }
  const key = `${mapping.source}/${mapping.organ}/${mapping.variant || "default"}`;
  const batch = batches.get(key) || { ...mapping, parts: [], geometries: [] };
  const buffer = buffers[part.chunk];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array(buffer, part.positions, part.vertexCount * 3).slice(),
      3,
    ),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      new Int16Array(buffer, part.normals, part.vertexCount * 3).slice(),
      3,
      true,
    ),
  );
  geometry.setIndex(
    new THREE.BufferAttribute(
      new Uint32Array(buffer, part.indices, part.indexCount).slice(),
      1,
    ),
  );
  batch.parts.push(part);
  batch.geometries.push(geometry);
  batches.set(key, batch);
}

mkdirSync(output, { recursive: true });
const assets = [];
for (const source of new Set([...batches.values()].map((b) => b.source))) {
  const binary: Buffer[] = [];
  const views: object[] = [],
    accessors: object[] = [],
    nodes: object[] = [],
    meshes: object[] = [];
  let offset = 0,
    triangles = 0,
    partCount = 0;
  const accessor = (
    array: Float32Array | Int16Array | Uint32Array,
    size: number,
    componentType: number,
    extra = {},
  ) => {
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      binary.push(Buffer.alloc(padding));
      offset += padding;
    }
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const bufferView = views.length;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    binary.push(bytes);
    offset += bytes.length;
    const id = accessors.length;
    accessors.push({
      bufferView,
      componentType,
      count: array.length / size,
      type: size === 1 ? "SCALAR" : "VEC3",
      ...extra,
    });
    return id;
  };
  for (const batch of [...batches.values()].filter(
    (b) => b.source === source,
  )) {
    const geometry = mergeGeometries(batch.geometries);
    if (!geometry) throw new Error(`Could not merge ${source}/${batch.organ}`);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const position = accessor(
      geometry.getAttribute("position").array as Float32Array,
      3,
      5126,
      { min: bounds.min.toArray(), max: bounds.max.toArray() },
    );
    const normal = accessor(
      geometry.getAttribute("normal").array as Int16Array,
      3,
      5122,
      { normalized: true },
    );
    const indices = accessor(new Uint32Array(geometry.index!.array), 1, 5125);
    const parts = batch.parts.map((p) => ({
      id: p.id,
      name: p.name,
      conceptId: p.conceptId,
      system: p.system,
      vertexCount: p.vertexCount,
      indexCount: p.indexCount,
      geometrySha256: hash(
        Buffer.concat([
          Buffer.from(buffers[p.chunk], p.positions, p.vertexCount * 12),
          Buffer.from(buffers[p.chunk], p.normals, p.vertexCount * 6),
          Buffer.from(buffers[p.chunk], p.indices, p.indexCount * 4),
        ]),
      ),
    }));
    nodes.push({
      name: `${batch.organ}-${batch.variant || "surface"}`,
      mesh: meshes.length,
      extras: {
        organ: batch.organ,
        source,
        variant: batch.variant,
        atlasParts: parts,
      },
    });
    meshes.push({
      primitives: [
        { attributes: { POSITION: position, NORMAL: normal }, indices },
      ],
    });
    triangles += geometry.index!.count / 3;
    partCount += parts.length;
    geometry.dispose();
    batch.geometries.forEach((g) => g.dispose());
  }
  const padding = (4 - (offset % 4)) % 4;
  if (padding) {
    binary.push(Buffer.alloc(padding));
    offset += padding;
  }
  const document = {
    asset: {
      version: "2.0",
      generator: "Zhiti Human Atlas importer",
      copyright: "BodyParts3D, DBCLS, CC BY 4.0",
      extras: {
        upstreamRevision: HUMAN_ATLAS_REVISION,
        sourceParts: partCount,
      },
    },
    extensionsUsed: ["KHR_mesh_quantization"],
    extensionsRequired: ["KHR_mesh_quantization"],
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: offset }],
  };
  const json = Buffer.from(JSON.stringify(document));
  const jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + jsonPad.length + offset, 8);
  header.writeUInt32LE(json.length + jsonPad.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(offset, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([header, json, jsonPad, binaryHeader, ...binary]);
  const compressed = gzipSync(glb, { level: 9 });
  const file = `${source}.glb.gz`;
  writeFileSync(resolve(output, file), compressed);
  assets.push({
    source,
    file,
    bytes: compressed.length,
    uncompressedBytes: glb.length,
    sha256: hash(compressed),
    meshes: nodes.length,
    sourceParts: partCount,
    triangles,
  });
  console.log(
    `${file}: ${partCount} structures, ${nodes.length} draw batches, ${(compressed.length / 1e6).toFixed(2)} MB`,
  );
}
writeFileSync(
  resolve(output, "manifest.json"),
  JSON.stringify(
    {
      source: "https://github.com/ashemag/human-atlas",
      revision: HUMAN_ATLAS_REVISION,
      dataset: "BodyParts3D 4.0",
      license: "CC BY 4.0",
      upstreamManifestSha256: hash(readFileSync(resolve(root, "atlas.json"))),
      sourceParts: atlas.parts.length,
      importedParts: assets.reduce((sum, a) => sum + a.sourceParts, 0),
      coordinateTranslation: [0, 0, -0.013],
      assets,
      omitted,
      supplements: [
        "../skin-neutral.glb: retained neutral exterior",
        "../organs.glb: lung surfaces only",
        "../nervous.glb: spinal and peripheral nerves below the cranial region",
      ],
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  resolve(output, "UPSTREAM-ATTRIBUTION.md"),
  readFileSync(resolve(upstream, "public/ATTRIBUTION.md")),
);
writeFileSync(
  resolve(output, "HUMAN-ATLAS-LICENSE.txt"),
  readFileSync(resolve(upstream, "LICENSE")),
);
