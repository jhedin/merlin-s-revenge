import { describe, it, expect, beforeEach } from "vitest";
import { spawnDwelling, spawnEnemy } from "@/entities/archetypes";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

// DWELLINGS maps each building to the hostile unit it produces. goblinHut -> goblinWarrior
// (#goblins), NOT Merlin's #warrior (#aldevar) — the bug team-aware spawning exposed.
describe("dwelling residents (objDwelling / modResidents)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any; // unbundled -> blackOrc sprite
    game.spawnEnemy = spawnEnemy;
  });

  it("produces a hostile-team unit, not a player ally", () => {
    const hut = spawnDwelling("goblinHut", 100, 100, "goblinWarrior", false);
    game.entities = [hut];
    for (let i = 0; i < 220; i++) hut.send("update"); // run past the build period
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeGreaterThan(0);
    expect(residents[0]!.send("getTeam")).toBe("#goblins"); // hostile, gates the exit + takes bolts
  });

  it("caps residents at the building's clamped totalResidents", () => {
    const hut = spawnDwelling("fangBunnyPortal", 100, 100, "fangBunny", false); // totalResidents 12 -> clamp 6
    game.entities = [hut];
    for (let i = 0; i < 4000; i++) hut.send("update");
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeLessThanOrEqual(6);
    expect(residents.length).toBeGreaterThan(0);
  });
});
