// characterEnergyRollOverMaster: the mouse-hover picks the character under the cursor (its energy/level/XP
// then float at the unit). gEnemyEnergyMasterOn=0 -> there are NO always-on bars, so this is the only path.
import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Experience } from "@/components/experience";
import { Anim } from "@/components/anim";
import { pickHoveredUnit, HealthRollover } from "@/render/rollover";

describe("health rollover hover-pick (characterEnergyRollOverMaster)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("returns the unit whose body box contains the cursor", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const b = spawnEnemy("swordOrc", 300, 100, { animChar: "swordOrc" });
    game.entities = [a, b];
    expect(pickHoveredUnit({ x: 100, y: 90 }, game.entities)).toBe(a);  // over a's body
    expect(pickHoveredUnit({ x: 300, y: 95 }, game.entities)).toBe(b);  // over b's body
  });

  it("returns null when the cursor is over empty space", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    expect(pickHoveredUnit({ x: 250, y: 250 }, game.entities)).toBeNull();
    expect(pickHoveredUnit(null, game.entities)).toBeNull();           // no mouse
  });

  it("ignores dead units (no rollover for a corpse)", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    a.get(Energy).dead = true;
    game.entities = [a];
    expect(pickHoveredUnit({ x: 100, y: 90 }, game.entities)).toBeNull();
  });

  it("picks the closer unit when two overlap the cursor", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const b = spawnEnemy("swordOrc", 110, 100, { animChar: "swordOrc" });
    game.entities = [a, b];
    expect(pickHoveredUnit({ x: 108, y: 88 }, game.entities)).toBe(b);  // nearer b's centre
  });
});

// characterEnergyRollOverMaster.update: the ORIGINAL target lock is STICKY — it does NOT clear the instant
// the cursor leaves the unit's rect. It only (re)acquires when the cursor is over the globally-nearest
// hoverable unit, and only clears when that unit dies or NO hoverable unit exists anywhere in the world.
describe("HealthRollover: sticky single-slot target lock (characterEnergyRollOverMaster.update)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("locks onto a unit when hovered, and stays locked as the cursor moves away (does not clear)", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const b = spawnEnemy("swordOrc", 300, 300, { animChar: "swordOrc" }); // present but never hovered
    game.entities = [a, b];
    const roll = new HealthRollover();
    expect(roll.update({ x: 100, y: 90 }, game.entities)).toBe(a); // hover directly over a -> locks on
    // move the cursor far away from BOTH units — the original's target sticks (b is nearer now but was
    // never actually hovered, so it never takes the lock; a is neither hovered nor dead, so it stays).
    expect(roll.update({ x: 500, y: 500 }, game.entities)).toBe(a);
    expect(roll.update({ x: 250, y: 250 }, game.entities)).toBe(a);
  });

  it("switches the lock only when a DIFFERENT unit is directly hovered", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const b = spawnEnemy("swordOrc", 300, 100, { animChar: "swordOrc" });
    game.entities = [a, b];
    const roll = new HealthRollover();
    roll.update({ x: 100, y: 90 }, game.entities); // lock a
    expect(roll.update({ x: 200, y: 200 }, game.entities)).toBe(a); // sticky, not over either
    expect(roll.update({ x: 300, y: 95 }, game.entities)).toBe(b);  // now directly over b -> switches
  });

  it("clears when the locked target dies", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    const roll = new HealthRollover();
    roll.update({ x: 100, y: 90 }, game.entities); // lock a
    a.get(Energy).dead = true;
    expect(roll.update({ x: 500, y: 500 }, game.entities)).toBeNull(); // a died -> clears, nothing else to lock
  });

  it("clears when there is nothing left in the world to hover (obj = #none)", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    const roll = new HealthRollover();
    roll.update({ x: 100, y: 90 }, game.entities); // lock a
    game.entities = []; // a left the world entirely (room transition, despawn, etc.)
    expect(roll.update({ x: 500, y: 500 }, game.entities)).toBeNull();
  });

  it("never acquires a lock before anything is ever hovered, even with live units present", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    const roll = new HealthRollover();
    expect(roll.update({ x: 500, y: 500 }, game.entities)).toBeNull(); // never over a -> never locks
  });
});

// Layout: objMoveableEnergyBar/ExperienceBar sit directly BELOW the sprite (surroundHeight=4, +3 stacked
// gap for XP); objMoveableLevelBar floats ABOVE it. No shared background panel. XP hidden at 0 XP.
describe("HealthRollover.draw: original layout (bars below the sprite, stars above, no shared panel)", () => {
  function recordingRenderer() {
    const rects: { x: number; y: number; w: number; h: number; style: string }[] = [];
    const images: { x: number; y: number }[] = [];
    let style = "";
    const ctx = {
      get fillStyle() { return style; },
      set fillStyle(v: string) { style = v; },
      fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h, style }),
      drawImage: (_img: unknown, x: number, y: number) => images.push({ x, y }),
    };
    return { rects, images, renderer: { ctx } as any };
  }

  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("draws the energy bar strictly BELOW the unit's loc — no combined box straddling/above it", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    const roll = new HealthRollover();
    roll.update({ x: 100, y: 90 }, game.entities);
    const { rects, renderer } = recordingRenderer();
    roll.draw(renderer, undefined);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) expect(r.y).toBeGreaterThan(100); // strictly below the loc (y=100)
  });

  it("hides the experience bar entirely at 0 XP (not drawn as an empty bar)", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [a];
    expect(a.tryGet(Experience)!.xp).toBe(0);
    const roll = new HealthRollover();
    roll.update({ x: 100, y: 90 }, game.entities);
    const { rects, renderer } = recordingRenderer();
    roll.draw(renderer, undefined);
    // energy bar = 2 fillRect calls (surround + fill); no xp bar rects at all.
    expect(rects.length).toBe(2);
  });

  it("shows the experience bar once xp > 0, stacked below the energy bar", () => {
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    a.tryGet(Experience)!.xp = 5;
    game.entities = [a];
    const roll = new HealthRollover();
    roll.update({ x: 100, y: 90 }, game.entities);
    const { rects, renderer } = recordingRenderer();
    roll.draw(renderer, undefined);
    // energy bar (2 rects) + xp bar (2 rects) = 4.
    expect(rects.length).toBe(4);
    const energyY = Math.min(...rects.slice(0, 2).map((r) => r.y));
    const xpY = Math.min(...rects.slice(2, 4).map((r) => r.y));
    expect(xpY).toBeGreaterThan(energyY); // xp sits BELOW energy (further from the sprite)
  });
});

// Anim.getWorldBounds: objGameObject.calcEnergyRectBottom's exact formula —
//   energyRect = standMember.rect + rect(loc,loc) - rect(reg,reg)
// i.e. world rect = [loc - reg, loc - reg + (w,h)], using the renderer's own (x-regX, y-regY) draw
// convention. useStand pins to strip frame 1 of `<char>_stand` regardless of the currently-playing action.
describe("Anim.getWorldBounds (objGameObject.calcEnergyRectBottom formula)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32);
    game.entities = [];
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });

  it("computes the world rect from loc, frame size, and reg point — for the STAND strip specifically", () => {
    game.assets = {
      index: { anims: {
        swordOrc_stand: { delay: 1, frames: [{ file: "a.png", w: 20, h: 30, reg: [10, 28] }] },
        swordOrc_attack: { delay: 1, frames: [{ file: "b.png", w: 40, h: 30, reg: [10, 28] }] }, // wider mid-swing
      } },
      img: () => null,
    } as any;
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    const anim = a.tryGet(Anim)!;
    const stand = anim.getWorldBounds(true)!;
    expect(stand).toEqual({ left: 100 - 10, top: 100 - 28, right: 100 - 10 + 20, bottom: 100 - 28 + 30 });

    // force the live action to the (wider) attack strip — STAND bounds must stay pinned to the stand frame,
    // not follow the swing (so the rollover UI doesn't jitter with the attack pose).
    (anim as any).action = "attack";
    const standWhileAttacking = anim.getWorldBounds(true)!;
    expect(standWhileAttacking).toEqual(stand); // unchanged — still reads swordOrc_stand
    const live = anim.getWorldBounds(false)!; // but the LIVE (hit-test) bounds DO track the current pose
    expect(live.right - live.left).toBe(40); // the wider attack frame
  });

  it("returns null when the strip isn't loaded (no bundled art / not yet fetched)", () => {
    game.assets = { index: { anims: {} }, img: () => null } as any;
    const a = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    expect(a.tryGet(Anim)!.getWorldBounds(true)).toBeNull();
    expect(a.tryGet(Anim)!.getWorldBounds(false)).toBeNull();
  });
});
