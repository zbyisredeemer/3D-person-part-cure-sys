import assert from "node:assert/strict";
import test from "node:test";
import { Box3, Vector3 } from "three";
import { organInventory } from "../src/components/anatomy/exploration";
import {
  anatomyPresets,
  inventoryOrgans,
} from "../src/components/anatomy/viewPresets";
import { organNames } from "../src/components/anatomy/organMapping";

test("presets activate the selected anatomy layer without accidental overlays", () => {
  for (const preset of Object.values(anatomyPresets)) {
    assert.ok(organNames[preset.selectedOrgan]);
    const layer =
      ({ bones: "skeleton", muscles: "muscles" } as Record<string, string>)[
        preset.selectedOrgan
      ] || "organs";
    assert.equal(preset.layers[layer as keyof typeof preset.layers], true);
    assert.equal(preset.layers.nerves, false);
    assert.equal(preset.layers.vessels, false);
  }
  assert.equal(anatomyPresets.organs.layers.skin, false);
  assert.equal(anatomyPresets.skeleton.layers.organs, false);
});

test("inventory preserves geometry sizes and keeps organ groups separated on both layouts", () => {
  const boxes = new Map(
    inventoryOrgans.map((id, i) => [
      id,
      new Box3(
        new Vector3(-0.17, i * 0.02, -0.1),
        new Vector3(0.18, i * 0.02 + 0.38, 0.11),
      ),
    ]),
  );
  const before = [...boxes.values()].map((box) => box.clone());
  for (const compact of [false, true]) {
    const { offsets, bounds } = organInventory(boxes, compact);
    assert.equal(offsets.size, inventoryOrgans.length);
    const placed = [...boxes].map(([id, box]) => {
      const result = box.clone().translate(offsets.get(id)!);
      assert.ok(
        result.getSize(new Vector3()).distanceTo(box.getSize(new Vector3())) <
          1e-12,
      );
      assert.ok(bounds.containsBox(result));
      const restored = result
        .clone()
        .translate(offsets.get(id)!.clone().negate());
      assert.ok(restored.min.distanceTo(box.min) < 1e-12);
      return result;
    });
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        assert.equal(placed[i].intersectsBox(placed[j]), false);
  }
  assert.deepEqual([...boxes.values()], before);
  assert.equal(organInventory(new Map(), true).bounds.isEmpty(), true);
});
