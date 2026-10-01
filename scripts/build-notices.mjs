// Preserve original and third-party licenses in redistributable builds.
import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const sections = [
  "Third-party production dependencies installed for this build. Inclusion does not imply every package is used at runtime.",
  "Anatomical assets have separate terms: see /NOTICE.txt and /models/ATTRIBUTION.md.",
];
for (const [directory, metadata] of Object.entries(lock.packages).sort()) {
  if (!directory || metadata.dev) continue;
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" && metadata.optional) continue;
    throw error;
  }
  const names = entries
    .filter((entry) => entry.isFile() && /^(licen[sc]e|copying|notice)([.-]|$)/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  sections.push(`\n===== ${pkg.name}@${pkg.version} (${metadata.license || pkg.license || "see package"}) =====`);
  if (!names.length) {
    const fallback = {
      "@mediapipe/tasks-vision": "mediapipe",
      "@react-three/fiber": "react-three-fiber",
      draco3d: "draco3d",
      maath: "maath",
      "stats-gl": "stats-gl",
    }[pkg.name];
    if (!fallback) throw new Error(`No license text found for ${directory}`);
    sections.push(await readFile(`licenses/${fallback}.txt`, "utf8"));
  }
  for (const name of names) sections.push(await readFile(join(directory, name), "utf8"));
}
await writeFile("dist/THIRD_PARTY_NOTICES.txt", sections.join("\n\n") + "\n");
for (const name of ["LICENSE", "NOTICE"]) await copyFile(name, `dist/${name}.txt`);
console.log("License notices copied to dist.");
