import { isExcludedEducationalMesh } from "./neutralPresentation";

export const HUMAN_ATLAS_REVISION = "1c38bf35c254a891200d3cedecfd57abebe83d8d";

export interface AtlasPart {
  id: string;
  name: string;
  conceptId: string;
  system: string;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface AtlasGroup {
  organ: string;
  source: string;
  variant?: string;
}

// Classify the source structures explicitly: upstream display systems also contain
// brain ventricles in cardiac, liver segments in venous, and lacrimal bones in sensory.
export function mapAtlasPart(part: AtlasPart): AtlasGroup | null {
  const n = part.name.toLowerCase();
  const group = (organ: string, source = "organs", variant?: string) => ({
    organ,
    source,
    variant,
  });
  if (part.system === "reproductive" || isExcludedEducationalMesh(n, "organs"))
    return null;
  if (/hepatovenous segment|caudate lobe of liver/.test(n))
    return group("liver");
  if (
    /third ventricle|fourth ventricle|lateral ventricle|interventricular foramen|choroid plexus/.test(
      n,
    )
  )
    return group("brain", "head");
  if (
    part.system === "cardiac" ||
    /papillary muscle|coronary|cardiac vein|coronary sinus/.test(n)
  )
    return group("heart", "heart");
  if (part.system === "arterial" || part.system === "venous")
    return group("vessels", "cardiovascular", part.system);
  if (part.system === "nervous") {
    if (/nerve|ganglion|spinal cord/.test(n)) return group("nerves", "nervous");
    return group("brain", "head");
  }
  if (/tooth/.test(n)) return group("teeth", "bones");
  if (/gingiva/.test(n)) return group("mouth");
  if (/nasal (cartilage|concha)/.test(n)) return group("nose");
  if (part.system === "skeletal" || /lacrimal bone/.test(n)) {
    const upper = (part.bounds[0][1] + part.bounds[1][1]) / 2 > 1.08;
    return group("bones", "bones", upper ? "upper" : "lower");
  }
  if (/retinaculum/.test(n)) return group("muscles", "muscular");
  if (part.system === "sensory")
    return group(/ear/.test(n) ? "ears" : "eyes", "head");
  if (part.system === "muscular" || part.system === "connective")
    return group("muscles", "muscular");
  if (/bronch|trachea|epiglott/.test(n)) return group("trachea");
  if (/pharyn/.test(n)) return group("mouth");
  if (/esophag/.test(n)) return group("esophagus");
  if (/mesentery|mesoappendix|mesocolon/.test(n)) return null;
  if (/pancrea/.test(n)) return group("pancreas");
  if (/stomach/.test(n)) return group("stomach");
  if (/ileocecal|colon|taenia|appendix|rectum/.test(n))
    return group("large-intestine");
  if (/duodenum|ileum|jejunum/.test(n)) return group("small-intestine");
  if (/gallbladder|biliary|hepatic duct|cystic duct|duct of caudate/.test(n))
    return group("gallbladder");
  if (/tongue|sublingual|submandibular|^lip$/.test(n)) return group("mouth");
  if (/kidney/.test(n)) return group("kidneys");
  if (/ureter/.test(n)) return group("ureters");
  if (/urinary bladder/.test(n)) return group("bladder");
  return null;
}

export const INITIAL_ANATOMY_SOURCES = [
  "skin",
  "bones",
  "organs",
  "heart",
  "head",
  "lungs",
];

export function anatomyAsset(source: string) {
  const legacy: Record<string, string> = {
    skin: "skin-neutral",
    lungs: "organs",
    nervous: "nervous",
  };
  return source in legacy
    ? { url: `/models/${legacy[source]}.glb`, atlas: false }
    : {
        url: `/models/human-atlas/${source === "cranial" ? "nervous" : source}.glb.gz`,
        atlas: true,
      };
}

export async function decodeAnatomyResponse(
  response: Response,
): Promise<ArrayBuffer> {
  if (!response.ok)
    throw new Error(`Anatomy download failed: ${response.status}`);
  let buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Some hosts decompress Content-Encoding automatically; inspect bytes to avoid
  // decompressing twice when the same asset is served with different headers.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    buffer = await new Response(
      new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
  }
  if (new DataView(buffer).getUint32(0, true) !== 0x46546c67)
    throw new Error("Invalid anatomy GLB");
  return buffer;
}
