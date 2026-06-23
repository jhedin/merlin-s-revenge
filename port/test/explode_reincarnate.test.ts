// modExploder death routes: (1) a splash bullet detonates by playing its <char>_explode burst strip in
// place (#explode) before retiring; (2) a plain bullet's #reincarnateAs hatches ONLY on a land-stall, NOT
// on a direct target collision (objBullet routes #bulletCollidedWithTarget -> die() in #fly, not #land).
import { describe, it, expect, beforeEach } from "vitest";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { sweepBullets } from "@/systems/bullets";
import { Projectile } from "@/components/projectile";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
import assets from "@/generated/assets.json";

function setup() {
  game.assets = { index: assets, images: new Map(), img: () => null, ensureChar: async () => {} } as any;
  game.grid = new CollisionGrid(80, 80, 32);
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  game.entities = [];
}

describe("explosion VFX + reincarnate death routes (modExploder)", () => {
  beforeEach(setup);

  it("a splash bomb plays its _explode burst in place on detonation (does not just vanish)", () => {
    const e = spawnEnemy("bombMage", 100, 100);
    const target = spawnPlayer(170, 100);
    game.entities = [e, target];
    const te = target.get(Energy) as any;
    let sawExploding = false;
    for (let t = 0; t < 250; t++) {
      te.energy = 1e9; te.max = 1e9; te.dead = false; target.get(Movement).x = 170; target.get(Movement).y = 100;
      rebuildCombatSubstrate();
      for (const en of game.entities) if (en !== target) en.send("update");
      for (const en of game.entities) { const p = en.tryGet(Projectile); if (p && (p as any).exploding) sawExploding = true; }
      sweepBullets();
    }
    expect(sawExploding).toBe(true); // bomb has a bundled bomb_explode strip -> it plays it
  });

  it("an ostrichEgg that HITS a target does NOT hatch a babyOstrich (only a land-stall hatches)", () => {
    const e = spawnEnemy("powerOstrich", 100, 200);
    // a CLOSE wall of immortal targets spanning the egg's path: every egg collides (eyestrain can't miss),
    // so each takes the direct-hit route — which must not reincarnate.
    const wall = [];
    for (let dy = -50; dy <= 50; dy += 10) wall.push(spawnPlayer(160, 200 + dy));
    game.entities = [e, ...wall];
    let eggs = 0; const seen = new Set<number>();
    for (let t = 0; t < 200; t++) {
      for (const w of wall) { const te = w.get(Energy) as any; te.energy = 1e9; te.max = 1e9; te.dead = false; }
      rebuildCombatSubstrate();
      for (const en of game.entities) if (!wall.includes(en)) en.send("update");
      for (const en of game.entities) { const p = en.tryGet(Projectile); if (p && (p as any).ownerId === e.id && !seen.has(en.id)) { seen.add(en.id); eggs++; } }
      sweepBullets();
    }
    expect(eggs).toBeGreaterThan(0);                                                  // it did fire
    expect(game.entities.filter((x) => x.send("getActorType") === "babyOstrich").length).toBe(0); // none hatched on a hit
  });
});
