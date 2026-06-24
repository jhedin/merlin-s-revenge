// modEnergy #maxEnergy: the ceiling can exceed starting energy. Default #auto -> max = energy, but the hydra
// bosses ship #maxEnergy:1500 with #energy 500/1000, so the health bar reads energy/maxEnergy (33%/67%) and
// they can be healed/regen above their start. The port hardcoded max = energy, reading the property for
// nothing -> hydras displayed FULL health at a third/two-thirds start. (dropped-property re-sweep)
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy } from "@/entities/archetypes";
import { Energy } from "@/components/combat";

describe("modEnergy #maxEnergy ceiling (hydra bosses)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.assets = { index: { anims: {} }, images: new Map(), img: () => null, ensureChar: () => {} } as any;
  });

  it("hydra1 starts at 500/1500 = 33%, not a full bar", () => {
    const en = spawnEnemy("hydra1", 100, 100).get(Energy);
    expect(en.energy).toBe(500);
    expect(en.max).toBe(1500);             // the explicit #maxEnergy, not the #auto energy
    expect(en.energyFrac()).toBeCloseTo(1 / 3, 3);
  });

  it("hydra2 starts at 1000/1500 = 67%", () => {
    const en = spawnEnemy("hydra2", 100, 100).get(Energy);
    expect(en.max).toBe(1500);
    expect(en.energyFrac()).toBeCloseTo(2 / 3, 3);
  });

  it("a unit with no #maxEnergy keeps the #auto ceiling (max = starting energy)", () => {
    const en = spawnEnemy("blackOrc", 100, 100).get(Energy);
    expect(en.max).toBe(en.energy);
    expect(en.energyFrac()).toBe(1);
  });
});
