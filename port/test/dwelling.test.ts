import { describe, it, expect, beforeEach } from "vitest";
import { spawnDwelling, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

// modResidents: a building releases a lifetime budget (#totalResidents) of its own #residentGroups
// in staggered groups, then stops. Residents are its real hostile units (goblinHut -> goblins,
// NOT Merlin's #warrior ally — the bug team-aware spawning exposed).
describe("dwelling residents (objDwelling / modResidents)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any; // unbundled -> blackOrc sprite
    game.spawnEnemy = spawnEnemy;
    game.spawnUnit = spawnUnit;
  });

  it("releases its own hostile residents over time (not a player ally)", () => {
    const hut = spawnDwelling("goblinHut", 100, 100); // data: #goblinArcher / #goblinWarrior
    game.entities = [hut];
    for (let i = 0; i < 2000; i++) hut.send("update"); // run through several wave cycles
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeGreaterThan(0);
    expect(residents.every((e) => e.send("getTeam") === "#goblins")).toBe(true);
    // modResidents: the dwelling levels up once per release (me.big.levelUp), so the FIRST resident emerges
    // unleveled (random(0)=0) but later ones escalate (setStartingLevel(random(level))). Resident N's level
    // is bounded by its release index N (random(N) <= N), and the run as a whole must show escalation.
    const levels = residents.map((e) => e.send("getLevel") as number);
    expect(levels[0]).toBe(0);                                  // first resident: dwelling level 0
    expect(levels.every((lv, i) => lv >= 0 && lv <= i)).toBe(true); // random(i) <= i
    expect(Math.max(...levels)).toBeGreaterThan(0);             // escalation actually happened
  });

  it("stops once the lifetime budget is spent (does not produce forever)", () => {
    const hut = spawnDwelling("fangBunnyPortal", 100, 100); // budget = min(12, totalResidents 12)
    game.entities = [hut];
    // remove residents as they spawn so the soft concurrent cap never throttles the budget
    for (let i = 0; i < 20000; i++) {
      hut.send("update");
      game.entities = game.entities.filter((e) => e === hut || e.type !== "enemy");
    }
    // total ever produced is capped by the budget (<= 12), then the building goes empty
    const before = (hut as any).comps.find((c: any) => "budget" in c).budget;
    for (let i = 0; i < 5000; i++) hut.send("update");
    const after = (hut as any).comps.find((c: any) => "budget" in c).budget;
    expect(before).toBeLessThanOrEqual(0); // budget spent
    expect(after).toBe(before);            // and it stays stopped
  });

  it("orcHouse produces orcs from its multi-type residentGroups", () => {
    const hut = spawnDwelling("orcHouse", 100, 100); // real: #bowOrc / #swordOrc / #mageOrc
    game.entities = [hut];
    for (let i = 0; i < 3000; i++) hut.send("update");
    const residents = game.entities.filter((e) => e !== hut && e.type === "enemy");
    expect(residents.length).toBeGreaterThan(0);
    expect(residents.every((e) => e.send("getTeam") === "#orcs")).toBe(true);
  });
});
