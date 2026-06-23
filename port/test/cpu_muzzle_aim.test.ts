// Per-actor gap: an elevated-muzzle ranged CPU (garTower collisionLoc.y −30, dwarfTower −88, towers) aimed
// from the character CENTRE while the bullet LAUNCHED from the muzzle (modAttack.performRangedAttack aims
// distXY = targetLoc − calcAttackLoc, startLoc = calcAttackLoc = muzzle). So a shot at a same-y target flew
// horizontally from the raised muzzle and sailed OVER the target by the muzzle offset — 0 hits at any range.
// Fix: re-derive the aim from the muzzle, so the bullet velocity points muzzle→target (a downward component
// for a raised muzzle vs a same-y foe).
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Team } from "@/components/combat";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import type { Entity } from "@/engine/dispatch";

function stubAssets() {
  const f = (file: string, dela = 1) => ({ file, w: 16, h: 16, reg: [8, 16] as [number, number], dela });
  const frames = (n: number) => Array.from({ length: n }, (_, i) => f(`r${i}.png`));
  game.assets = {
    index: { anims: {
      gar_stand: { delay: 1, loop: true, frames: [f("s.png")] },
      gar_walk: { delay: 1, loop: true, frames: [f("w0.png"), f("w1.png")] },
      gar_weaponRanged: { delay: 1, loop: false, frames: frames(12) }, // #animframe 11 fires within the strip
      scArcherArrow_fly: { delay: 1, loop: true, frames: [f("a.png")] },
    } },
    images: new Map(), img: () => null, ensureChar: () => {},
  } as any;
}

describe("elevated-muzzle ranged CPU aims from the muzzle, not the centre (garTower)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32);
    game.entities = [];
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly; game.spawnEnemy = spawnEnemy;
    game.audio = { play: () => {}, playMusic: () => {} } as any;
    game.rng = { next: () => 0.5, int: (n: number) => Math.max(1, Math.round(n / 2)), range: (a: number, b: number) => (a + b) / 2 } as any; // centred -> no eyestrain scatter
    game.input = {
      moveVector: () => ({ x: 0, y: 0 }), cursor: () => ({ x: 0, y: 0 }), pressed: () => false,
      down: () => false, held: () => false, mousePressed: () => false, mouseDown: () => false,
      mouseVector: () => ({ x: 0, y: 0 }), endTick: () => {},
    } as any;
    stubAssets();
  });

  it("fires a bullet whose velocity points DOWN toward a same-y target (muzzle is 30px above the centre)", () => {
    const tower = spawnEnemy("garTower", 300, 200); tower.get(Team).team = "#goblins";
    tower.get(Movement).x = 300; tower.get(Movement).y = 200;
    const foe = spawnPlayer(420, 200);                 // same y, to the right, within reach 180 (dist 120)
    game.entities = [tower, foe as Entity];

    let bullet: Entity | undefined;
    for (let i = 0; i < 40 && !bullet; i++) {
      rebuildCombatSubstrate();
      for (const e of [...game.entities]) e.send("update");
      bullet = game.entities.find((e) => e.type === "bullet");
    }
    expect(bullet).toBeTruthy();                        // the tower actually fired
    const v = bullet!.get(Movement);
    // muzzle ≈ (305, 170); target (420,200) -> aim has a clear DOWNWARD component. Aiming from the centre
    // (200) at a same-y target would give vy ≈ 0; the muzzle (170) gives vy > 0 toward the foe at 200.
    expect(v.vx).toBeGreaterThan(0);                    // travelling toward the target (rightward)
    expect(v.vy).toBeGreaterThan(0.05 * Math.abs(v.vx)); // and angled down from the raised muzzle (NOT ~horizontal)
  });
});
