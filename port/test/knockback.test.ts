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

  it("damage is the L1 magnitude of the vector times damageMultiplier", () => {
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

  it("inertia reduces the shove (heavy units resist) without changing damage", () => {
    const light = spawnEnemy("swordOrc", 200, 500, { animChar: "swordOrc" });
    const heavy = spawnEnemy("swordOrc", 800, 500, { animChar: "swordOrc" });
    light.get(Movement).inertia = 0;
    heavy.get(Movement).inertia = 80;
    game.entities = [light, heavy];
    const lm = light.get(Movement), hm = heavy.get(Movement);
    const lx0 = lm.x, hx0 = hm.x;
    const lhp = light.get(Energy).energy, hhp = heavy.get(Energy).energy;
    light.send("takeHit", 60, 0, -1, 1);
    heavy.send("takeHit", 60, 0, -1, 1);
    for (let i = 0; i < 4; i++) { light.send("update"); heavy.send("update"); }
    expect(lm.x - lx0).toBeGreaterThan(hm.x - hx0);                 // light flies further
    expect(light.get(Energy).energy).toBe(heavy.get(Energy).energy); // ...but both take the same damage
    expect(lhp - light.get(Energy).energy).toBe(60);
    expect(hhp - heavy.get(Energy).energy).toBe(60);
  });

  it("aimedVect builds a vector whose L1 magnitude equals the requested damage", () => {
    const v = aimedVect(2, 2, 30);            // diagonal
    expect(Math.abs(v.x) + Math.abs(v.y)).toBeCloseTo(30, 6);
    const h = aimedVect(0, 0, 12);            // degenerate -> horizontal
    expect(h).toEqual({ x: 12, y: 0 });
  });
});
