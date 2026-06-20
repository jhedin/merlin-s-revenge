import { describe, it, expect, beforeEach } from "vitest";
import { Counter } from "@/engine/counter";
import { resolveAttack, meleeBasePower, WeaponManager, MELEE_SCALE, type AttackData } from "@/components/weapon";
import { chargeMaxOf, chargeStartOf, chargeSpeedOf } from "@/components/charge";
import { registry } from "@/game/data";
import { spawnPlayer, spawnEnemy } from "@/entities/archetypes";
import { Mana } from "@/components/mana";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

const atkOf = (actor: string): Record<string, any> => (registry.resolveActor(actor) ?? {})["attack"] as any;

describe("Counter (CounterNew/Counter/CounterReset/CounterOnce)", () => {
  it("hi==lo (cooldown going nowhere) latches fin instantly", () => {
    const c = new Counter(1, 1); // tim:[1,1]
    c.fin = false; c.once();
    expect(c.fin).toBe(true);
  });
  it("from reset, ceil((hi-1)/inc) once() calls latch fin (recovery = cooldown/inc)", () => {
    const c = new Counter(20, 1); // cooldown 20, inc 1 (agility) -> recovery 19 frames
    c.reset();
    let frames = 0;
    while (!c.fin && frames < 100) { c.once(); frames++; }
    expect(frames).toBe(19);
  });
  it("inc = the skill stat: cooldown 30 / manaRegeneration 30 -> ~1 frame", () => {
    const c = new Counter(30, 30); c.reset();
    c.once();
    expect(c.fin).toBe(true); // 1 + 30 >= 30 in a single step
  });
  it("once() does not loop after fin (no auto-reset)", () => {
    const c = new Counter(5, 5); c.reset();
    c.once(); expect(c.fin).toBe(true);
    const cnt = c.count;
    c.once(); // already fin -> CounterOnce returns without advancing
    expect(c.count).toBe(cnt); expect(c.fin).toBe(true);
  });
  it("cooldown 0 (merlinSword) -> tim[1]=1>hi=0, fires every step", () => {
    const c = new Counter(0, 1); c.reset();
    c.once();
    expect(c.fin).toBe(true);
  });
  it("save/restore round-trips", () => {
    const c = new Counter(20, 1); c.reset(); c.once(); c.once();
    const c2 = Counter.restore(c.save());
    expect(c2.count).toBe(c.count); expect(c2.fin).toBe(c.fin); expect(c2.hi).toBe(20); expect(c2.inc).toBe(1);
  });
});

describe("resolveAttack (#attack -> AttackData with structAttack defaults)", () => {
  it("#punch -> melee, cooldown 20, power L1 2, mult 1, reach ~hypot(7,10)", () => {
    const a = resolveAttack(atkOf("player"));
    expect(a.name).toBe("#punch");
    expect(a.type).toBe("melee");
    expect(a.cooldown).toBe(20);
    expect(a.powerScalar).toBe(2);              // point(2,0) L1
    expect(a.damageMultiplier).toBe(1);
    expect(a.reach).toBeCloseTo(Math.hypot(7, 10), 3);
  });
  it("merlinSword -> melee, cooldown 0, mult 16, power L1 1", () => {
    const a = resolveAttack(atkOf("merlinSword"));
    expect(a.type).toBe("melee");
    expect(a.cooldown).toBe(0);
    expect(a.damageMultiplier).toBe(16);
    expect(a.powerScalar).toBe(1);              // point(.5,.5) L1
  });
  it("energyBlast -> magic, chargeMax 999/.75/5, cooldown 30, spellSpeed 20, limitMagic", () => {
    const a = resolveAttack(atkOf("energyBlast"));
    expect(a.type).toBe("magic");
    expect(a.chargeMax).toBe(999);
    expect(a.chargeMaxModifier).toBe(0.75);
    expect(a.chargeMaxBasic).toBe(5);
    expect(a.chargeStart).toBe(0);
    expect(a.chargeSpeed).toBe(1);
    expect(a.cooldown).toBe(30);
    expect(a.spellSpeed).toBe(20);
    expect(a.limitMagic).toBe(true);
    expect(a.bullet).toBe("#energyBlastBullet");
  });
  it("defaults fill from structAttack for a bare attack", () => {
    const a = resolveAttack({ name: "#bare" });
    expect(a.damageMultiplier).toBe(1);
    expect(a.cooldown).toBe(0);
    expect(a.chargeMax).toBe(5);
    expect(a.chargeSpeedMax).toBe("#unlimited");
  });
});

describe("charge math reproduces today's energyBlast numbers", () => {
  const eb = () => resolveAttack(atkOf("energyBlast"));
  it("chargeMax = min(999, capacity*0.75 + 5) = 12.5 at base capacity 10", () => {
    expect(chargeMaxOf(eb(), { capacity: 10, flow: 1, burst: 1 })).toBe(12.5);
  });
  it("chargeStart = min(0 + burst, chargeMax) = 1 at base", () => {
    expect(chargeStartOf(eb(), { capacity: 10, flow: 1, burst: 1 })).toBe(1);
  });
  it("chargeSpeed = chargeSpeed * flow = 1 at base; scales with flow", () => {
    expect(chargeSpeedOf(eb(), { capacity: 10, flow: 1, burst: 1 })).toBe(1);
    expect(chargeSpeedOf(eb(), { capacity: 10, flow: 2.5, burst: 1 })).toBe(2.5);
  });
  it("chargeMax grows with capacity (capacity 30 -> 27.5); limitMagic no-op at 100", () => {
    expect(chargeMaxOf(eb(), { capacity: 30, flow: 1, burst: 1 })).toBe(27.5);
  });
  it("chargeSpeedMax clamps a finite cap; chargeStartMax clamps the start", () => {
    const clamped = { ...eb(), chargeSpeedMax: 1.5, chargeStartMax: 0.5 } as AttackData;
    expect(chargeSpeedOf(clamped, { capacity: 10, flow: 5, burst: 1 })).toBe(1.5);
    expect(chargeStartOf(clamped, { capacity: 10, flow: 1, burst: 1 })).toBe(0.5);
  });
});

describe("WeaponManager (add/select/cooldown/save)", () => {
  beforeEach(() => { game.grid = new CollisionGrid(20, 20, 32); game.teamMaster.reset(); });
  const sword = () => resolveAttack(atkOf("merlinSword"));
  const spell = () => resolveAttack(atkOf("energyBlast"));

  it("starts with the natural #punch as the current melee weapon (no spell)", () => {
    const wm = spawnPlayer(100, 100).get(WeaponManager);
    expect(wm.weaponsOfType("nonMagic")).toEqual(["#punch"]);
    expect(wm.getMeleeAttack()!.name).toBe("#punch");
    expect(wm.getHasSpell()).toBe(false);
  });
  it("addWeapon registers + sets current + builds a ready (fin) counter", () => {
    const wm = spawnPlayer(100, 100).get(WeaponManager);
    wm.addWeapon("#merlinSword", sword());
    expect(wm.current).toBe("#merlinSword");
    expect(wm.getMeleeAttack()!.name).toBe("#merlinSword");
    expect(wm.cooldownFinFor("#merlinSword")).toBe(true); // ready to fire on acquire
  });
  it("getWeapons('magic') returns only magic syms; getHasSpell true once magic owned", () => {
    const wm = spawnPlayer(100, 100).get(WeaponManager);
    wm.addWeapon("#merlinSword", sword());
    wm.addWeapon("#energyBlast", spell());
    expect(wm.weaponsOfType("magic")).toEqual(["#energyBlast"]);
    expect(wm.weaponsOfType("nonMagic")).toEqual(["#punch", "#merlinSword"]);
    expect(wm.getHasSpell()).toBe(true);
  });
  it("selectSpell(0) picks the first magic weapon", () => {
    const wm = spawnPlayer(100, 100).get(WeaponManager);
    wm.addWeapon("#energyBlast", spell());
    wm.setCurrentWeapon("#punch");
    wm.selectSpell(0);
    expect(wm.current).toBe("#energyBlast");
  });
  it("getCooldownFin false right after resetCooldown, true after cooldown/inc ticks", () => {
    const wm = spawnPlayer(100, 100).get(WeaponManager);
    // energyBlast cooldown 30, inc = manaRegeneration. Player mana_regeneration = 30 -> recovers in ~1 tick.
    wm.addWeapon("#energyBlast", spell());
    wm.resetCooldownFor("#energyBlast");
    expect(wm.cooldownFinFor("#energyBlast")).toBe(false);
    wm.update(() => {}); // one updateCooldowns tick
    expect(wm.cooldownFinFor("#energyBlast")).toBe(true);
  });
  it("save/restore round-trips weapons + current + counters", () => {
    const wm = spawnPlayer(100, 100).get(WeaponManager);
    wm.addWeapon("#merlinSword", sword());
    wm.addWeapon("#energyBlast", spell());
    wm.resetCooldownFor("#energyBlast");
    const sd: Record<string, any> = {}; wm.addSaveData((x) => x, sd);
    const wm2 = spawnPlayer(0, 0).get(WeaponManager);
    wm2.restoreFromSave((x) => x, sd);
    expect(wm2.weaponsOfType("nonMagic")).toEqual(["#punch", "#merlinSword"]);
    expect(wm2.weaponsOfType("magic")).toEqual(["#energyBlast"]);
    expect(wm2.current).toBe("#energyBlast");
    expect(wm2.cooldownFinFor("#energyBlast")).toBe(false); // counter state preserved
  });
});

describe("melee damage calibration (no regression vs today)", () => {
  // pre-B2: #punch power = round(strength*4)+8 = 40 at strength 8; sword = that + 160 = 200.
  // We pin #punch to that 40 exactly; the sword follows its real damageMultiplier 16.
  it("#punch at strength 8 deals the pre-B2 value (round(8*4)+8 = 40)", () => {
    const punch = resolveAttack(atkOf("player"));
    const dmg = meleeBasePower(punch, 8) * punch.damageMultiplier;
    expect(dmg).toBeCloseTo(40, 5); // 2 * 8 * MELEE_SCALE(2.5) * 1
    expect(MELEE_SCALE).toBe(2.5);
  });
  it("merlinSword at strength 8 stays in the slice's heavy-hit band (one-shots room-1 hostiles)", () => {
    const sword = resolveAttack(atkOf("merlinSword"));
    const dmg = meleeBasePower(sword, 8) * sword.damageMultiplier; // 1 * 8 * 2.5 * 16 = 320
    expect(dmg).toBeCloseTo(320, 5);
    expect(dmg).toBeGreaterThan(300); // one-shots swordOrc (300) and everything lighter
  });
});

describe("attackless enemy keeps a cooldown gate (no every-frame attack)", () => {
  beforeEach(() => { game.grid = new CollisionGrid(20, 20, 32); game.teamMaster.reset(); });
  it("an enemy with no #attack/#weapon (monkGhost) still gets a counter (~18-frame recovery)", () => {
    const wm = spawnEnemy("monkGhost", 0, 0).get(WeaponManager);
    expect(wm.getCurrentAttack()).not.toBeNull();        // synthetic #natural melee
    expect(wm.getCooldownFin()).toBe(true);              // ready on spawn
    wm.resetCooldown();
    expect(wm.getCooldownFin()).toBe(false);             // gated after firing (not always-true)
    let f = 0; while (!wm.getCooldownFin() && f < 200) { wm.update(() => {}); f++; }
    expect(f).toBe(18);                                  // recovers in the old default 18 frames
  });
});

describe("legacy save (pre-B2 {hasSword,hasSpell}) restores acquired weapons", () => {
  beforeEach(() => { game.grid = new CollisionGrid(20, 20, 32); game.teamMaster.reset(); });
  it("a save with hasSword/hasSpell re-adds the sword + spell via addWeapon", () => {
    const wm = spawnPlayer(0, 0).get(WeaponManager);
    wm.restoreFromSave((x) => x, { weapons: { hasSword: true, hasSpell: true } });
    expect(wm.weaponsOfType("nonMagic")).toEqual(["#punch", "#merlinSword"]);
    expect(wm.weaponsOfType("magic")).toEqual(["#energyBlast"]);
    expect(wm.getHasSpell()).toBe(true);
  });
});

describe("spell base-charge fells a 300-energy enemy (SPELL.dmgPerUnit invariant)", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(40, 40, 32); game.entities = [];
    game.assets = { index: { anims: {} }, img: () => null } as any;
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
  });
  it("a full base-charge blast does >= 300 damage", () => {
    const eb = resolveAttack(atkOf("energyBlast"));
    const p = spawnPlayer(100, 100);
    const fullCharge = chargeMaxOf(eb, p.get(Mana)); // 12.5 at base
    const dmg = Math.round(26 * fullCharge);          // SPELL_FX.dmgPerUnit * charge
    expect(dmg).toBeGreaterThanOrEqual(300);          // fells a 300-energy swordOrc
  });
});
