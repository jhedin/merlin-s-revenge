// Census gap: modEnergy #energyIncPercentage defaults to 1, so EVERY unit's max HP grows +baseEnergy·1%
// per level. The port defaulted enemies/allies to 0, so a levelled enemy stayed at its base HP forever.
// Also: the increment is FRACTIONAL (no rounding), so a small-HP unit grows by sub-integer steps.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Energy } from "@/components/combat";

describe("level-up max-HP growth (modEnergy energyIncPercentage default 1)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32); game.entities = [];
    game.assets = { index: { anims: {} }, images: new Map(), ensureChar: () => {}, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  });

  it("an enemy with NO explicit energyIncPercentage grows max HP +baseEnergy·1% per level", () => {
    const orc = spawnEnemy("swordOrc", 100, 100); game.entities = [orc];
    const en = orc.get(Energy);
    const base = en.max;                       // base energy (swordOrc 300)
    expect(base).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) orc.send("forceLevelUp");
    // +1% of base per level × 5 levels.
    expect(en.max).toBeCloseTo(base + base * 0.01 * 5, 5);
    expect(en.max).toBeGreaterThan(base);      // it actually grew (was the bug: stayed at base)
  });

  it("the increment is FRACTIONAL for a small-HP unit (not rounded up to a whole point)", () => {
    const e = spawnEnemy("bat", 100, 100); game.entities = [e];
    const en = e.get(Energy);
    const base = en.max;
    e.send("forceLevelUp");
    const grew = en.max - base;
    expect(grew).toBeCloseTo(base * 0.01, 5);  // exact 1% (e.g. 0.5 for a 50-HP bat), not rounded to 1
  });

  it("a dwelling's explicit energyIncPercentage -1 still SHRINKS its max (override preserved)", () => {
    const dw = spawnEnemy("goblinHut", 100, 100); game.entities = [dw];
    const en = dw.get(Energy);
    const base = en.max;
    dw.send("forceLevelUp");
    expect(en.max).toBeLessThan(base);         // negative inc preserved (not forced to the +1 default)
  });
});
