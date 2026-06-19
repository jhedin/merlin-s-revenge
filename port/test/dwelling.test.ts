import { describe, it, expect, beforeEach } from "vitest";
import { spawnDwelling, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

// What a dwelling produces comes from its own data (#residentGroups), not a hardcoded table.
// goblinHut -> goblins (NOT Merlin's #warrior ally, the bug team-aware spawning exposed).
describe("dwelling residents (objDwelling / modResidents)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any; // unbundled -> blackOrc sprite
    game.spawnEnemy = spawnEnemy;
    game.spawnUnit = spawnUnit;
  });

  it("produces the building's own hostile residents, not a player ally", () => {
    const hut = spawnDwelling("goblinHut", 100, 100); // data: #goblinArcher / #goblinWarrior
    game.entities = [hut];
    for (let i = 0; i < 220; i++) hut.send("update"); // run past the build period
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeGreaterThan(0);
    expect(residents[0]!.send("getTeam")).toBe("#goblins"); // hostile, gates the exit + takes bolts
  });

  it("caps residents at the building's clamped totalResidents", () => {
    const hut = spawnDwelling("fangBunnyPortal", 100, 100); // totalResidents 12 -> clamp 6
    game.entities = [hut];
    for (let i = 0; i < 4000; i++) hut.send("update");
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeLessThanOrEqual(6);
    expect(residents.length).toBeGreaterThan(0);
  });

  it("orcHouse produces orcs from its multi-type residentGroups", () => {
    const hut = spawnDwelling("orcHouse", 100, 100); // real: #bowOrc / #swordOrc / #mageOrc
    game.entities = [hut];
    for (let i = 0; i < 1200; i++) hut.send("update");
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeGreaterThan(0);
    expect(residents.every((e) => e.send("getTeam") === "#orcs")).toBe(true); // real orc team
  });
});
