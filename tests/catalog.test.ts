import assert from "node:assert/strict";
import test from "node:test";
import { diseases, organs } from "../src/data/medical";
import { searchDiseases, searchOrgans } from "../src/lib/catalog";

test("organ search tolerates whitespace and combines system and English words", () => {
  assert.deepEqual(searchOrgans("  LUNGS  ").map((item) => item.id), ["lungs"]);
  assert.deepEqual(searchOrgans("呼吸  Lungs").map((item) => item.id), ["lungs"]);
  assert.equal(searchOrgans(" \t ").length, organs.length);
  assert.equal(searchOrgans("肺", ["heart"]).length, 0);
  assert.deepEqual(searchOrgans("", ["lungs", "lungs", "unknown"]).map((item) => item.id), ["lungs"]);
});

test("every organ can find its related diseases using either language", () => {
  for (const organ of organs) {
    const related = diseases.filter((disease) => disease.organIds.includes(organ.id));
    for (const query of [organ.name, organ.english.toUpperCase()]) {
      const ids = searchDiseases(`  ${query}  `).map((disease) => disease.id);
      for (const disease of related) assert.ok(ids.includes(disease.id), `${query}: ${disease.name}`);
    }
    assert.deepEqual(searchDiseases("", "全部", organ.id), related);
  }
});

test("disease filters intersect and can recover from an empty result", () => {
  const related = searchDiseases("", "全部", "lungs");
  assert.ok(related.length > 0);
  const disease = related[0];
  assert.deepEqual(searchDiseases(`LUNGS ${disease.name}`, disease.category, "lungs"), [disease]);
  assert.equal(searchDiseases(disease.name, "不存在的分类", "lungs").length, 0);
  assert.equal(searchDiseases("没有这个主题").length, 0);
  assert.deepEqual(searchDiseases("  "), diseases);
});
