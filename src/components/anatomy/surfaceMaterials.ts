import * as THREE from "three";
import { organColors } from "./organMapping";

// Display shading only: the measured anatomical surfaces are never displaced.
export function createAnatomicalMaterial(organ: string, source: string) {
  const skin = source === "skin";
  const hardTissue = source === "bones";
  const roughness: Record<string, number> = {
    brain: 0.64,
    lungs: 0.58,
    heart: 0.4,
    liver: 0.38,
    stomach: 0.46,
    kidneys: 0.43,
    muscles: 0.7,
    nerves: 0.61,
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: skin ? "#91acb9" : organColors[organ] || "#bbc6cc",
    roughness: skin ? 0.55 : hardTissue ? 0.72 : roughness[organ] || 0.51,
    metalness: 0,
    clearcoat: skin ? 0.08 : hardTissue ? 0 : 0.12,
    clearcoatRoughness: 0.52,
    envMapIntensity: skin ? 0.45 : 0.3,
    side: THREE.FrontSide,
  });
  const selected = { value: 0 };
  material.userData.selection = selected;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.atlasSelected = selected;
    shader.fragmentShader = `uniform float atlasSelected;\n${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
       float atlasRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
       totalEmissiveRadiance += vec3(0.08, 0.3, 0.32) * atlasRim * atlasSelected * 0.4;`,
    );
  };
  material.customProgramCacheKey = () => "atlas-anatomical-surface-v2";
  return material;
}
