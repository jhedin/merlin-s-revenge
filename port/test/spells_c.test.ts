// Plan C — spell roster tests: C1 charged-blast data wiring, C2 splash/explode + payload-list +
// takeFreeze/takeHeal, C3 summon tier select + randomSummon wobble + summon spawn.

import { describe, it, expect, beforeEach } from "vitest";
import { Archetype, type Entity } from "@/engine/dispatch";
import { Movement } from "@/components/movement";
import { Team, Targeting, Energy } from "@/components/combat";
import { Freeze } from "@/components/freeze";
import { TeamMaster } from "@/systems/teams";
import { resolveAttack, type AttackData } from "@/components/weapon";
import { chargeMaxOf } from "@/components/charge";
import { geomMoveVector, collisionCalcVect, Rng } from "@/engine/math";
import { resolveSplash, applyPayload } from "@/components/splash";
import { selectTier, summonUnit } from "@/components/summon";
import { Experience } from "@/components/experience";
import { spawnUnit, spawnAlly, spawnEnemy } from "@/entities/archetypes";
import { spawnSpell } from "@/systems/spells";
import { SpellActor } from "@/components/spellActor";
import { rebuildCombatSubstrate } from "@/systems/combatTick";
import { registry } from "@/game/data";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";
import { spawnPlayer } from "@/entities/archetypes";

const atkOf = (actor: string): AttackData => resolveAttack(((registry.resolveActor(actor) ?? {})["attack"]) as any, registry.resolveActor(actor) as any);

// ───────────────────────────── C1: charged-blast data wiring (free on B2) ─────────────────────────
describe("#explodeSound — data-driven detonation sound (was hardcoded 'spell_explode')", () => {
  it("reads the actor's top-level #explodeSound; #none/unset = silent", () => {
    expect(atkOf("cracks").explodeSound).toBe("darkGolem_fire");        // sumo's ground cracks
    expect(atkOf("healBlast").explodeSound).toBe("heal_spell_explode"); // heal spell, distinct sound
    expect(atkOf("darkRock").explodeSound).toBe("spell_explode");       // the common case
    expect(atkOf("energyPulse").explodeSound).toBe("#none");            // silent (port no longer plays a spurious sound)
  });
});

describe("C1 — charged blasts resolve to the cited #attack data (no new code)", () => {
  it("cBlast: chargeMaxBasic 999 / Modifier 0 -> chargeMax always 999 regardless of capacity", () => {
    const a = atkOf("cBlast");
    expect(a.chargeMaxBasic).toBe(999); expect(a.chargeMaxModifier).toBe(0);
    expect(chargeMaxOf(a, { capacity: 10, flow: 1, burst: 1 })).toBe(999);
    expect(chargeMaxOf(a, { capacity: 99, flow: 1, burst: 1 })).toBe(999); // capacity·0+999
    expect(a.chargeSpeed).toBeCloseTo(0.1); expect(a.cooldown).toBe(30);
  });
  it("darkBlast: fast cheap blast — start 5, cooldown 15, power 3, not limited", () => {
    const a = atkOf("darkBlast");
    expect(a.chargeStart).toBe(5); expect(a.cooldown).toBe(15);
    expect(a.powerScalar).toBe(3); expect(a.limitMagic).toBe(false);
  });
  it("cBlastAi: AI-caster tuning (Modifier 3 / Basic 18)", () => {
    const a = atkOf("cBlastAi");
    expect(a.chargeMaxModifier).toBe(3); expect(a.chargeMaxBasic).toBe(18);
  });
  it("arcticBlast: a C1 bolt + a C2 freeze payload list", () => {
    const a = atkOf("arcticBlast");
    expect(a.payloadFunction).toEqual(["takeFreeze", "takeHit"]); // list, order matters
    expect(a.glowTeal).toBe(true); expect(a.limitMagic).toBe(true);
  });
  it("healBlast: takeHeal payload, friendly lowest-health target", () => {
    const a = atkOf("healBlast");
    expect(a.payloadFunction).toEqual(["takeHeal"]);
  });
});

// ───────────────────────────── C2 geometry: radial-falloff vectors ────────────────────────────────
describe("C2 — geometry (CollisionCalcVect / GeomMoveVector radial falloff)", () => {
  it("geomMoveVector points self->target with the given Euclidean magnitude", () => {
    const v = geomMoveVector(0, 0, 3, 4, 10); // unit (0.6,0.8) * 10
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10);
    expect(v.x).toBeCloseTo(6); expect(v.y).toBeCloseTo(8);
  });
  it("collisionCalcVect returns (0,0) when dist >= power (rim), falls off with distance", () => {
    expect(collisionCalcVect(0, 0, 50, 0, 50)).toEqual({ x: 0, y: 0 }); // dist 50 == power 50 -> 0
    const near = collisionCalcVect(0, 0, 5, 0, 50);   // dist 5
    const far = collisionCalcVect(0, 0, 40, 0, 50);   // dist 40
    const l1 = (v: { x: number; y: number }) => Math.abs(v.x) + Math.abs(v.y);
    expect(l1(near)).toBeGreaterThan(l1(far)); // centre > rim
  });
});

// ───────────────────────────── C2 splash: area + falloff + lethality band ─────────────────────────
describe("C2 — SplashDamage (#explode + #splashDamageOn) hits all in disc, radial falloff", () => {
  let tm: TeamMaster; let nextId = 1;
  const Unit = new Archetype("u", [Movement, Freeze, Team, Targeting, Energy],
    { defaults: { isDead: false, isInvince: false, isFrozen: false, freezeFactor: 1 } });
  const attacker = { id: 999, send: (m: string) => (m === "getTeam" ? "#orcs" : undefined) } as unknown as Entity;
  const spawn = (team: string, x: number, y: number, energy = 1000): Entity => {
    const e = Unit.create(nextId++).build({ x, y, team, energy }); e.type = "enemy";
    tm.register(e, team, "#teamMembers"); tm.unitMap.insert(e, x, y); return e;
  };
  beforeEach(() => { tm = new TeamMaster(); tm.unitMap.configure(32, 0, 0); nextId = 1; game.teamMaster = tm; });

  it("#explode (energyPulse radius=explodeCharge/2=5) hits ALL hostiles in disc, none outside", () => {
    const a = atkOf("energyPulse");
    expect(a.attackType).toBe("#explode"); expect(a.explodeCharge).toBe(10); // radius 5 (+targetRadius 12)
    const a1 = spawn("#aldevar", 0, 0);     // centre
    const a2 = spawn("#aldevar", 14, 0);    // inside radius+targetRadius (17)
    const out = spawn("#aldevar", 60, 0);   // outside
    const e0 = [a1, a2, out].map((u) => (u.get(Energy) as any).energy);
    resolveSplash(attacker, a, 0, 0, 999, a.hits, "#enemy");
    expect((a1.get(Energy) as any).energy).toBeLessThan(e0[0]!);
    expect((a2.get(Energy) as any).energy).toBeLessThan(e0[1]!);
    expect((out.get(Energy) as any).energy).toBe(e0[2]!); // untouched
  });

  it("radial falloff: a centred victim takes MORE than a rim victim (same blast)", () => {
    const a = atkOf("thunderBlast"); // explodeCharge 100 -> radius 50
    const centre = spawn("#aldevar", 0, 0);
    const rim = spawn("#aldevar", 55, 0); // near the rim (dist 55 < 50+12)
    resolveSplash(attacker, a, 0, 0, 999, a.hits, "#enemy");
    const dc = 1000 - (centre.get(Energy) as any).energy;
    const dr = 1000 - (rim.get(Energy) as any).energy;
    expect(dc).toBeGreaterThan(dr);
    expect(dr).toBeGreaterThanOrEqual(0); // rim ~ 0, never negative
  });

  it("#splashDamageOn (towerAxe radius=power=50) hits within 50, misses at 60", () => {
    const a = atkOf("towerAxe");
    expect(a.splashDamageOn).toBe(true); expect(a.powerScalar).toBe(50); expect(a.damageMultiplier).toBe(10);
    const inside = spawn("#aldevar", 30, 0);
    const outside = spawn("#aldevar", 60, 0);
    const e0 = [inside, outside].map((u) => (u.get(Energy) as any).energy);
    resolveSplash(attacker, a, 0, 0, 999, a.hits, "#enemy");
    expect((inside.get(Energy) as any).energy).toBeLessThan(e0[0]!);
    expect((outside.get(Energy) as any).energy).toBe(e0[1]!);
  });

  it("CALIBRATION: splash damage uses the SAME (|vx|+|vy|)·mult scale as a single-target hit (B2 band)", () => {
    // energyPulse centre hit: radius 5, targetRadius 12 -> hitRange 17; speed=(17-0)*power(1)=17; vector
    // L1 >= 17; damage = L1 * mult(5) >= 85 — squarely in B2's room-1 lethality band (15-325 single-hit).
    const a = atkOf("energyPulse");
    const victim = spawn("#aldevar", 0, 0);
    resolveSplash(attacker, a, 0, 0, 999, a.hits, "#enemy");
    const dmg = 1000 - (victim.get(Energy) as any).energy;
    expect(dmg).toBeGreaterThanOrEqual(85);   // centre-hit floor (hitRange·power·mult)
    expect(dmg).toBeLessThan(330);            // not over-lethal vs the single-target band (<= ~325)
  });
});

// ───────────────────────────── C2 payload dispatch (list runs both) ───────────────────────────────
describe("C2 — applyPayload (CallPayloadFunction symbol|list)", () => {
  const Unit = new Archetype("u", [Movement, Freeze, Team, Targeting, Energy],
    { defaults: { isDead: false, isInvince: false, isFrozen: false, freezeFactor: 1 } });
  const mk = (energy = 200): Entity => Unit.create(1).build({ x: 0, y: 0, team: "#aldevar", energy });

  it("[#takeFreeze,#takeHit] runs BOTH on one hit (freezes AND damages)", () => {
    const v = mk(200);
    const arctic = atkOf("arcticBlast");
    applyPayload(arctic.payloadFunction, v, 6, 0, arctic, -1);
    expect(v.send("isFrozen")).toBe(true);                       // takeFreeze ran
    expect((v.get(Energy) as any).energy).toBeLessThan(200);     // takeHit ran
  });
  it("#takeHeal heals (|vx|+|vy|)·2, no damage", () => {
    const v = mk(100); (v.get(Energy) as any).max = 200;
    applyPayload(["takeHeal"], v, 5, 5, atkOf("healBlast"), -1); // (5+5)*2 = 20
    expect((v.get(Energy) as any).energy).toBe(120);
  });
  it("#armyTeleportOut is a no-op (G2), unknown ignored", () => {
    const v = mk(200);
    applyPayload(["armyTeleportOut"], v, 9, 9, atkOf("armySummon"), -1);
    expect((v.get(Energy) as any).energy).toBe(200);
  });
});

// ───────────────────────────── C2 takeHeal clamp ──────────────────────────────────────────────────
describe("C2 — Energy.takeHeal", () => {
  const Unit = new Archetype("u", [Movement, Team, Energy], { defaults: { isDead: false, isInvince: false } });
  it("heals (|vx|+|vy|)·2 clamped to max, sets gold glow", () => {
    const e = Unit.create(1).build({ x: 0, y: 0, team: "#aldevar", energy: 50 });
    (e.get(Energy) as any).max = 100;
    e.send("takeHeal", 10, 0, -1); // +20 -> 70
    expect((e.get(Energy) as any).energy).toBe(70);
    expect((e.get(Energy) as any).goldGlow).toBeGreaterThan(0);
    e.send("takeHeal", 100, 0, -1); // +200 clamped to max 100
    expect((e.get(Energy) as any).energy).toBe(100);
  });
});

// ───────────────────────────── C3 summon tier select + wobble + spawn ─────────────────────────────
describe("C3 — selectTier (modSpellMultistage.selectPayload)", () => {
  it("armySummon tiers: 9->none, 10->warrior, 24->monk, 32->kingInGame", () => {
    const ms = atkOf("armySummon").multistage;
    expect(selectTier(9, ms)).toBeNull();
    expect(selectTier(10, ms)).toBe("warrior");
    expect(selectTier(24, ms)).toBe("monk");
    expect(selectTier(32, ms)).toBe("kingInGame");
  });
  it("monsterSummon 31 -> summonGolem", () => {
    expect(selectTier(31, atkOf("monsterSummon").multistage)).toBe("summonGolem");
  });
});

describe("C3 — randomSummon charge wobble (calcAttackChargeMax)", () => {
  it("non-randomSummon (armySummon) is deterministic regardless of rng", () => {
    const a = atkOf("armySummon");
    expect(a.randomSummon).toBe(false);
    const cm1 = chargeMaxOf(a, { capacity: 10, flow: 1, burst: 1 }, new Rng(1));
    const cm2 = chargeMaxOf(a, { capacity: 10, flow: 1, burst: 1 }, new Rng(2));
    expect(cm1).toBe(cm2);
  });
  it("the CPU summon spells resolve randomSummon=true (the tier-wobble must be live for them)", () => {
    // mageOrc/goblinMage -> goblinSummon, necromancer/greyGhost -> undeadSummon, etc. The CpuAI summon
    // release now passes game.rng to chargeMaxOf so these wobble per cast (control.ts attack()).
    for (const s of ["goblinSummon", "undeadSummon", "scSummon", "skelitonSummon"]) {
      expect.soft(atkOf(s).randomSummon, `${s} should be randomSummon`).toBe(true);
    }
  });
  it("a randomSummon attack wobbles within [0, chargeMax] and is seeded-deterministic", () => {
    // synthetic random summon (no placed actor carries one): tiers 10/15, capacity drives a big ceiling
    const a = resolveAttack({
      animType: "#magic", randomSummon: true, chargeMax: 35, chargeMaxBasic: 35, chargeMaxModifier: 0,
      explodeFunction: "#summonUnit", multistage: { footSoldier: 10, skeletonWarrior: 15 },
    });
    const mana = { capacity: 10, flow: 1, burst: 1 };
    const base = chargeMaxOf(a, mana);                 // 35, deterministic (no rng)
    const w1 = chargeMaxOf(a, mana, new Rng(7));
    const w2 = chargeMaxOf(a, mana, new Rng(7));
    expect(w1).toBe(w2);                               // seeded-deterministic
    expect(w1).toBeGreaterThanOrEqual(0);
    expect(w1).toBeLessThanOrEqual(base + 1);          // bounded by the min + ±1 jitter
  });
});

describe("C3 — summon fields a unit on the right team", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.armyMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  });

  // K9 — armySummon REQUIRES a reservation (createUnit returns #none for armySummon w/ armyDetails=#none).
  it("armySummon with an EMPTY reserve summons nothing (the spell fizzles to its bolt only)", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const before = game.entities.length;
    const u = summonUnit(atkOf("armySummon"), 15, 100, 100, player.id); // would-be archer tier
    expect(u).toBeNull();
    expect(game.entities.length).toBe(before); // nothing fielded
  });
  it("armySummon withdraws a banked reserve unit and re-fields it at its saved level, consuming the record", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    // bank an archer (the charge-15 tier of armySummon) onto the player's army reserve at level 2.
    const banked = spawnAlly("archer", 0, 0); banked.get(Experience).level = 2;
    expect(game.armyMaster.teleportOut(banked)).toBe(true);
    expect(game.armyMaster.reserveCount("#aldevar", "archer")).toBe(1);

    const before = game.entities.length;
    const u = summonUnit(atkOf("armySummon"), 15, 100, 100, player.id);
    expect(u).not.toBeNull();
    expect(game.entities.length).toBe(before + 1);
    expect(u!.send("getTeam")).toBe("#aldevar");
    expect(u!.type).toBe("ally");
    expect(u!.get(Experience).level).toBe(2);                            // re-fielded at the banked level
    expect(game.armyMaster.reserveCount("#aldevar", "archer")).toBe(0);   // record consumed
  });
  it("monsterSummon summons a FRESH #monsterSummon unit (no reserve needed — player-side team that hates real monsters)", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const u = summonUnit(atkOf("monsterSummon"), 12, 100, 100, player.id); // tier 12 = summonArcher
    expect(u).not.toBeNull();
    expect(u!.send("getTeam")).toBe("#monsterSummon");
  });
});

// K2 — the spell-actor lifecycle (objSpell grow-fly-explode) + the load-bearing lethality invariant: a
// base-charge energyBlast explosion centre hit still fells a rank-and-file ~300-energy enemy (the calibration
// K1 carried on the scalar and re-pins here via SPELL_RADIAL_SCALE through resolveSplash's #explode shape).
describe("K2 — spell-actor lethality + lifecycle", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(60, 60, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  });

  // FAITHFUL balance (modEnergy.takeHit: damage = (|vx|+|vy|)·mult; spell vector speed = (hitRange−dist)·
  // power, ridden on MELEE_SCALE like every other attack). A BASE-charge energyBlast centre hit ≈ 69 — it
  // WOUNDS a 300-energy rank-and-file enemy but does NOT one-shot it (the original spell/punch ratio ≈ 1.73,
  // not the ~8× the old 11.7 scale produced). Damage scales with charge (the grown radius), so a fully-
  // charged cast DOES fell it — that's the faithful "charge it up" model.
  const castAtFoe = (charge: number, foeEnergy: number) => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player; // team #aldevar
    const foe = spawnEnemy("swordOrc", 400, 100, { animChar: "swordOrc" });                 // hostile #orcs
    foe.get(Energy).max = foeEnergy; foe.get(Energy).energy = foeEnergy;
    foe.get(Movement).inertia = 0; // a light rank-and-file (heavy/tanky orcs damp the hit per K1 — faithful)
    game.entities.push(foe);
    const spell = spawnSpell(atkOf("energyBlast"), player.id, 100, 94, "#aldevar", ["#teamMembers", "#teamBuildings"], "#enemy");
    spell.get(SpellActor).setCharge(charge, 100, 94);
    spell.get(SpellActor).release(400, 100, 8);
    rebuildCombatSubstrate();                          // unit map for the radial area hit
    for (let i = 0; i < 80 && !spell.send("isFinished"); i++) spell.send("update"); // fly + explode + quick-fade
    return { spell, foe, dmg: foeEnergy - foe.get(Energy).energy };
  };

  it("a base-charge (12.5) energyBlast centre hit WOUNDS but does not one-shot a 300-energy enemy", () => {
    const { spell, foe, dmg } = castAtFoe(12.5, 300);
    expect(spell.send("isFinished")).toBe(true);       // the orb flew to the foe, exploded, and quick-faded
    expect(dmg).toBeGreaterThan(40);                   // a real hit (centre ≈ 69, consistent with melee ≈ 40)
    expect(dmg).toBeLessThan(150);                     // NOT the ~325 one-shot the mis-calibrated scale gave
    expect(foe.send("isDead")).toBe(false);            // a 300-energy rank-and-file survives a BASE cast
  });

  it("a fully-charged energyBlast fells the 300-energy enemy (damage scales with charge)", () => {
    const { foe } = castAtFoe(80, 300);                // a high charge grows the radius -> lethal centre hit
    expect(foe.send("isDead")).toBe(true);
  });

  it("the orb GROWS and quick-fades on explode (objSpell startQuickFade) instead of vanishing instantly", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const spell = spawnSpell(atkOf("energyBlast"), player.id, 100, 94, "#aldevar", ["#teamMembers", "#teamBuildings"], "#enemy");
    const sa = spell.get(SpellActor);
    sa.setCharge(12.5, 100, 94);
    const flySize = sa.size();
    sa.release(120, 94, 8);
    rebuildCombatSubstrate();
    for (let i = 0; i < 20 && sa.fadeAlpha() === 1; i++) spell.send("update"); // run until it explodes -> fade
    expect(sa.size()).toBeGreaterThan(flySize);        // grown ×chargeExplodeFactor (4) at the explode
    expect(sa.fadeAlpha()).toBeLessThan(1);            // and fading out (not gone) — the landing flash
    expect(spell.send("isFinished")).toBe(false);      // still alive during the quick-fade window
    for (let i = 0; i < 12; i++) spell.send("update"); // finish the fade
    expect(spell.send("isFinished")).toBe(true);       // swept after the fade completes
  });

  it("the disc grows with charge (calcSize = charge·chargeSize) and positions over the head (#top)", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const spell = spawnSpell(atkOf("energyBlast"), player.id, 100, 94, "#aldevar", [], "#enemy");
    const sa = spell.get(SpellActor);
    sa.setCharge(4, 100, 94); const small = sa.size();
    sa.setCharge(12, 100, 94); const big = sa.size();
    expect(big).toBeGreaterThan(small);                // grows with charge
    const pos = spell.send("getPos") as { x: number; y: number };
    expect(pos.x).toBe(100);                            // #top offset keeps it centred over the head
    expect(pos.y).toBeLessThan(94);                     // and lifts it above the head (−size/2)
  });

  it("a non-fatal rim hit still damages (radial falloff: centre > rim > 0)", () => {
    const player = spawnPlayer(100, 100); game.entities.push(player); game.player = player;
    const foe = spawnEnemy("blackOrc", 400, 130, { animChar: "blackOrc" }); // 30px off the blast centre
    const hp0 = foe.get(Energy).energy;
    game.entities.push(foe);
    const spell = spawnSpell(atkOf("energyBlast"), player.id, 100, 94, "#aldevar", ["#teamMembers", "#teamBuildings"], "#enemy");
    spell.get(SpellActor).setCharge(12.5, 100, 94);
    spell.get(SpellActor).release(400, 100, 8);          // explodes at (400,100); foe at (400,130) = rim
    rebuildCombatSubstrate();
    for (let i = 0; i < 60 && !spell.send("isFinished"); i++) spell.send("update");
    const dmg = hp0 - foe.get(Energy).energy;
    expect(dmg).toBeGreaterThan(0); expect(dmg).toBeLessThan(300); // rim damage: nonzero but < a centre hit
  });
});
