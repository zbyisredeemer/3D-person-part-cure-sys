import { Box3, Vector3 } from "three";

import { inventoryOrgans } from "./viewPresets";

// Translate whole organ groups; preserve their scale, surfaces and internal alignment.
export function organInventory(boxes: Map<string, Box3>, compact: boolean) {
  const ids = inventoryOrgans.filter((id) => boxes.has(id));
  const columns = Math.min(compact ? 4 : 5, ids.length);
  const rows = Math.ceil(ids.length / Math.max(1, columns));
  let width = 0.38,
    height = 0.36;
  for (const id of ids) {
    const size = boxes.get(id)!.getSize(new Vector3());
    width = Math.max(width, size.x);
    height = Math.max(height, size.y);
  }
  const offsets = new Map<string, Vector3>();
  const bounds = new Box3();
  ids.forEach((id, index) => {
    const box = boxes.get(id)!;
    const center = box.getCenter(new Vector3());
    const slot = new Vector3(
      ((index % columns) - (columns - 1) / 2) * (width + 0.1),
      1.2 + ((rows - 1) / 2 - Math.floor(index / columns)) * (height + 0.14),
      0,
    );
    const offset = slot.sub(center);
    offsets.set(id, offset);
    bounds.union(box.clone().translate(offset));
  });
  if (!bounds.isEmpty()) bounds.expandByVector(new Vector3(0.06, 0.1, 0));
  return { offsets, bounds };
}
