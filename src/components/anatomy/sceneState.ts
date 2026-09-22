type SourceStatus = "idle" | "loading" | "ready" | "error";

// Cache successful and in-flight loads. A failed source is only requested again
// after an explicit retry, so other layers finishing cannot cause a retry loop.
export function createSourceLoader(
  fetchSource: (source: string) => Promise<void>,
  onChange: () => void,
) {
  const sources = new Map<
    string,
    { status: SourceStatus; promise: Promise<void> }
  >();
  function load(source: string): Promise<void> {
    const existing = sources.get(source);
    if (existing) return existing.promise;
    const entry = {
      status: "loading" as SourceStatus,
      promise: Promise.resolve().then(() => fetchSource(source)),
    };
    entry.promise = entry.promise.then(
      () => {
        entry.status = "ready";
        onChange();
      },
      (error) => {
        entry.status = "error";
        onChange();
        throw error;
      },
    );
    sources.set(source, entry);
    onChange();
    return entry.promise;
  }
  return {
    load,
    status: (source: string): SourceStatus =>
      sources.get(source)?.status || "idle",
    retry(source: string) {
      if (sources.get(source)?.status === "error") sources.delete(source);
      return load(source);
    },
  };
}

export function optionalAnatomySources(layers: Record<string, boolean>) {
  return [
    layers.muscles ? "muscular" : "",
    layers.vessels ? "cardiovascular" : "",
    layers.nerves ? "nervous" : "",
    layers.nerves ? "cranial" : "",
  ].filter(Boolean);
}

export type ProjectedLabel = {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  left: boolean;
  selected: boolean;
};

export function sameLabels(previous: ProjectedLabel[], next: ProjectedLabel[]) {
  return (
    previous.length === next.length &&
    previous.every((label, index) => {
      const other = next[index];
      return (
        label.id === other.id &&
        label.left === other.left &&
        label.selected === other.selected &&
        Math.abs(label.x - other.x) < 0.5 &&
        Math.abs(label.y - other.y) < 0.5 &&
        Math.abs(label.anchorX - other.anchorX) < 0.5 &&
        Math.abs(label.anchorY - other.anchorY) < 0.5
      );
    })
  );
}
