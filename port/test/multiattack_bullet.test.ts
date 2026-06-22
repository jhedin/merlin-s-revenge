// K6 multiAttack with two RANGED weapons (shrouder: throwSmoke#smoke beyond bufferDist, pinShooter#smokePin
// within): the original fires me.getAttack().bullet — the CURRENT weapon's projectile. The port froze the
// primary bullet at spawn, so weapon 2 wrongly fired weapon 1's smoke bomb. syncWeaponMode now swaps the
// active bullet by the current weapon's #bullet name.
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

function bulletCharsAt(dist: number): Set<string> {
  game.assets = { index: assets, images: new Map(), img: () => null, ensureChar: async () => {} } as any;
  game.grid = new CollisionGrid(80, 80, 32);
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  const e = spawnEnemy("shrouder", 100, 100);
  const target = spawnPlayer(100 + dist, 100);
  game.entities = [e, target];
  const te = target.get(Energy) as any; const chars = new Set<string>();
  for (let t = 0; t < 200; t++) {
    te.energy = 1e9; te.max = 1e9; te.dead = false;
    target.get(Movement).x = 100 + dist; target.get(Movement).y = 100;
    rebuildCombatSubstrate();
    for (const en of game.entities) if (en !== target) en.send("update");
    for (const en of game.entities) { const p = en.tryGet(Projectile); if (p && (p as any).ownerId === e.id) chars.add((p as any).char); }
    sweepBullets();
  }
  return chars;
}

describe("multiAttack fires the CURRENT weapon's bullet (shrouder)", () => {
  beforeEach(() => { game.entities = []; });

  it("far (throwSmoke) fires #smoke; near (pinShooter) fires #smokePin — not weapon 1's bomb", () => {
    const far = bulletCharsAt(250);   // beyond bufferDist 80 -> weapon 1 throwSmoke
    const near = bulletCharsAt(50);   // within 80 -> weapon 2 pinShooter
    expect(far.has("smoke")).toBe(true);
    expect(near.has("smokePin")).toBe(true);
    expect(near.has("smoke")).toBe(false); // the bug: weapon 2 used to fire weapon 1's smoke bomb
  });
});
