import assert from "node:assert/strict";
import test from "node:test";
import {
  diseases,
  drugs,
  organs,
  scenarios,
  sources,
  systems,
} from "../src/data/medical";
import { evaluateRisk, generateEducationalReply } from "../src/lib/health";

test("chest pain triggers emergency help with any important associated warning", () => {
  for (const associated of [
    "dyspnea",
    "cold-sweat",
    "dizziness",
    "radiating-pain",
    "severe-pain",
    "persistent-pain",
  ]) {
    const risk = evaluateRisk(["chest-pain", associated]);
    assert.equal(risk.level, "red", associated);
    assert.match(risk.actions.join(""), /120/);
  }
  assert.equal(
    evaluateRisk(["chest-pain", "dyspnea", "cold-sweat"]).level,
    "red",
  );
});

test("red flags take priority regardless of order and duplicate selections", () => {
  const flags = ["cough", "fever", "chest-pain", "dyspnea"];
  assert.deepEqual(
    evaluateRisk(flags),
    evaluateRisk([...flags.reverse(), "cough"]),
  );
  assert.equal(evaluateRisk(["severe-dyspnea"]).level, "red");
  assert.equal(evaluateRisk(["stroke-signs"]).level, "red");
  assert.equal(
    evaluateRisk(["back-pain", "bladder-bowel-change"]).level,
    "red",
  );
  assert.equal(evaluateRisk(["palpitations", "fainting"]).level, "red");
});

test("blood in sputum receives prompt assessment, with escalation for breathing problems", () => {
  assert.equal(evaluateRisk(["cough-blood"]).level, "red");
  assert.match(evaluateRisk(["cough-blood"]).title, /尽快就医/);
  assert.match(evaluateRisk(["cough-blood", "dyspnea"]).title, /立即求助/);
});

test("lack of a matched rule never declares a symptomatic user safe", () => {
  assert.equal(evaluateRisk(["cough", "fever"]).level, "yellow");
  assert.equal(evaluateRisk(["unknown-symptom"]).level, "yellow");
  assert.equal(evaluateRisk(["chest-pain"]).level, "yellow");
  assert.equal(evaluateRisk([]).level, "green");
  assert.match(evaluateRisk([]).message, /不表示.*排除/);
});

test("the local assistant recognizes the requested intermittent right-chest example", () => {
  const reply = generateEducationalReply("最近右侧胸口偶尔疼是什么原因？");
  assert.equal(reply.urgent, false);
  assert.equal(reply.sections.length, 4);
  assert(reply.sourceIds.includes("chest-pain"));
  assert.match(
    reply.sections.map((s) => s.items.join("")).join(""),
    /不能据此确定或排除诊断/,
  );
});

test("the local assistant detects a dangerous chest symptom combination", () => {
  const reply = generateEducationalReply("胸口疼，呼吸困难，还一直出冷汗");
  assert.equal(reply.urgent, true);
  assert.match(reply.sections.flatMap((s) => s.items).join(""), /120/);
  assert.equal(generateEducationalReply("我没有胸痛，只是咳嗽").urgent, false);
  assert.equal(
    generateEducationalReply("我没有胸痛，但现在胸痛和呼吸困难").urgent,
    true,
  );
});

test("ongoing chest pain is recognized across common Chinese word orders", () => {
  for (const question of [
    "持续胸痛",
    "胸痛持续了十分钟",
    "胸痛没有缓解",
    "胸口疼，持续不缓解",
  ]) {
    assert.equal(generateEducationalReply(question).urgent, true, question);
  }
});

test("health learning questions retrieve relevant organ and disease advice", () => {
  const heart = generateEducationalReply("如何在日常生活中保护心脏？");
  assert(heart.sourceIds.includes("heart"));
  assert.match(
    heart.sections.flatMap((section) => section.items).join(""),
    /血压、血脂和血糖/,
  );
  const reflux = generateEducationalReply("经常胃部反酸，平时怎么照护？");
  assert(reflux.sourceIds.includes("reflux"));
  assert.match(
    reflux.sections.flatMap((section) => section.items).join(""),
    /临睡前进食/,
  );
});

test("medication dose requests are bounded and do not contaminate later replies", () => {
  const before = generateEducationalReply("我咳嗽");
  const answer = generateEducationalReply("我咳嗽，吃几片药，开个处方");
  assert.match(
    answer.sections.flatMap((s) => s.items).join(""),
    /不提供处方或具体剂量/,
  );
  assert.deepEqual(generateEducationalReply("我咳嗽"), before);
  const medicationText = JSON.stringify(drugs) + JSON.stringify(answer);
  assert.doesNotMatch(
    medicationText,
    /\d+\s*(?:mg|ml|毫克|毫升|片|粒|次\/日)/i,
  );
});

test("all content references resolve and all requested organs are covered", () => {
  const organIds = new Set(organs.map((organ) => organ.id));
  const systemIds = new Set(systems.map((system) => system.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  const drugIds = new Set(drugs.map((drug) => drug.id));
  assert.equal(organs.length, 23);
  assert.equal(organIds.size, organs.length);
  for (const organ of organs) assert(systemIds.has(organ.system), organ.id);
  for (const record of [...organs, ...diseases, ...drugs, ...scenarios]) {
    assert(record.sourceIds.length > 0, record.id);
    for (const sourceId of record.sourceIds)
      assert(sourceIds.has(sourceId), sourceId);
  }
  for (const record of [...diseases, ...scenarios])
    for (const organId of record.organIds)
      assert(organIds.has(organId), organId);
  for (const disease of diseases)
    for (const drugId of disease.drugIds) assert(drugIds.has(drugId), drugId);
  for (const source of sources)
    assert.match(
      source.url,
      /^https:\/\/(?:www\.)?(?:nhs\.uk|n\w+\.nih\.gov)\//,
    );
});

test("a lung-protection learning question does not imply that the user has a cough", () => {
  const reply = generateEducationalReply("如何在日常生活中保护肺部？");
  assert.equal(reply.urgent, false);
  assert.equal(reply.sections[0].title, "认识这个器官");
  assert.ok(reply.sections[2].items.some((item) => /烟/.test(item)));
});
