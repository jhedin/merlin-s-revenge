// objMoveXY bullet friction: a projectile loses friction% of its speed each frame (exponential decay) and
// STALLS below pStallSpeed — a splash bullet detonates where it lands, a plain bullet lands. High-friction
// lobs (bomb/flamingRock, 10%) come to rest within ~200px instead of flying straight forever; low-friction
// bolts still coast far enough to reach a target. The #proportional throw scales speed with distance, so
// bullets keep reaching targets despite the decay.
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

function run(actor: string, dist: number) {
  game.assets = { index: assets, images: new Map(), img: () => null, ensureChar: async () => {} } as any;
  game.grid = new CollisionGrid(80, 80, 32);
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  const e = spawnEnemy(actor, 100, 100);
  const target = spawnPlayer(100 + dist, 100);
  game.entities = [e, target];
  const te = target.get(Energy) as any;
  let maxTravel = 0, hit = false;
  for (let t = 0; t < 300; t++) {
    te.energy = 1e9; te.max = 1e9; te.dead = false;
    target.get(Movement).x = 100 + dist; target.get(Movement).y = 100;
    rebuildCombatSubstrate();
    for (const en of game.entities) if (en !== target) en.send("update");
    for (const en of game.entities) { const p = en.tryGet(Projectile); if (p && (p as any).ownerId === e.id) { const m = en.get(Movement); maxTravel = Math.max(maxTravel, Math.hypot(m.x - 100, m.y - 100)); } }
    if (te.energy < 1e9) hit = true;
    sweepBullets();
  }
  return { maxTravel, hit };
}

describe("bullet friction: exponential decay + stall", () => {
  beforeEach(() => { game.entities = []; });

  it("a high-friction bomb (10%) decelerates and stalls within ~200px (not a straight-line forever shot)", () => {
    const { maxTravel } = run("bombMage", 60); // reach 80 — fires; bomb stalls shortly past the target
    expect(maxTravel).toBeLessThan(220);        // was ~1400 with no friction
    expect(maxTravel).toBeGreaterThan(40);
  });

  it("bullets still REACH their target within reach (decay doesn't strand them)", () => {
    expect(run("quadranid", 150).hit).toBe(true);   // laser, friction 3
    expect(run("plant", 150).hit).toBe(true);        // needle, friction 8
    expect(run("lavaGolem", 120).hit).toBe(true);    // flamingRock splash, friction 10
  });
});
