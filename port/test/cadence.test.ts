// Ranged re-fire cadence: the original resets the cooldown at the FIRING frame (objAiAttack:319), not at
// attack entry, so the cadence = max(strip, recovery + fire-frame-offset). The port adds that fire-frame
// offset to the calibrated recovery (attackFireFrameOffset), replacing the old flat +18 — which over-slowed
// early/low-cooldown shooters. This pins both ends: an early-firing cd-0 actor (undeadDragon, #animframe 3)
// fires fast, a late-firing cd-30 actor (quadranid, #animframe 23) stays slow.
import { describe, it, expect, beforeEach } from "vitest";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { Projectile } from "@/components/projectile";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
import assets from "@/generated/assets.json";

function modeGap(actor: string): number {
  game.assets = { index: assets, images: new Map(), img: () => null, ensureChar: async () => {} } as any;
  game.grid = new CollisionGrid(80, 80, 32);
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  const e = spawnEnemy(actor, 100, 100);
  const target = spawnPlayer(180, 100);            // inert (no input) target, kept alive + pinned
  game.entities = [e, target];
  const te = target.get(Energy) as any;
  const seen = new Set<number>(); const ticks: number[] = [];
  for (let t = 0; t < 400; t++) {
    te.energy = 99999; te.max = 99999; te.dead = false;
    target.get(Movement).x = 180; target.get(Movement).y = 100;
    rebuildCombatSubstrate();
    e.send("update");
    for (const en of game.entities) { const p = en.tryGet(Projectile); if (p && (p as any).ownerId === e.id && !seen.has(en.id)) { seen.add(en.id); ticks.push(t); } }
  }
  const gaps: Record<number, number> = {}; let best = 0, bv = -1;
  for (let i = 1; i < ticks.length; i++) { const g = ticks[i]! - ticks[i - 1]!; gaps[g] = (gaps[g] ?? 0) + 1; if (gaps[g]! > bv) { bv = gaps[g]!; best = g; } }
  return best;
}

describe("ranged re-fire cadence reflects the fire-frame cooldown offset", () => {
  beforeEach(() => { game.entities = []; });

  it("undeadDragon (cd 0, fires early on #animframe 3) re-fires fast (~15t, faster than the old flat +18)", () => {
    const gap = modeGap("undeadDragon");
    expect(gap).toBeGreaterThan(10);
    expect(gap).toBeLessThan(18); // strip-gated, NOT the old 18-tick floor
  });

  it("quadranid (cd 30, fires late on #animframe 23) stays slow (~51t — the full replay + recovery)", () => {
    const gap = modeGap("quadranid");
    expect(gap).toBeGreaterThan(45);
  });
});
