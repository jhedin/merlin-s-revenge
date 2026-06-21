import { describe, it, expect, beforeEach } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Experience } from "@/components/experience";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
import { spawnEnemy, spawnPlayer } from "@/entities/archetypes";
import { CollisionGrid } from "@/world/collision";
import { game } from "@/game/context";

// modExperience: cumulative XP, rising absolute threshold (L^3+L^2+prev/(L+1)+5+init), levels at 0.
describe("experience: XP + leveling (faithful curve)", () => {
  const arch = new Archetype("char", [Experience, Energy], { defaults: { isDead: false, getLevel: 0, isInvince: false, gainXp: undefined } });

  it("levels up on the rising cumulative threshold and does not reset XP", () => {
    const e = arch.create(1).build({ energy: 100, energyIncPercentage: 0 }); // init threshold 10
    const xp = e.get(Experience);
    expect(xp.level).toBe(0);
    e.send("gainXp", 10);          // xp 10 >= 10 -> level 1; next threshold = 0+0+10/1 +5+10 = 25
    expect(xp.level).toBe(1);
    expect(xp.xp).toBe(10);        // cumulative (not reset)
    e.send("gainXp", 10);          // xp 20 < 25
    expect(xp.level).toBe(1);
    e.send("gainXp", 6);           // xp 26 >= 25 -> level 2
    expect(xp.level).toBe(2);
  });

  it("a single big gain can grant several levels", () => {
    const e = arch.create(2).build({ energy: 100 });
    e.send("gainXp", 1000);
    expect(e.get(Experience).level).toBeGreaterThan(2);
  });

  it("energy grows by energyIncPercentage of base per level (not a full heal)", () => {
    const e = arch.create(3).build({ energy: 100, energyIncPercentage: 2 });
    const en = e.get(Energy); en.energy = 50;
    e.send("gainXp", 10);          // exactly one level
    expect(en.max).toBe(102);      // +2 (2% of base 100)
    expect(en.energy).toBe(52);    // healed by the increment only
  });

  it("a kill awards imWorth + half the victim's gained XP, and records the attacker", () => {
    game.entities = [];
    const victim = arch.create(4).build({ energy: 10, experienceImWorth: 6 });
    const killer = arch.create(5).build({ energy: 100 });
    game.entities = [victim, killer];
    victim.send("takeHit", 999, 0, killer.id); // collisionVect (vx=999) -> damage 999
    expect(victim.send("isDead")).toBe(true);
    expect(victim.get(Experience).lastAttacker).toBe(killer.id);
    expect(killer.get(Experience).xp).toBe(6); // imWorth 6 + floor(0/2)
  });
});

// modMoveToLoc.incWalkSpeedLevel (internalEvent #levelUp): every character's walk-speed cap grows by
// #walkSpeedIncLevel (engine 0.075) per level. Port: player 1:1 (+0.075), enemy ×0.6 (+0.045).
describe("walk-speed grows with level (modMoveToLoc.incWalkSpeedLevel)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
  });

  it("an enemy's maxSpeed rises 0.045 per level", () => {
    const e = spawnEnemy("swordOrc", 0, 0, { animChar: "swordOrc" });
    const m = e.get(Movement); const base = m.maxSpeed;
    e.send("forceLevelUp");
    expect(m.maxSpeed).toBeCloseTo(base + 0.045, 5);
    e.send("forceLevelUp");
    expect(m.maxSpeed).toBeCloseTo(base + 0.09, 5);
  });

  it("the player's maxSpeed rises 0.075 per level", () => {
    const p = spawnPlayer(100, 100); game.player = p;
    const m = p.get(Movement); const base = m.maxSpeed;
    p.send("forceLevelUp");
    expect(m.maxSpeed).toBeCloseTo(base + 0.075, 5);
  });
});

// modStarReleaser + starMaster.experienceStar: a real XP-driven level-up releases a rising star particle
// (pReleaseStarOnLevel, default true). The re-field path (forceLevelUp) does NOT — stars are toggled off
// while re-fielding a banked unit at its saved level (levelUpToStartingLevel).
describe("level-up star (modStarReleaser)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32);
    game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.effects.clear();
  });

  it("an XP-driven level-up releases at least one rising star at the unit", () => {
    const e = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [e];
    expect(game.effects.count).toBe(0);
    e.send("gainXp", 100000);                 // force several level-ups
    expect(game.effects.count).toBeGreaterThan(0);
  });

  it("re-fielding a banked unit (forceLevelUp) releases NO star", () => {
    const e = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [e];
    e.send("forceLevelUp");
    expect(game.effects.count).toBe(0);       // levelUpToStartingLevel toggles stars off
  });

  it("a star rises and expires after its lifeCount (30 frames)", () => {
    const e = spawnEnemy("swordOrc", 100, 100, { animChar: "swordOrc" });
    game.entities = [e];
    e.send("gainXp", 10);                      // exactly one level -> one star
    const n = game.effects.count;
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) game.effects.update();
    expect(game.effects.count).toBe(0);        // #lifeCount 30 -> vanished
  });
});
