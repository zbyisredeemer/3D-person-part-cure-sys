import { diseases, organs, systems } from "../data/medical";

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
