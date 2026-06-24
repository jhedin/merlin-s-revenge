import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
import { Hurt } from "@/components/hurt";
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

// objCPUCharacter.collisionWall/collisionVertical: a CPU unit knocked INTO a wall takes (impact -
// damageSpeed) bonus damage on top of the hit. A unit that merely WALKS into a wall takes nothing, and the
// player (objPlayerMerlinCharacter, no collisionWall handler) is exempt.
describe("wall-slam damage (objCPUCharacter.collisionWall)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
  });

  it("an enemy knocked into a wall takes (impact - damageSpeed) BONUS damage on top of the hit", () => {
    for (let ty = 0; ty < 40; ty++) game.grid.set(7, ty, true); // wall column at tile 7 (x>=224)
    const e = spawnEnemy("swordOrc", 7 * 32 - 10, 100, { animChar: "swordOrc" }); // just left of the wall
    e.get(Movement).inertia = 0; e.get(Movement).damageSpeed = 5;
    game.entities = [e];
    const hp0 = e.get(Energy).energy;
    e.send("takeHit", 60, 0, 999, 1);                  // 60 dmg + a hard shove toward the wall (no attacker entity)
    expect(hp0 - e.get(Energy).energy).toBe(60);        // just the hit so far
    let everHit = false;
    for (let i = 0; i < 10; i++) { e.send("update"); everHit ||= e.get(Movement).hitX; } // knockback into the wall
    expect(everHit).toBe(true);                         // it slammed the wall
    expect(hp0 - e.get(Energy).energy).toBe(60 + 55);   // + (60 - damageSpeed 5) wall bonus
  });

  it("a unit that WALKS into a wall (no knockback) takes no wall damage", () => {
    for (let ty = 0; ty < 40; ty++) game.grid.set(7, ty, true);
    const e = spawnEnemy("swordOrc", 6 * 32 + 8, 100, { animChar: "swordOrc" });
    const m = e.get(Movement); m.maxSpeed = 6;
    game.entities = [e];
    const hp0 = e.get(Energy).energy;
    for (let i = 0; i < 20; i++) { m.intentX = 1; (m as any).update(() => {}); } // walk right into the wall
    expect(m.hitX).toBe(true);
    expect(e.get(Energy).energy).toBe(hp0);             // walking into a wall is harmless
  });

  it("the player takes NO wall-slam damage (objPlayerMerlinCharacter has no collisionWall)", () => {
    for (let ty = 0; ty < 40; ty++) game.grid.set(7, ty, true);
    const p = spawnPlayer(7 * 32 - 10, 100); game.player = p; // just left of the wall
    p.get(Movement).inertia = 0;
    game.entities = [p];
    p.send("takeHit", 60, 0, 999, 1);                  // hit + knockback toward the wall
    const afterHit = p.get(Energy).energy;
    let everHit = false;
    for (let i = 0; i < 10; i++) { (p.get(Movement) as any).update(() => {}); everHit ||= p.get(Movement).hitX; }
    expect(everHit).toBe(true);                         // the player DID reach the wall
    expect(p.get(Energy).energy).toBe(afterHit);        // but takes NO extra wall damage
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

  it("a ghost is clamped to the play area (autoConstrainToPlayArea), can't drift off-map", () => {
    const ghost = spawnEnemy("greyGhost", 5 * 32, 64, { animChar: "greyGhost" });
    const m = ghost.get(Movement); m.maxSpeed = 8;
    // drive it WEST past the left edge (x=0); the clamp must hold it inside [box/2, ...].
    for (let i = 0; i < 80; i++) { m.intentX = -1; (m as any).update(() => {}); }
    expect(m.x).toBeGreaterThanOrEqual(m.box / 2 - 0.001); // clamped at the left bound, not gone negative
  });
});

// objCPUCharacter.takeHit amGhost gate: a true #ghost (monkGhost) is invulnerable to external attacks;
// only its own possession-finish (attackerId == self) lands. (greyGhost/bat pass walls but ARE damageable.)
describe("ghost damage immunity (#ghost amGhost gate)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
  });

  it("monkGhost ignores external attacks but dies to its own possession-finish; greyGhost stays damageable", () => {
    const ghost = spawnEnemy("monkGhost", 100, 100, { animChar: "monkGhost" });
    const en = ghost.get(Energy); const hp0 = en.energy;
    ghost.send("takeHit", 99999, 0, 42, 1);          // external attacker (id 42)
    expect(en.energy).toBe(hp0);                       // no damage — immune
    expect(ghost.send("isDead")).toBe(false);
    ghost.send("takeHit", 99999, 0, ghost.id, 1);      // its OWN possession-finish (attackerId == self)
    expect(ghost.send("isDead")).toBe(true);           // lands -> dies

    const grey = spawnEnemy("greyGhost", 200, 200, { animChar: "greyGhost" });
    grey.get(Movement).inertia = 0;
    const ge = grey.get(Energy); const gh0 = ge.energy;
    grey.send("takeHit", 5, 0, 42, 1);                 // collisionDetection:false but NOT #ghost -> damageable
    expect(ge.energy).toBeLessThan(gh0);
  });
});

// modReel.updateReel = getStalled(): the reel/dazed window ends when the knockback SLIDE stalls — so its
// length scales with the hit's force (and per-actor frictionReel), instead of a flat 6 frames for everyone.
describe("reel/dazed ends on knockback-stall (modReel), not a flat 6", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => null, mouseDown: () => false,
      mousePressed: () => false, mouseReleased: () => false, held: () => false, pressed: () => false, endTick() {} } as any;
  });

  function reelFrames(knock: number): number {
    game.entities = [];
    const e = spawnEnemy("swordOrc", 500, 500, { animChar: "swordOrc" });
    e.get(Movement).inertia = 0; game.entities = [e];   // undamped: the full collision vector becomes knockback
    e.send("takeHit", knock, 0, -1, 1);
    let n = 0;
    while (e.get(Hurt).isReeling() && n < 60) { e.send("update"); n++; }
    return n;
  }

  it("a harder hit staggers longer than a soft one (reel scales with the slide)", () => {
    const soft = reelFrames(2);                 // a small shove settles fast
    const hard = reelFrames(60);                // a big shove (clamped to KNOCK_MAX) slides longer
    expect(hard).toBeGreaterThan(soft);         // dynamic — NOT a flat 6 for both
    expect(soft).toBeGreaterThan(0);
  });
});
