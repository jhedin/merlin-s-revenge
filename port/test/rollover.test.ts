// characterEnergyRollOverMaster: the mouse-hover picks the character under the cursor (its energy/level/XP
// then float at the unit). gEnemyEnergyMasterOn=0 -> there are NO always-on bars, so this is the only path.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { pickHoveredUnit } from "@/render/rollover";

describe("health rollover hover-pick (characterEnergyRollOverMaster)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("returns the unit whose body box contains the cursor", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const b = spawnEnemy("swordOrc", 300, 100, { animChar: "swordOrc" });
    game.entities = [a, b];
    expect(pickHoveredUnit({ x: 100, y: 90 }, game.entities)).toBe(a);  // over a's body
    expect(pickHoveredUnit({ x: 300, y: 95 }, game.entities)).toBe(b);  // over b's body
  });

  it("returns null when the cursor is over empty space", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    expect(pickHoveredUnit({ x: 250, y: 250 }, game.entities)).toBeNull();
    expect(pickHoveredUnit(null, game.entities)).toBeNull();           // no mouse
  });

  it("ignores dead units (no rollover for a corpse)", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    a.get(Energy).dead = true;
    game.entities = [a];
    expect(pickHoveredUnit({ x: 100, y: 90 }, game.entities)).toBeNull();
  });

  it("picks the closer unit when two overlap the cursor", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const b = spawnEnemy("swordOrc", 110, 100, { animChar: "swordOrc" });
    game.entities = [a, b];
    expect(pickHoveredUnit({ x: 108, y: 88 }, game.entities)).toBe(b);  // nearer b's centre
  });
});
