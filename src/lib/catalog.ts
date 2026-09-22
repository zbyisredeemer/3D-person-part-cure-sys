import { diseases, drugs, organs, systems } from "../data/medical";

export interface DiseaseCatalogState {
  query: string;
  category: string;
  organId: string;
  selectedId: string;
}

/** Match each word independently so whitespace and mixed-language queries work. */
function matchesQuery(text: string, query: string) {
  const normalized = text.toLowerCase();
  return query.trim().toLowerCase().split(/\s+/)
    .every((word) => normalized.includes(word));
}

export function searchOrgans(query: string, bookmarks?: readonly string[]) {
  return organs.filter((organ) => {
    const system = systems.find((item) => item.id === organ.system);
    return (
      (!bookmarks || bookmarks.includes(organ.id)) &&
      matchesQuery(
        `${organ.name} ${organ.english} ${system?.name ?? ""} ${system?.english ?? ""}`,
        query,
      )
    );
  });
}

const diseaseSearchText = new Map(diseases.map((disease) => [
  disease.id,
  `${disease.name} ${disease.category} ${disease.summary} ${disease.symptoms.join(" ")} ${
    organs.filter((organ) => disease.organIds.includes(organ.id))
      .map((organ) => `${organ.name} ${organ.english}`).join(" ")
  }`,
]));

export function searchDiseases(
  query: string,
  category = "全部",
  organId = "all",
) {
  return diseases.filter(
    (disease) =>
      (category === "全部" || disease.category === category) &&
      (organId === "all" || disease.organIds.includes(organId)) &&
      matchesQuery(diseaseSearchText.get(disease.id) ?? "", query),
  );
}

/** Keep the selected topic visible after any combination of filters changes. */
export function updateDiseaseCatalogState(
  state: DiseaseCatalogState,
  changes: Partial<DiseaseCatalogState>,
): DiseaseCatalogState {
  const next = { ...state, ...changes };
  const results = searchDiseases(next.query, next.category, next.organId);
  return {
    ...next,
    selectedId: results.some((disease) => disease.id === next.selectedId)
      ? next.selectedId
      : results[0]?.id ?? "",
  };
}

export function createDiseaseCatalogState(nameOrId = ""): DiseaseCatalogState {
  const term = nameOrId.trim();
  const match = diseases.find(
    (disease) => disease.id === term.toLowerCase() || disease.name === term,
  );
  return updateDiseaseCatalogState({
    query: match ? "" : term,
    category: "全部",
    organId: "all",
    selectedId: match?.id ?? "",
  }, {});
}

export function searchDrugs(query: string, category = "全部") {
  return drugs.filter(
    (drug) =>
      (category === "全部" || drug.category === category) &&
      matchesQuery(
        `${drug.id} ${drug.name} ${drug.category} ${drug.purpose} ${drug.indications.join(" ")}`,
        query,
      ),
  );
}
