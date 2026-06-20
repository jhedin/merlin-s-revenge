// Phase K — deferred AI behaviors: K7 weaponTechnique, K3 pathfinding, K4 bullet-dodge, K5 ghost
// possession, K6 setMultiAttack, K8a builder. Each test pins the faithful mechanic from the Lingo.

import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { spawnFromSymbol } from "@/entities/actorSerial";
import { Movement } from "@/components/movement";
import { Team, Energy } from "@/components/combat";
import { Experience } from "@/components/experience";
import { ColourTransform } from "@/components/colourTransform";
import { WeaponManager } from "@/components/weapon";
import { WeaponTechnique } from "@/components/weaponTechnique";
import { PathFinding } from "@/components/pathFinding";
import { CpuAI } from "@/components/control";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { fireBullet } from "@/systems/bullets";
import { Rng } from "@/engine/math";

function arena(cols = 80, rows = 60): void {
  game.grid = new CollisionGrid(cols, rows, 32);
  game.entities = [];
  game.assets = { index: { anims: {} }, img: () => null, images: { has: () => false }, ensureChar: () => {} } as any;
  game.input = { moveVector: () => ({ x: 0, y: 0 }), cursor: () => null, mouseDown: () => false, held: () => false, pressed: () => false } as any;
  game.teamMaster.reset();
  game.teamMaster.unitMap.configure(32, 0, 0);
  game.teamMaster.bulletMap.configure(32, 0, 0);
  game.rng = new Rng(42);
  game.spawnFromSymbol = spawnFromSymbol;
}

// ── K7 modWeaponTechnique ─────────────────────────────────────────────────────────────────────────
describe("K7 weaponTechnique (attack-anim speedup accumulator)", () => {
  beforeEach(() => arena());

  it("technique 20 accumulates to skip an attack-anim frame after ~5 cycles; technique 0 never triggers", () => {
    const ninja = spawnEnemy("ninja", 100, 100);
    const wt = ninja.get(WeaponTechnique);
    expect(wt.technique).toBe(20);
    // mark the unit in its #attack window so accumulation runs (the controller does this on a strike).
    (ninja.get(CpuAI) as any).attackT = 9999; // force attackActive
    // count frame skips (Anim has no asset here, so frameAdvance is otherwise a no-op).
    let skipped = 0;
    const a = (ninja as any).comps.find((c: any) => typeof c.frameAdvance === "function");
    a.frameAdvance = () => { skipped++; };
    for (let i = 0; i < 30; i++) wt.update(() => {});
    expect(skipped).toBeGreaterThan(0);            // 20·cycles eventually crosses 100 → a frame skip

    const orc = spawnEnemy("warrior", 200, 100);   // technique 0
    expect(orc.get(WeaponTechnique).technique).toBe(0);
    let skipped0 = 0;
    const a0 = (orc as any).comps.find((c: any) => typeof c.frameAdvance === "function");
    a0.frameAdvance = () => { skipped0++; };
    (orc.get(CpuAI) as any).attackT = 9999;
    for (let i = 0; i < 30; i++) orc.get(WeaponTechnique).update(() => {});
    expect(skipped0).toBe(0);                       // default 0 → no anim change
  });

  it("levelUp raises technique by 2", () => {
    const ninja = spawnEnemy("ninja", 100, 100);
    const wt = ninja.get(WeaponTechnique);
    wt.levelUp(() => {});
    expect(wt.technique).toBe(22);
  });

  it("not accumulating outside the attack window (attackActive false)", () => {
    const ninja = spawnEnemy("ninja", 100, 100);
    const wt = ninja.get(WeaponTechnique);
    (ninja.get(CpuAI) as any).attackT = 0; // not attacking
    let skipped = 0;
    const a = (ninja as any).comps.find((c: any) => typeof c.frameAdvance === "function");
    a.frameAdvance = () => { skipped++; };
    for (let i = 0; i < 30; i++) wt.update(() => {});
    expect(skipped).toBe(0);
  });
});

// ── K3 modPathFinding (beeline→scenic) ──────────────────────────────────────────────────────────────
describe("K3 pathfinding (beeline→scenic, NOT A*)", () => {
  beforeEach(() => arena());

  it("beeline aims straight at the goal; open terrain never leaves beeline", () => {
    const pf = new PathFinding();
    const m = new Movement(); (m as any).entity = { send: () => false }; m.x = 100; m.y = 100;
    const rng = new Rng(1);
    // first call sets intent toward the goal (to the right + down).
    pf.findPathToLoc(m, 300, 200, rng);
    expect(m.intentX).toBeGreaterThan(0);
    expect(m.intentY).toBeGreaterThan(0);
    expect(pf.getMode()).toBe("beeline");
    // simulate MOVING toward the goal each tick — no stall → stays beeline.
    for (let i = 0; i < 20; i++) { m.x += 4; m.y += 2; pf.findPathToLoc(m, 300, 200, rng); }
    expect(pf.getMode()).toBe("beeline");
  });

  it("5 zero-movement ticks → scenic with a waypoint within ±100px; arrival within 5px stops", () => {
    const pf = new PathFinding();
    const m = new Movement(); (m as any).entity = { send: () => false }; m.x = 100; m.y = 100;
    const rng = new Rng(7);
    pf.findPathToLoc(m, 500, 100, rng);  // prime lastX
    // hold position (do NOT move m) for the stall window → goes scenic.
    for (let i = 0; i < 6; i++) pf.findPathToLoc(m, 500, 100, rng);
    expect(pf.getMode()).toBe("scenic");
    const wp = pf.getWaypoint();
    expect(Math.abs(wp.x - 100)).toBeLessThanOrEqual(100);
    expect(Math.abs(wp.y - 100)).toBeLessThanOrEqual(100);

    // arrival within 5px of the ULTIMATE goal returns true + zeroes intent.
    m.x = 498; m.y = 100;
    const arrived = pf.findPathToLoc(m, 500, 100, rng);
    expect(arrived).toBe(true);
    expect(m.intentX).toBe(0); expect(m.intentY).toBe(0);
  });

  it("a CPU wedged on a wall goes SCENIC and explores off-axis (random-walk, not a pinned stall)", () => {
    // a solid vertical wall (col 15, full height) between the orc (row 13) and its target past it. A beeline
    // straight at the target stalls on the wall; the faithful pather (NOT A*) then goes #scenic and walks
    // toward a RANDOM ±100px waypoint — so the orc gains off-axis (vertical) movement to explore around the
    // obstacle, instead of standing pinned forever. (It may or may not find a narrow gap — that's faithful.)
    arena(40, 30);
    for (let r = 0; r < 30; r++) game.grid.set(15, r, true);
    const orc = spawnEnemy("warrior", 14 * 32, 13 * 32); orc.get(Team).team = "#orcs";
    orc.get(Movement).x = 14 * 32; orc.get(Movement).y = 13 * 32;
    const t = spawnPlayer(20 * 32, 13 * 32);
    game.entities = [orc, t];
    const startY = orc.get(Movement).y;
    let movedOffAxis = false;
    for (let i = 0; i < 200 && !movedOffAxis; i++) {
      rebuildCombatSubstrate();
      orc.send("update");
      orc.get(Movement).update(() => {});
      if (Math.abs(orc.get(Movement).y - startY) > 16) movedOffAxis = true; // explored vertically (scenic)
    }
    expect(movedOffAxis).toBe(true); // scenic random-walk un-pinned it from the wall (vs beeline-only stall)
  });
});

// ── K4 bullet-dodge ───────────────────────────────────────────────────────────────────────────────
describe("K4 bullet-dodge kiting (objAiCPUSpellCaster)", () => {
  beforeEach(() => arena());

  it("findNearestEnemyBullets returns only HOSTILE-owned bullets (not own-team)", () => {
    const caster = spawnEnemy("goblinMage", 300, 300); caster.get(Team).team = "#goblins";
    game.entities = [caster];
    // an #aldevar bullet (hostile to #goblins) near the caster, and a #goblins bullet (own team) near too.
    const hostile = fireBullet(-1, 320, 300, 1, 0, 1, 0, "#aldevar", 100);
    const own = fireBullet(-1, 305, 300, 1, 0, 1, 0, "#goblins", 100);
    hostile.get(Movement).x = 320; hostile.get(Movement).y = 300;
    own.get(Movement).x = 305; own.get(Movement).y = 300;
    rebuildCombatSubstrate();
    const near = game.teamMaster.findNearestEnemyBullets(caster, 300, 300, 2);
    const found = near.closestList[0]!.obj;
    expect(found).toBe(hostile);            // the hostile bullet, NOT the closer own-team one
  });

  it("a caster runs TANGENT (perpendicular-ish) to an incoming bullet, not straight away", () => {
    const caster = spawnEnemy("goblinMage", 300, 300); caster.get(Team).team = "#goblins";
    const enemy = spawnPlayer(600, 300); // a far committed target so the caster has someone to position vs
    game.entities = [caster, enemy];
    rebuildCombatSubstrate(); caster.send("update"); // commit target
    // a bullet incoming from the LEFT (heading right), close enough to dodge.
    const blt = fireBullet(-1, 280, 300, 1, 0, 1, 0, "#aldevar", 100);
    blt.get(Movement).x = 280; blt.get(Movement).y = 300;
    // force the caster into optimumPosition and tick.
    (caster.get(CpuAI) as any).mode = "optimumPosition";
    (caster.get(CpuAI) as any).dodgesBullets = true;
    rebuildCombatSubstrate();
    const m = caster.get(Movement);
    const before = { x: m.x, y: m.y };
    caster.send("update");
    // the bullet approaches along the x-axis (from the left); a tangent dodge has a real VERTICAL component.
    expect(Math.abs(m.intentY)).toBeGreaterThan(0.1);
  });
});

// ── K5 ghost possession ──────────────────────────────────────────────────────────────────────────
describe("K5 ghost possession (objAiCPUGhost)", () => {
  beforeEach(() => arena());

  it("findUnitOfType('#monk', team) returns the first rostered monk; null when none", () => {
    const monk = spawnEnemy("monk", 200, 200); monk.get(Team).team = "#aldevar";
    game.entities = [monk];
    rebuildCombatSubstrate();
    expect(game.teamMaster.findUnitOfType("#monk", "#aldevar")).toBe(monk);
    expect(game.teamMaster.findUnitOfType("#monk", "#goblins")).toBe(null);
  });

  it("a ghost drifts toward a monk and POSSESSES it on contact (monk gains XP + glows pink, ghost finishes)", () => {
    const ghost = spawnEnemy("monkGhost", 200, 200);
    expect((ghost.get(CpuAI) as any).ghost).toBe(true);
    expect((ghost.get(CpuAI) as any).teamWhenAlive).toBe("#aldevar");
    const monk = spawnEnemy("monk", 260, 200); monk.get(Team).team = "#aldevar";
    game.entities = [ghost, monk];
    const xp0 = monk.get(Experience).xp;
    let possessed = false;
    for (let i = 0; i < 300 && !possessed; i++) {
      rebuildCombatSubstrate();
      ghost.send("update");
      game.entities.forEach((e) => e.send("update"));
      if (ghost.send("isDead")) possessed = true;
    }
    expect(possessed).toBe(true);                        // ghost finished (died) on possession
    expect(monk.get(Experience).xp).toBeGreaterThan(xp0); // monk gained the full imWorth+gained XP
    expect((monk.get(ColourTransform) as any).getColourTransform()).not.toBe(null); // glowPink armed
  });

  it("with NO monk rostered, the ghost drifts forever (faithful, e.g. samii)", () => {
    const ghost = spawnEnemy("monkGhost", 200, 200);
    game.entities = [ghost];
    for (let i = 0; i < 80; i++) { rebuildCombatSubstrate(); ghost.send("update"); ghost.get(Movement).update(() => {}); }
    expect(ghost.send("isDead")).toBe(false);            // never possessed (no monk) → still alive, drifting
  });
});

// ── K6 setMultiAttack ──────────────────────────────────────────────────────────────────────────────
describe("K6 setMultiAttack (range-based 2-weapon auto-switch)", () => {
  beforeEach(() => arena());

  it("a ninja carries BOTH weapons (ranged shuriken + melee ninjaSword)", () => {
    const ninja = spawnEnemy("ninja", 100, 100);
    expect((ninja.get(CpuAI) as any).multiAttack).toBe(true);
    const names = ninja.get(WeaponManager).weaponsOfType("ranged")
      .concat(ninja.get(WeaponManager).weaponsOfType("melee"));
    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  it("beyond bufferDist → ranged weapon 1; within buffer vs non-melee → melee weapon 2", () => {
    const ninja = spawnEnemy("ninja", 100, 100);
    const wm = ninja.get(WeaponManager);
    const target = spawnEnemy("goblinMage", 100, 100); // a ranged (non-melee) target
    // FAR beyond buffer (100) → ranged weapon 1 (shuriken).
    wm.setMultiAttack(target, 1000, 100, 100, 100, 100);
    expect(wm.getCurrentAttack()!.type).toBe("ranged");
    // INSIDE buffer, target is non-melee → melee weapon 2 (ninjaSword).
    wm.setMultiAttack(target, 110, 100, 100, 100, 100);
    expect(wm.getCurrentAttack()!.type).toBe("melee");
  });

  it("a melee target inside buffer at dist²>20 with melee weapon 2 → keep ranged weapon 1 (poke)", () => {
    const ninja = spawnEnemy("ninja", 100, 100);
    const wm = ninja.get(WeaponManager);
    const meleeTarget = spawnEnemy("warrior", 100, 100); // warrior = a melee attacker
    // inside buffer but dist²>20 (target at 130,100 → dist²=900) and weapon 2 is melee → poke from range.
    wm.setMultiAttack(meleeTarget, 130, 100, 100, 100, 100);
    expect(wm.getCurrentAttack()!.type).toBe("ranged");
  });
});

// ── K8a builder AI ─────────────────────────────────────────────────────────────────────────────────
describe("K8a builder AI (objAiCPUBuilder)", () => {
  beforeEach(() => arena());

  it("a dwarf is flagged as a builder with its dwarfTower unitToBuild + buildOne/leaveWhenFinished", () => {
    const dwarf = spawnEnemy("dwarf", 200, 200);
    const ai = dwarf.get(CpuAI) as any;
    expect(ai.builder).toBe(true);
    expect(ai.unitToBuild).toContain("dwarfTower");
    expect(ai.buildOne).toBe(true);
    expect(ai.leaveWhenFinished).toBe(true);
  });

  it("a goblinBuilder walks to a site, builds a dwelling over time, then retires (buildDie)", () => {
    const builder = spawnEnemy("goblinBuilder", 300, 300);
    const ai = builder.get(CpuAI) as any;
    expect(ai.builder).toBe(true);
    expect(ai.buildDie).toBe(true);
    expect(ai.unitToBuild.length).toBeGreaterThan(0);
    game.entities = [builder];
    let built = false;
    for (let i = 0; i < 600 && !builder.send("isDead"); i++) {
      rebuildCombatSubstrate();
      builder.send("update");
      builder.get(Movement).update(() => {});
      // a new building entity appears once construction starts.
      if (game.entities.some((e) => e !== builder && (e.type === "enemy" || e.type === "ally" || e.type === "dwelling"))) built = true;
    }
    expect(built).toBe(true);                  // a dwelling/structure was spawned + constructed
    expect(builder.send("isDead")).toBe(true); // buildDie → the builder retired after building
  });

  it("a builder with no buildable site falls back to fighting (plain CpuAI)", () => {
    const dwarf = spawnEnemy("dwarf", 200, 200);
    (dwarf.get(CpuAI) as any).unitToBuild = []; // strip its build list → fight fallback
    (dwarf.get(CpuAI) as any).builtCount = 0;
    const foe = spawnPlayer(260, 200); foe.get(Team).team = "#goblins"; // hostile to dwarf (#aldevar)
    game.entities = [dwarf, foe];
    rebuildCombatSubstrate(); dwarf.send("update");
    // it should commit a target and fight rather than build.
    const mode = (dwarf.get(CpuAI) as any).builderMode;
    expect(mode).toBe("fight");
  });
});
