// objAICPUBuilder + modBuilder: a builder NPC (dwarf/goblinBuilder) walks to a site, spawns its
// #unitToBuild dwelling preBuilt=false (#underConstruction), accrues buildRate until the dwelling
// finishes (markBuilt), then applies its disposition — leaveWhenFinished/buildDie retire the builder.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Movement } from "@/components/movement";

describe("builder NPC FSM (dwarf)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnEnemy = spawnEnemy; game.spawnUnit = spawnUnit;
    // startBuilding spawns the dwelling via spawnFromSymbol — stub it with a plain entity (getPos/isDead/flags).
    game.spawnFromSymbol = (_sym, x, y) => spawnUnit("warrior", x, y, { animChar: "warrior" });
  });

  it("spawns its dwarfTower, builds it to completion, then retires (leaveWhenFinished)", () => {
    const dwarf = spawnEnemy("dwarf", 100, 100, { animChar: "dwarf" });
    game.entities = [dwarf];

    // tick 1: lookForBuilding -> startBuilding spawns the site (loc + (32,0)) marked #underConstruction.
    dwarf.send("update");
    const site = game.entities.find((e) => e !== dwarf && e.flags.has("underConstruction"));
    expect(site).toBeDefined();                              // a dwelling under construction now exists
    expect(dwarf.send("isDead")).toBe(false);

    // drive the build to completion (buildRate 100 -> 1 frame/tick; BUILD_FRAMES = 8).
    for (let i = 0; i < 12 && !dwarf.send("isDead"); i++) {
      dwarf.get(Movement); // keep the dwarf put — it's already within BUILD_RANGE of its own site
      dwarf.send("update");
    }

    expect(site!.flags.has("underConstruction")).toBe(false); // markBuilt: construction finished
    expect(dwarf.send("isDead")).toBe(true);                  // leaveWhenFinished -> the builder retires
  });

  it("a builder with no spawner falls back to fighting (no crash)", () => {
    const dwarf = spawnEnemy("dwarf", 100, 100, { animChar: "dwarf" });
    game.spawnFromSymbol = undefined;                         // no symbol spawner available
    game.entities = [dwarf];
    expect(() => { for (let i = 0; i < 5; i++) dwarf.send("update"); }).not.toThrow();
    expect(dwarf.send("isDead")).toBe(false);                 // it just fights instead of building
  });
});
