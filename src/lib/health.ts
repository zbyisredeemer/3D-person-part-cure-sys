import {
  diseases,
  organs,
  scenarios,
  type SymptomScenario,
} from "../data/medical";

export type RiskLevel = "green" | "yellow" | "red";
export interface RiskResult {
  level: RiskLevel;
  title: string;
  message: string;
  actions: string[];
}
export interface EducationalReply {
  sections: { title: string; items: string[] }[];
  urgent: boolean;
  sourceIds: string[];
}

const emergencyActions = [
  "若这些症状正在发生，请立即联系当地急救服务；中国大陆拨打 120。",
  "停止活动，在安全位置等待帮助，不要自行驾车。",
  "告知接线员症状和起始时间，遵循急救人员指示。",
];

/** An educational red-flag demonstration, not a validated triage or diagnostic score. */
export function evaluateRisk(symptomIds: string[]): RiskResult {
  const selected = new Set(symptomIds);
  const hasAny = (...ids: string[]) => ids.some((id) => selected.has(id));
  const chestWithWarning =
    selected.has("chest-pain") &&
    hasAny(
      "dyspnea",
      "cold-sweat",
      "dizziness",
      "radiating-pain",
      "severe-pain",
      "persistent-pain",
    );
  const palpitationsWithWarning =
    selected.has("palpitations") && hasAny("chest-pain", "dyspnea", "fainting");
  const backWithWarning =
    selected.has("back-pain") &&
    hasAny(
      "bladder-bowel-change",
      "leg-weakness",
      "saddle-numbness",
      "chest-pain",
    );
  const independentWarning = hasAny(
    "severe-pain",
    "severe-dyspnea",
    "fainting",
    "stroke-signs",
    "sudden-headache",
    "vomiting-blood",
    "black-stool",
  );
  const bloodCoughEmergency =
    hasAny("cough-blood", "coughing-blood", "hemoptysis") &&
    hasAny("dyspnea", "chest-pain", "large-bleeding");
  if (
    chestWithWarning ||
    palpitationsWithWarning ||
    backWithWarning ||
    independentWarning ||
    bloodCoughEmergency
  ) {
    return {
      level: "red",
      title: "危险信号 · 立即求助",
      message:
        "所选情况可能涉及需要紧急处理的健康问题。请立即寻求专业医疗评估，不要等待本演示判断病因。",
      actions: [...emergencyActions],
    };
  }
  if (hasAny("cough-blood", "coughing-blood", "hemoptysis")) {
    return {
      level: "red",
      title: "咳血 · 尽快就医",
      message:
        "即使只有少量血丝，也应尽快联系医疗机构。咳血原因需要检查后判断。",
      actions: [
        "尽快接受医疗评估，说明咳血的量和持续时间。",
        "若出血量多，或伴呼吸困难、胸痛，立即拨打当地急救电话；中国大陆为 120。",
      ],
    };
  }
  if (selected.size) {
    return {
      level: "yellow",
      title: "建议关注 · 咨询医生",
      message:
        "当前选择不足以判断病因或严重程度。症状持续、反复或加重时，应咨询医生；没有触发规则也不代表安全。",
      actions: [
        "记录发生时间、持续时长、诱因和伴随症状。",
        selected.has("dyspnea")
          ? "新出现的呼吸困难应及时就医；严重气短、无法完整说话或意识变化时立即急救。"
          : "出现持续胸痛、呼吸困难、晕厥等危险信号时立即求助。",
        "儿童、孕妇、老人或有基础病者，宜更早接受专业评估。",
      ],
    };
  }
  return {
    level: "green",
    title: "日常健康管理",
    message: "尚未选择症状。本状态用于科普演示，并不表示已排除疾病或医疗风险。",
    actions: [
      "规律作息、均衡饮食与适量活动。",
      "若身体不适，可选择症状了解危险信号，或直接联系医疗人员。",
    ],
  };
}

// Deliberately bounded local matching: never sends health text to an external service.
const terms: Record<string, RegExp> = {
  "chest-pain":
    /胸(?:口|部|前|腔)?[^，。！？；\n]{0,8}(?:痛|疼|压迫|不适)|(?:痛|疼)[^，。！？；\n]{0,5}胸|chest\s*pain/i,
  dyspnea:
    /呼吸困难|喘不过气|气短|透不过气|呼吸费力|breathless|shortness of breath/i,
  "cold-sweat": /冷汗|出汗|大汗|cold\s*sweat/i,
  dizziness: /头晕|眩晕|dizz/i,
  "radiating-pain":
    /(?:放射|蔓延).{0,12}(?:手臂|肩|背|下颌)|(?:手臂|肩|背|下颌).{0,8}放射/,
  "severe-pain": /剧烈.{0,8}(?:疼|痛)|(?:疼|痛).{0,8}剧烈|痛得受不了/,
  "persistent-pain":
    /(?:持续|一直|不缓解|不消失).{0,12}(?:疼|痛)|(?:疼|痛).{0,12}(?:持续|一直|不缓解|没有缓解|未缓解|不停|不消失)|(?:持续|一直)(?:没有|未|不)(?:缓解|消失)/,
  "severe-dyspnea": /无法呼吸|不能呼吸|喘不过气.{0,8}(?:说话|嘴唇)|嘴唇发紫/,
  "cough-blood": /咳血|咯血|咳.{0,5}血|血痰|coughing\s*(?:up\s*)?blood/i,
  fainting: /晕倒|昏厥|昏迷|失去意识|不省人事/,
  "stroke-signs": /口角歪斜|嘴歪|说话不清|言语不清|单侧.{0,4}无力/,
  "sudden-headache": /突然.{0,6}(?:剧烈|最严重).{0,4}头痛/,
  "vomiting-blood": /呕血|吐血/,
  "black-stool": /黑便|柏油样便/,
  "bladder-bowel-change": /大小便失禁|尿不出来|排尿困难|大便失禁/,
  "leg-weakness": /双腿.{0,5}(?:无力|麻木)/,
  "saddle-numbness": /会阴.{0,6}(?:麻木|感觉减退)/,
  "back-pain": /腰(?:背|部)?[疼痛]|背(?:部)?[疼痛]/,
  palpitations: /心悸|心慌|心跳(?:很快|过快|不齐)/,
  cough: /咳嗽|cough/i,
  fever: /发烧|发热|fever/i,
};

function mentioned(question: string, expression: RegExp): boolean {
  return question
    .split(/[，。！？；\n]|\bbut\b|但是|不过|但/i)
    .some((clause) => {
      const match = expression.exec(clause);
      if (!match) return false;
      // Respect explicit nearby negation; this does not attempt clinical language understanding.
      const prefix = clause.slice(Math.max(0, match.index - 10), match.index);
      return !/(?:没有|并无|无|不伴|否认|不是|not\s|no\s)(?:[^，。！？；]{0,8})$/i.test(
        prefix,
      );
    });
}

function findScenario(
  question: string,
  flags: string[],
): SymptomScenario | undefined {
  if (flags.includes("chest-pain"))
    return scenarios.find((s) => s.id === "chest-pain");
  if (/咳|喘|哮喘|cough/i.test(question))
    return scenarios.find((s) => s.id === "cough");
  if (/头[疼痛]|偏头痛|headache/i.test(question))
    return scenarios.find((s) => s.id === "headache");
  if (/腹[疼痛]|肚子|胃[疼痛]|反酸|烧心|abdominal/i.test(question))
    return scenarios.find((s) => s.id === "abdominal-pain");
  if (flags.includes("back-pain"))
    return scenarios.find((s) => s.id === "back-pain");
  if (flags.includes("palpitations"))
    return scenarios.find((s) => s.id === "palpitations");
  return undefined;
}

/** Rule-based educational sample. This function does not call or impersonate a medical AI. */
export function generateEducationalReply(question: string): EducationalReply {
  const flags = Object.entries(terms)
    .filter(([, pattern]) => mentioned(question, pattern))
    .map(([id]) => id);
  const risk = evaluateRisk(flags);
  const scenario = findScenario(question, flags);
  const disease = flags.includes("chest-pain")
    ? undefined
    : diseases.find(
        (record) =>
          question.includes(record.name) ||
          (record.id === "reflux" && /反酸|烧心|反流/.test(question)) ||
          (record.id === "cold" && /感冒/.test(question)),
      );
  const organ =
    !scenario && !disease
      ? organs.find((record) => question.includes(record.name))
      : undefined;
  const urgent = risk.level === "red";
  const medicineRequest =
    /处方|剂量|多少(?:毫克|片|粒|药)|吃几|服用几|用药|开什么药/.test(question);
  const sourceIds = [
    ...new Set([
      ...(disease?.sourceIds ??
        organ?.sourceIds ??
        scenario?.sourceIds ?? ["chest-pain", "headache"]),
      ...(flags.includes("cough-blood") ? ["haemoptysis"] : []),
      ...(urgent ? ["chest-pain", "headache", "back-pain"] : []),
      ...(medicineRequest ? ["paracetamol", "antibiotics"] : []),
    ]),
  ];
  const common = disease
    ? [disease.summary]
    : organ
      ? [organ.summary, ...organ.functions]
      : (scenario?.common ?? [
          "本地演示暂未收录与这段描述对应的具体内容，无法推断原因。",
          "可以描述不适部位、持续时间和伴随情况，并向医生寻求个体化评估。",
        ]);
  const observation = organ
    ? [organ.normal, `需要留意：${organ.symptoms.join("、")}。`]
    : [
        "记录症状从何时开始、持续多久，以及与活动、进食或体位的关系。",
        "留意发热、呼吸困难、出汗、晕厥等伴随表现，向医生说明既往疾病和正在使用的药物。",
      ];
  const care = urgent
    ? [risk.message, ...risk.actions]
    : [
        ...(disease?.care ??
          organ?.care ??
          scenario?.care ?? [
            "保持规律作息与均衡饮食，症状持续或加重时就医。",
            "不能仅凭文字描述或身体位置判断疾病。",
          ]),
      ];
  const danger = disease?.warnings ??
    scenario?.redFlags ?? [
      "持续或剧烈胸痛、严重呼吸困难、意识改变，或突然肢体无力与言语异常时，立即呼叫急救。",
    ];
  if (medicineRequest)
    care.push(
      "本演示不提供处方或具体剂量。药物选择、用量及相互作用请由医生或药师结合个人情况确认。",
    );
  return {
    urgent,
    sections: [
      {
        title: organ ? "认识这个器官" : "常见可能原因",
        items: [...common, "这些是一般科普信息，不能据此确定或排除诊断。"],
      },
      { title: "需要观察的信息", items: observation },
      { title: urgent ? "当前应采取的行动" : "自我护理建议", items: [...care] },
      {
        title: "需要就医的危险信号",
        items: [
          ...danger,
          "如危险信号正在发生，立即联系当地急救服务；中国大陆为 120。",
        ],
      },
    ],
    sourceIds,
  };
}
