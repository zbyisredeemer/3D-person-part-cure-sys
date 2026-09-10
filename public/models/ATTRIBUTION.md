# Anatomical model attribution and provenance

This educational demonstrator uses actual anatomical surface meshes, with simplified semantic grouping and display colors. It is not a patient-specific scan, a diagnostic device, or a clinically validated anatomy atlas. Some internal structures are intentionally hidden for legibility. Core structures now come from Human Atlas / BodyParts3D 4.0. Registration of retained Z-Anatomy supplements is approximate.

## Human Atlas / BodyParts3D 4.0 (active core, 2026-09-10)

BodyParts3D, copyright The Database Center for Life Science (DBCLS), licensed under Creative Commons Attribution 4.0 International.

- Reference project: https://github.com/ashemag/human-atlas
- Pinned revision: `1c38bf35c254a891200d3cedecfd57abebe83d8d`.
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Current dataset license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- License terms: https://creativecommons.org/licenses/by/4.0/
- Original Human Atlas attribution: `human-atlas/UPSTREAM-ATTRIBUTION.md`.
- Human Atlas application code is MIT licensed; the notice is preserved in `human-atlas/HUMAN-ATLAS-LICENSE.txt`.

The upstream dataset includes 2,234 simplified source meshes. This project imports 2,193 of them (2,167,498 triangles) into seven compressed GLBs in `human-atlas/`. The other 41 structures are omitted according to the existing neutral exterior and organ-catalog scope; the complete list is recorded in `human-atlas/manifest.json`. This is not a claim to display every upstream structure.

Adaptations in this project: regrouped surfaces into 24 organ/material batches, retained original positions, quantized normals and triangle connectivity, stored source names/FMA concepts/FJ identifiers and geometry checksums on each batch, corrected display mappings such as brain ventricles versus heart chambers and hepatovenous parenchymal segments versus veins, applied existing educational materials, and gzip-compressed the GLBs. A runtime translation of `[0, 0, -0.013]` meters reconciles the upstream BodyParts3D `-0.1` Z origin with this project's existing skin `-0.113` Z origin. The internal surfaces were not resculpted or independently scaled.

Reproduce using `node --import tsx scripts/import-human-atlas.ts /path/to/human-atlas` from the project root with the pinned upstream checkout. The importer verifies the source manifest hash. Tests compare each imported structure's positions, normals and local triangle indices against the source geometry checksum after undoing index offsets from batching.

Active supplements: `skin-neutral.glb` remains the neutral exterior described below; only lung surfaces from the legacy `organs.glb` are displayed; `nervous.glb` supplies spinal/peripheral nerve structures extending below the cranial region, while the new atlas supplies cranial nerves. The reference release lacks lung-lobe surfaces and complete peripheral nerve coverage. These supplements retain their existing licenses and are not relicensed by this addition. All other old GLBs remain as historical source assets, not the active core anatomy.

## Z-Anatomy supplements and historical meshes

“Z-Anatomy — The libre 3D atlas of anatomy — CC-BY-SA 4.0.”

- Original project: https://github.com/Z-Anatomy/Models-of-human-anatomy
- Authors: Gauthier Kervyn (design, 3D, anatomy), Marcin Zielinski (Blender tooling), Lluís Vinent (application), and the Z-Anatomy contributors.
- License: https://creativecommons.org/licenses/by-sa/4.0/
- Upstream license text is preserved as `Z-ANATOMY-LICENSE.txt`.
- GLB conversion source: https://github.com/Liyucheng1997/242_lab-human-anatomy/tree/main/public/models (retrieved 2026-09-08). Converted from Z-Anatomy `Startup.blend` using Blender and Draco compression.
- Source GLBs: `skeleton.glb`, `muscular.glb`, `cardiovascular.glb`, `nervous.glb`, and `visceral.glb`.
- Derived subsets in this project: `bones.glb`, `organs.glb`, `heart.glb`, and `head.glb`. Changes: removed diagram title meshes and unrelated structures; extracted central organs into separate files. Geometry was not resculpted. Materials are replaced at runtime with educational colors. These derived model assets are shared under CC-BY-SA 4.0, subject to applicable upstream component terms.
- `prepare_models.py` records extraction and coordinate conversion methods. It expects the original source GLBs beside it and the skin OBJ at `/tmp/anatomy-skin.obj`.

The upstream Z-Anatomy README additionally credits the following reference/included/adapted works. We preserve those notices rather than asserting that every component is commercially cleared:

- “Brainder” and “White matter” — University of Washington.
- “Cranial Nerves and Foramina” — University of Dundee, CAHID — CC-BY 4.0.
- “Anatomy of the Inner Ear” — University of Dundee School of Medicine — CC-BY-NC-SA 4.0.
- “Kidney” — Lissie Cowley — CC-BY-NC 4.0.

Upstream notices: https://github.com/Z-Anatomy/Models-of-human-anatomy#attributions

## BodyParts3D

“BodyParts3D — The Database Center for Life Science — CC-BY-SA 2.1 Japan.”

Original model by Kousaku Okubo and the Database Center for Life Science (DBCLS).

- Official project: https://lifesciencedb.jp/bp3d/
- Official download and terms: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License: https://creativecommons.org/licenses/by-sa/2.1/jp/
- Skin source: https://github.com/olivercase/body_parts_3d_api/blob/main/meshes/FJ2810_BP22617_FMA7163_Skin.obj
- Skin source header: BodyParts3D compatibility version 4.3, representation BP22617, file FJ2810, concept FMA7163, “Skin”.
- `skin.glb`: coordinate conversion from Z-up millimeters to Y-up meters, translation to approximately register with the Z-Anatomy model, computed normals at runtime. No source surface geometry was resculpted. This derived asset is shared under CC-BY-SA 2.1 Japan.

### Neutral educational exterior (2026-09-09)

`skin-neutral.glb` is a presentation derivative of the bundled `skin.glb`, licensed under **CC-BY-SA 2.1 Japan**, with the same DBCLS / BodyParts3D attribution. It is a neutral educational exterior derived from the original male-source atlas; it is **not a female model**, a sex-specific reference atlas, or a clinically validated reconstruction.

Changes are reproducible with `python3 public/models/prepare_neutral_skin.py` (NumPy required). The script reads only the bundled source asset, leaves it intact, and applies compact smooth coordinate deformation to attenuate anterior pubic/genital protrusions and fine nipple relief. No faces are deleted or overlaid. The face, hands, limbs, overall transverse body shape, and all vertices outside the defined chest/groin regions remain unchanged. The underlying organ/skeleton models are not resculpted.

- Source SHA-256: `add6b9407e9c2eb6dfee8cae3f8b64cf75a36f9d028355a5aedbf28e05f4a7bc`.
- 5,645 of 102,467 vertices changed (5,270 groin, 375 chest); 96,822 vertices (94.49%) remain byte-identical.
- Maximum local displacement: 72.68 mm; maximum nipple-region displacement: 2.62 mm. Complete measured deltas, local supports and source hash are embedded in the GLB `asset.extras.neutralPresentation` metadata.
- Topology is unchanged: 203,382 triangles, 1,512 existing boundary edges, zero non-manifold edges, zero zero-area triangles. The original has separate inner/outer skin shells and small components, so neither asset is claimed to be a single closed manifold.
- This is an educational presentation change that intentionally suppresses selected external detail. It does not increase the clinical precision of the source dataset.

The runtime presentation policy also omits the bundled complete male urethra (which includes the penile course), explicit reproductive structures, penile/testicular/pudendal vessels and genital/pudendal nerve branches. Kidneys, ureters, bladder, pelvic skeletal support, pelvic muscles and nonsexual structures such as cerebral cavernous sinuses are retained. The original source GLBs remain available for provenance; the visibility policy applies to the neutral educational view.

## Draco decoder

Self-hosted files in `draco/` are copied from the installed Three.js distribution's bundled Draco decoder. Draco is copyright Google, Apache License 2.0. See `draco/LICENSE.txt` and https://github.com/google/draco.

No model or runtime asset is requested from a third-party CDN by the running application.
