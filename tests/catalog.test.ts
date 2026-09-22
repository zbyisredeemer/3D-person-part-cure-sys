import assert from "node:assert/strict";
import test from "node:test";
import { diseases, drugs, organs } from "../src/data/medical";
import {
  createDiseaseCatalogState,
  searchDiseases,
  searchDrugs,
  searchOrgans,
  updateDiseaseCatalogState,
} from "../src/lib/catalog";

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

test("disease links resolve IDs and names without imposing a search filter", () => {
  for (const disease of diseases) {
    for (const value of [disease.id, disease.name]) {
      assert.deepEqual(createDiseaseCatalogState(` ${value} `), {
        query: "",
        category: "全部",
        organId: "all",
        selectedId: disease.id,
      });
    }
  }
  assert.equal(createDiseaseCatalogState().selectedId, diseases[0].id);
  assert.equal(createDiseaseCatalogState("ASTHMA").selectedId, "asthma");
});

test("unknown disease links become searches with a valid selection or empty state", () => {
  const search = createDiseaseCatalogState("咳嗽");
  assert.equal(search.query, "咳嗽");
  assert.equal(search.selectedId, searchDiseases("咳嗽")[0].id);
  assert.equal(createDiseaseCatalogState("没有这个主题").selectedId, "");
});

test("catalog filter transitions retain visible selections and recover from no results", () => {
  const original = createDiseaseCatalogState("asthma");
  const respiratory = updateDiseaseCatalogState(original, { organId: "lungs" });
  assert.equal(respiratory.selectedId, "asthma");
  const narrowed = updateDiseaseCatalogState(respiratory, { query: "肺炎" });
  assert.equal(narrowed.selectedId, "pneumonia");
  const cleared = updateDiseaseCatalogState(narrowed, { query: "" });
  assert.equal(cleared.selectedId, "pneumonia");
  const empty = updateDiseaseCatalogState(cleared, { category: "泌尿健康" });
  assert.equal(empty.selectedId, "");
  const reset = updateDiseaseCatalogState(empty, {
    query: "", category: "全部", organId: "all",
  });
  assert.equal(reset.selectedId, diseases[0].id);
  assert.equal(original.organId, "all", "state transitions do not mutate the saved state");
  assert.equal(original.selectedId, "asthma");
});

test("restoring a catalog state preserves its filters and selected topic", () => {
  const saved = updateDiseaseCatalogState(createDiseaseCatalogState("pneumonia"), {
    query: "LUNGS", category: "呼吸健康", organId: "lungs",
  });
  const restored = updateDiseaseCatalogState(JSON.parse(JSON.stringify(saved)), {});
  assert.deepEqual(restored, saved);
  assert.equal(restored.selectedId, "pneumonia");
});

test("drug search combines words in any order and intersects categories", () => {
  assert.deepEqual(searchDrugs("  炎症  布洛芬 ").map((drug) => drug.id), ["ibuprofen"]);
  assert.deepEqual(searchDrugs("  IBUPROFEN  发热 ").map((drug) => drug.id), ["ibuprofen"]);
  assert.equal(searchDrugs("布洛芬", "抗过敏药").length, 0);
  assert.equal(searchDrugs("没有这个药物").length, 0);
  assert.deepEqual(searchDrugs(" \t ", "全部"), drugs);
  for (const drug of drugs) {
    assert.ok(searchDrugs(drug.name, drug.category).includes(drug));
  }
});
