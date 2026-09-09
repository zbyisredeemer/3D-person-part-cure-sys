export const organSystems: Record<string, string> = {
  brain: "nervous",
  eyes: "nervous",
  ears: "nervous",
  nose: "respiratory",
  mouth: "digestive",
  teeth: "digestive",
  heart: "circulatory",
  lungs: "respiratory",
  trachea: "respiratory",
  esophagus: "digestive",
  liver: "digestive",
  stomach: "digestive",
  gallbladder: "digestive",
  pancreas: "digestive",
  "small-intestine": "digestive",
  "large-intestine": "digestive",
  kidneys: "urinary",
  ureters: "urinary",
  bladder: "urinary",
  bones: "skeletal",
  muscles: "muscular",
  vessels: "circulatory",
  nerves: "nervous",
};

export const organColors: Record<string, string> = {
  brain: "#c7818d",
  eyes: "#bed8db",
  ears: "#d5aaa0",
  nose: "#dbaaa0",
  mouth: "#ba7e82",
  teeth: "#eeeee4",
  heart: "#ac465b",
  lungs: "#c68e9e",
  trachea: "#c6c9c3",
  esophagus: "#cb9796",
  liver: "#8c5049",
  stomach: "#d09481",
  gallbladder: "#8eaf8d",
  pancreas: "#d8ba91",
  "small-intestine": "#ca927f",
  "large-intestine": "#bb877b",
  kidneys: "#a4555d",
  ureters: "#d9ba9b",
  bladder: "#d3b190",
  bones: "#dfd4bc",
  muscles: "#ac716b",
  vessels: "#b3606b",
  nerves: "#c4b372",
};

export const organNames: Record<string, string> = {
  brain: "大脑",
  eyes: "眼睛",
  ears: "耳朵",
  nose: "鼻腔",
  mouth: "口腔",
  teeth: "牙齿",
  heart: "心脏",
  lungs: "肺部",
  trachea: "气管",
  esophagus: "食管",
  liver: "肝脏",
  stomach: "胃",
  gallbladder: "胆囊",
  pancreas: "胰腺",
  "small-intestine": "小肠",
  "large-intestine": "大肠",
  kidneys: "肾脏",
  ureters: "输尿管",
  bladder: "膀胱",
  bones: "骨骼系统",
  muscles: "肌肉系统",
  vessels: "血管系统",
  nerves: "神经系统",
};

export function identifyOrgan(name: string, source: string): string {
  const n = name.toLowerCase().replaceAll("_", " ");
  if (source === "skin") return "skin";
  if (source === "muscular") return "muscles";
  if (source === "bones")
    return /incisor|canine|premolar|molar/.test(n) ? "teeth" : "bones";
  if (source === "heart")
    return /aorta|vena cava|pulmonary trunk/.test(n) ? "vessels" : "heart";
  if (source === "cardiovascular")
    return /^(right atrium|right ventricle|left atrium|left ventricle)/.test(n)
      ? "heart"
      : "vessels";
  if (source === "head" || source === "nervous") {
    if (
      /spinal cord|spinocerebellar|spinothalamic|spinotectal|spinal nerve|spinal ganglion/.test(
        n,
      )
    )
      return "nerves";
    if (/sclera|iris|cornea|eyeball|retina|lens|vitreous|zonular/.test(n))
      return "eyes";
    if (/auricle|cochlea|ear|auditory|vestibul/.test(n)) return "ears";
    if (
      source === "head" ||
      /gyrus|gyri|sulcus|sulci|cereb|vermis|lobule|cortex|thalam|hypothalam|telenceph|medulla|pons/.test(
        n,
      )
    )
      return "brain";
    return "nerves";
  }
  if (/lobe of .*lung/.test(n)) return "lungs";
  if (/bronch|trachea|epiglott/.test(n)) return "trachea";
  if (/oesophag|esophag/.test(n)) return "esophagus";
  if (/liver/.test(n)) return "liver";
  if (/gallbladder|bile duct/.test(n)) return "gallbladder";
  if (/pancrea/.test(n)) return "pancreas";
  if (/stomach/.test(n)) return "stomach";
  if (/jejunum|ileum|duodenum/.test(n)) return "small-intestine";
  if (/colon|taenia|appendix|rectum/.test(n)) return "large-intestine";
  if (/kidney|renal pelvis|suprarenal/.test(n)) return "kidneys";
  if (/ureter/.test(n)) return "ureters";
  if (/bladder|urethra/.test(n)) return "bladder";
  if (/nasal|nasopharynx/.test(n)) return "nose";
  return "mouth";
}
