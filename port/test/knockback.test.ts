import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
import { aimedVect } from "@/engine/math";

// Keystone A1: takeHit carries a collision VECTOR. damage = (|vx|+|vy|)*mult (modEnergy); the same
// vector is applied as knockback (objGameObject), damped by inertia.
describe("damage == knockback (collision vector)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); // open arena
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => null, mouseDown: () => false,
      mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick() {} } as any;
  });

  it("damage is the L1 magnitude of the vector times damageMultiplier (inertia 0 -> undamped)", () => {
    const e = spawnEnemy("swordOrc", 500, 500, { animChar: "swordOrc" });
    e.get(Movement).inertia = 0;
    game.entities = [e];
    const en = e.get(Energy); const hp0 = en.energy;
    e.send("takeHit", 3, 4, -1, 1);          // |3|+|4| = 7
    expect(en.energy).toBe(hp0 - 7);
    e.send("takeHit", 10, 0, -1, 2);         // 10 * mult 2 = 20
    expect(en.energy).toBe(hp0 - 27);
  });

  it("a hit shoves the victim along the hit direction", () => {
    const e = spawnEnemy("swordOrc", 500, 500, { animChar: "swordOrc" });
    e.get(Movement).inertia = 0;
    game.entities = [e];
    const m = e.get(Movement); const x0 = m.x;
    e.send("takeHit", 60, 0, -1, 1);         // knockback +x
    for (let i = 0; i < 4; i++) e.send("update"); // idle AI (no target) -> only knockback moves it
    expect(m.x).toBeGreaterThan(x0 + 1);
  });

  it("inertia reduces the shove (heavy units resist the knockback impulse)", () => {
    const light = spawnEnemy("swordOrc", 200, 500, { animChar: "swordOrc" });
    const heavy = spawnEnemy("swordOrc", 800, 500, { animChar: "swordOrc" });
    light.get(Movement).inertia = 0;
    heavy.get(Movement).inertia = 80;
    game.entities = [light, heavy];
    const lm = light.get(Movement), hm = heavy.get(Movement);
    const lx0 = lm.x, hx0 = hm.x;
    light.send("takeHit", 60, 0, -1, 1);
    heavy.send("takeHit", 60, 0, -1, 1);
    for (let i = 0; i < 4; i++) { light.send("update"); heavy.send("update"); }
    expect(lm.x - lx0).toBeGreaterThan(hm.x - hx0);                 // light flies further
  });

  // K1 — the coupling: inertia now damps DAMAGE too (objGameObject damps the vector ONCE, modEnergy then
  // reads the damped vector). A hit on an inertia-80 actor deals 0.2x the damage of the same hit on an
  // inertia-0 actor (was equal pre-K1 because damage was passed through undamped).
  it("inertia damps DAMAGE: inertia-80 takes ~0.2x the inertia-0 damage from the same vector", () => {
    const light = spawnEnemy("swordOrc", 200, 500, { animChar: "swordOrc" });
    const heavy = spawnEnemy("swordOrc", 800, 500, { animChar: "swordOrc" });
    light.get(Movement).inertia = 0;
    heavy.get(Movement).inertia = 80;
    game.entities = [light, heavy];
    const lhp = light.get(Energy).energy, hhp = heavy.get(Energy).energy;
    light.send("takeHit", 60, 0, -1, 1); // inertia 0 -> full 60
    heavy.send("takeHit", 60, 0, -1, 1); // inertia 80 -> 60 * 0.2 = 12
    const ldmg = lhp - light.get(Energy).energy;
    const hdmg = hhp - heavy.get(Energy).energy;
    expect(ldmg).toBe(60);
    expect(hdmg).toBeCloseTo(12, 6);             // 60 * (100-80)/100
    expect(hdmg / ldmg).toBeCloseTo(0.2, 6);     // the damped ratio
  });

  it("aimedVect builds a vector whose L1 magnitude equals the requested damage", () => {
    const v = aimedVect(2, 2, 30);            // diagonal
    expect(Math.abs(v.x) + Math.abs(v.y)).toBeCloseTo(30, 6);
    const h = aimedVect(0, 0, 12);            // degenerate -> horizontal
    expect(h).toEqual({ x: 12, y: 0 });
  });
});

// objGameObject.checkCollisions runs only when pCollisionDetection. #collisionDetection:false units
// (greyGhost/bat/summon*) and #objAiCPUGhost (monkGhost) DRIFT THROUGH walls -> port passThrough.
describe("ghost/no-collision units pass through terrain (collisionDetection:false)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
  });

  it("collisionDetection:false and ghost-AI units get passThrough; normal units don't", () => {
    expect((spawnEnemy("greyGhost", 0, 0, { animChar: "greyGhost" }).get(Movement) as any).passThrough).toBe(true);
    expect((spawnEnemy("bat", 0, 0, { animChar: "bat" }).get(Movement) as any).passThrough).toBe(true);
    expect((spawnEnemy("monkGhost", 0, 0, { animChar: "monkGhost" }).get(Movement) as any).passThrough).toBe(true);
    expect((spawnEnemy("summonWarrior", 0, 0, { animChar: "summonWarrior" }).get(Movement) as any).passThrough).toBe(true);
    expect((spawnEnemy("swordOrc", 0, 0, { animChar: "swordOrc" }).get(Movement) as any).passThrough).toBe(false);
  });

  it("a passThrough unit's Movement integrates through a solid wall tile (no moveBox stall)", () => {
    for (let ty = 0; ty < 40; ty++) game.grid.set(20, ty, true); // vertical wall at tile x=20
    const ghost = spawnEnemy("greyGhost", 19 * 32, 64, { animChar: "greyGhost" });
    const m = ghost.get(Movement); m.maxSpeed = 4;
    // drive Movement directly (bypass the AI, which rezeroes intent with no target): hold intent east.
    for (let i = 0; i < 60; i++) { m.intentX = 1; (m as any).update(() => {}); }
    expect(m.x).toBeGreaterThan(21 * 32); // crossed the wall column instead of stalling on it
  });
});
