import { describe, it, expect, beforeEach } from "vitest";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { EnemyArchetype, spawnEnemy, spawnUnit } from "@/entities/archetypes";
import { Movement } from "@/components/movement";
import { Energy, Team } from "@/components/combat";
import { Experience } from "@/components/experience";
import type { Entity } from "@/engine/dispatch";

// E1 modReincarnate: a REAL combat death (killed-in-action) splits an actor into its #reincarnateAs
// children at the corpse loc, fires EXACTLY ONCE (latch), children re-arm their own reincarnate, a
// depth/count guard caps a cyclic chain, team/level come from child data, and a non-combat removal
// (retire/room-exit) does NOT split.

function setupWorld(): void {
  game.grid = new CollisionGrid(80, 80, 32); // wide-open arena
  game.entities = [];
  game.assets = { index: { anims: {} }, img: () => null } as any;
  game.spawnEnemy = spawnEnemy; game.spawnUnit = spawnUnit;
  game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
}

// Build a synthetic reincarnating actor with an explicit #reincarnateAs (no map/data dependency for the
// chain shape). It reincarnates into REAL actors so spawnUnit can resolve their data.
function makeChain(reincarnateAs: string[] | string, x: number, y: number, energy = 10): Entity {
  const e = EnemyArchetype.create(0 as any).build({
    x, y, energy, team: "#monsters", teamRole: "#teamMembers",
    reincarnateAs, walkSpeed: 0,
  });
  // EnemyArchetype.create needs a real id; rebuild with a fresh id via the factory is fine for tests.
  e.get(Movement).x = x; e.get(Movement).y = y;
  return e;
}

// deal a lethal damage hit: damage = (|vx|+|vy|)*mult; vx=energy guarantees <=0.
function kill(e: Entity, attackerId = -1): void {
  const en = e.get(Energy);
  // K1: inertia damps the takeHit vector (and thus damage) by (100-inertia)/100, so to guarantee a lethal
  // hit on a high-inertia skeleton part we send a vector large enough to remain lethal AFTER damping.
  const inertia = e.get(Movement).inertia;
  const d = (100 - inertia) / 100;
  e.send("takeHit", (en.max + 1) / (d || 1), 0, attackerId, 1);
}

describe("Reincarnate (modReincarnate) cascade", () => {
  beforeEach(setupWorld);

  it("a 3-tier chain spawns the right children IN ORDER at the corpse loc, then each tier re-arms", () => {
    // A -> [skelitonUpper, skelitonSword]; skelitonUpper itself -> [TorsoTank, Arm, Arm] (its own data).
    const a = makeChain(["#skelitonUpper", "#skelitonSword"], 300, 300);
    game.entities = [a];

    kill(a);
    expect(a.send("isDead")).toBe(true);
    expect(a.send("getKilledInAction")).toBe(true);

    a.send("update"); // death-finalize edge: spawns the two children
    const kids = game.entities.filter((e) => e !== a);
    expect(kids.length).toBe(2);
    // ORDER preserved (list order): first child = skelitonUpper, second = skelitonSword.
    expect(kids[0]!.send("getActorType")).toBe("skelitonUpper");
    expect(kids[1]!.send("getActorType")).toBe("skelitonSword");
    // LOC: first child exactly at the corpse; the rest fan out (not at the exact same point).
    // first child spawns AT the corpse (within a px of the death-finalize loc — the lethal hit's
    // knockback may nudge the still-integrating corpse a fraction this tick; it is NOT a stale/zeroed loc).
    const p0 = kids[0]!.send("getPos");
    expect(Math.hypot(p0.x - 300, p0.y - 300)).toBeLessThan(2);
    // the second child fans out by #reincarnateRadius (clearly offset from the first).
    const p1 = kids[1]!.send("getPos");
    expect(Math.hypot(p1.x - p0.x, p1.y - p0.y)).toBeGreaterThan(5);

    // Tier 2 re-arms its OWN reincarnate: kill the spawned skelitonUpper -> its data children appear.
    const upper = kids[0]!;
    kill(upper);
    upper.send("update");
    const grandkids = game.entities.filter((e) => e !== a && e !== kids[0] && e !== kids[1]);
    // skelitonUpper.reincarnateAs = [#skelitonTorsoTank, #skelitonArm, #skelitonArm] -> 3 children.
    expect(grandkids.length).toBe(3);
    const types = grandkids.map((e) => e.send("getActorType")).sort();
    expect(types).toEqual(["skelitonArm", "skelitonArm", "skelitonTorsoTank"]);
  });

  it("fires EXACTLY ONCE — repeated updates in the death frame do not duplicate the cascade", () => {
    const a = makeChain(["#skelitonSword", "#skelitonSword"], 100, 100);
    game.entities = [a];
    kill(a);
    a.send("update"); a.send("update"); a.send("update"); // hammer the death frame
    const kids = game.entities.filter((e) => e !== a);
    expect(kids.length).toBe(2); // latch held — not 4 or 6
  });

  it("skips #none entries: [#skelitonHead, #none] spawns ONE child", () => {
    const a = makeChain(["#skelitonHead", "#none"], 50, 50);
    game.entities = [a];
    kill(a); a.send("update");
    const kids = game.entities.filter((e) => e !== a);
    expect(kids.length).toBe(1);
    expect(kids[0]!.send("getActorType")).toBe("skelitonHead");
  });

  it("a BARE symbol (#hydra2) parses to a single child", () => {
    const a = makeChain("#skelitonSword", 70, 70);
    game.entities = [a];
    kill(a); a.send("update");
    const kids = game.entities.filter((e) => e !== a);
    expect(kids.length).toBe(1);
    expect(kids[0]!.send("getActorType")).toBe("skelitonSword");
  });

  it("a non-combat removal (retire / room-exit) does NOT split — killedInAction gate", () => {
    const a = makeChain(["#skelitonSword"], 200, 200);
    game.entities = [a];
    // simulate a retire/cull: mark dead directly WITHOUT a lethal takeHit (no killedInAction flag).
    a.get(Energy).dead = true;
    expect(a.send("isDead")).toBe(true);
    expect(a.send("getKilledInAction")).toBe(false);
    a.send("update"); a.send("update");
    const kids = game.entities.filter((e) => e !== a);
    expect(kids.length).toBe(0); // no reincarnation on a non-combat removal
  });

  it("the depth/count guard caps a CYCLIC chain (A -> A) instead of spawning forever", () => {
    // a synthetic self-referential type: spawnUnit resolves a real actor but we force reincarnateAs to
    // point back at a self-cycling synthetic by stubbing game.spawnUnit to always make another cycler.
    const realSpawn = game.spawnUnit!;
    let totalSpawned = 0;
    const makeCycler = (x: number, y: number): Entity => {
      const e = EnemyArchetype.create(0 as any).build({
        x, y, energy: 1, team: "#monsters", reincarnateAs: ["#cycle"], walkSpeed: 0,
      });
      e.get(Movement).x = x; e.get(Movement).y = y;
      return e;
    };
    game.spawnUnit = ((typ: string, x: number, y: number) => {
      if (typ === "cycle") { totalSpawned++; const c = makeCycler(x, y); game.entities.push(c); return c; }
      return realSpawn(typ, x, y, {});
    }) as any;

    const root = makeCycler(0, 0);
    game.entities = [root];
    // drive the cascade to exhaustion: kill+update every live cycler repeatedly.
    for (let pass = 0; pass < 50; pass++) {
      for (const e of [...game.entities]) {
        if (!e.send("isDead")) kill(e);
        e.send("update");
      }
    }
    game.spawnUnit = realSpawn;
    // bounded: the depth budget (12) terminates the cycle; nowhere near unbounded.
    expect(totalSpawned).toBeLessThan(20);
    expect(totalSpawned).toBeGreaterThan(0);
  });

  it("team & level come from the CHILD's own data, not inherited from the parent", () => {
    // parent forced onto a bogus team; the skeleton child must land on its OWN #undead team.
    const a = EnemyArchetype.create(0 as any).build({
      x: 10, y: 10, energy: 5, team: "#someBogusTeam", reincarnateAs: ["#skelitonArm"], walkSpeed: 0,
    });
    a.get(Movement).x = 10; a.get(Movement).y = 10;
    game.entities = [a];
    kill(a); a.send("update");
    const kid = game.entities.find((e) => e !== a)!;
    expect(kid.send("getTeam")).toBe("#undead"); // skelitonArm's own data team, NOT #someBogusTeam
  });

  it("honors #minEnergy: a multistage actor dies (and reincarnates) at the minEnergy floor, not 0", () => {
    // synthetic: energy 100, minEnergy 60 -> a 50-damage hit (energy->50<=60) is lethal.
    const a = EnemyArchetype.create(0 as any).build({
      x: 0, y: 0, energy: 100, minEnergy: 60, team: "#monsters", reincarnateAs: ["#skelitonSword"], walkSpeed: 0,
    });
    a.get(Movement).x = 0; a.get(Movement).y = 0;
    game.entities = [a];
    a.send("takeHit", 50, 0, -1, 1); // energy 100 -> 50, which is <= minEnergy 60 => dead
    expect(a.send("isDead")).toBe(true);
    expect(a.send("getKilledInAction")).toBe(true);
    a.send("update");
    expect(game.entities.filter((e) => e !== a).length).toBe(1);
  });
});

describe("skelitonLord full tree (real data)", () => {
  beforeEach(setupWorld);

  it("the Lord splits into Upper+LowerLeg+Sword, and the whole tree drains to leaves", () => {
    const lord = spawnUnit("skelitonLord", 400, 300, {});
    game.entities = [lord];
    expect(lord.send("getTeam")).toBe("#undead");

    kill(lord);
    lord.send("update");
    let kids = game.entities.filter((e) => e !== lord).map((e) => e.send("getActorType"));
    expect(kids.sort()).toEqual(["skelitonLowerLeg", "skelitonSword", "skelitonUpper"]);

    // Drive the entire tree to death: repeatedly kill every non-dead reincarnator and tick it.
    const distinctSeen = new Set<string>();
    for (let pass = 0; pass < 30; pass++) {
      for (const e of [...game.entities]) {
        distinctSeen.add(e.send("getActorType"));
        if (!e.send("isDead")) kill(e);
        e.send("update");
      }
    }
    // every part type in the tree should have appeared somewhere in the cascade.
    for (const t of ["skelitonLord", "skelitonUpper", "skelitonLowerLeg", "skelitonSword",
      "skelitonTorsoTank", "skelitonArm", "skelitonHead", "skelitonFootSoldier"]) {
      expect(distinctSeen.has(t)).toBe(true);
    }
    // room-clear predicate: after draining, no live (enemy/ally && !dead) reincarnators remain.
    const live = game.entities.filter((e) => !e.send("isDead"));
    expect(live.length).toBe(0);
  });

  it("skelitonHead is reel-proof: it takes damage and is STILL shoved, but doesn't enter the reel mode", () => {
    // modReel.takeHit: ancestor.takeHit (objGameObject) shoves EVERY unit; reelProof only gates goDamageMode
    // (the stagger). So a reel-proof unit still gets the knockback impulse — it just never reels.
    const head = spawnUnit("skelitonHead", 100, 100, {});
    head.get(Movement).inertia = 0; // undamped, so the shove is visible
    const before = head.get(Energy).energy;
    head.send("takeHit", 5, 0, -1, 1);
    expect(head.get(Energy).energy).toBeLessThan(before); // damage landed
    expect(head.get(Movement).kvx).toBeGreaterThan(0);    // STILL shoved along the hit (objGameObject.takeHit)
    expect(head.send("isHurt")).toBe(false);              // but no reel stagger (reelProof gates goDamageMode)
  });

  // modExperience.transferExperience (#reincarnated): each child inherits HALF the parent's accumulated XP.
  it("a reincarnating parent transfers half its accumulated XP to each child", () => {
    const a = makeChain(["#skelitonUpper", "#skelitonSword"], 300, 300);
    game.entities = [a];
    a.send("gainXp", 40);                       // parent earned 40 kill-XP during the fight
    const parentXp = a.get(Experience).xp;      // cumulative (stays 40 across any level-ups)
    kill(a);
    a.send("update");                           // splits -> two children
    const kids = game.entities.filter((e) => e !== a);
    expect(kids.length).toBe(2);
    for (const kid of kids) expect(kid.get(Experience).xp).toBeCloseTo(parentXp / 2, 5); // each gets half
  });

  it("a parent with zero accumulated XP transfers nothing (children start fresh)", () => {
    const a = makeChain(["#skelitonUpper"], 300, 300);
    game.entities = [a];
    kill(a); a.send("update");
    const kid = game.entities.find((e) => e !== a)!;
    expect(kid.get(Experience).xp).toBe(0);     // no spurious XP when the parent never killed anything
  });
});
