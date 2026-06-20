// WeaponManager (modWeaponManager) — a weapon inventory + per-weapon cooldown counters + the resolved
// #attack data each weapon carries. Every combatant that attacks mixes it in: it owns pWeapons
// (sym -> AttackData), pCurrentWeapon, and pCooldownCounters (sym -> Counter). Pickups call addWeapon
// (= newScrollCollected -> addWeapon), which registers the attack, builds its cooldown counter, and
// auto-selects it (setCurrentWeapon). Cooldown recovery scales by a skill stat per attack #type
// (melee=agility, ranged=dexterity, magic=manaRegeneration), faithful to addCooldownCounter.
//
// PORT ADAPTATION (B2 plan §f.6, a documented divergence from modWeaponManager's single-current-weapon
// model, justified by the no-regression priority): the player AUTO-MELEES with its current MELEE weapon
// AND holds-to-charge magic with an owned magic weapon — both available at once. So WeaponManager is the
// data store (inventory, per-weapon counters, charge params), but PlayerControl drives BOTH modes:
// getMeleeAttack() returns the current/most-recent melee weapon, getMagicAttack() the magic one.
// getHasSpell == owns any magic weapon. CpuAI uses a single current weapon (enemies have one).

import { Component, type NextFn } from "../engine/dispatch";
import { Counter } from "../engine/counter";
import { Mana } from "./mana";
import { STRUCT_ATTACK } from "../data/registry";
import { registry } from "../game/data";

export type AttackType = "melee" | "ranged" | "magic";

// The subset of #attack the drivers need, resolved once at spawn/acquire (structAttack defaults filled).
export interface AttackData {
  name: string;
  animType: string;
  type: AttackType;
  cooldown: number;
  powerX: number; powerY: number;     // #power point (melee/spell magnitude); bullet/spell read scalar too
  powerScalar: number;                // #power as a number (bullet/spell), else L1 of the point
  damageMultiplier: number;
  reach: number;                      // point reach collapsed to a radius (px)
  hits: string[];
  sound: string;
  bullet: string;
  spellSpeed: number;
  releaseSound: string;
  // charge (modAttack) — read by charge.ts
  chargeMax: number; chargeMaxModifier: number; chargeMaxBasic: number;
  chargeStart: number; chargeSpeed: number;
  chargeSpeedMax: number | string; chargeStartMax: number | string;
  limitMagic: boolean;
}

// AttackSetTypeFromAnimType: naturalMelee/weaponMelee/magicMelee -> melee; weaponRanged -> ranged;
// magic -> magic. (Unknown -> melee, the safe default for a contact attack.)
export function typeFromAnimType(animType: string): AttackType {
  switch (animType) {
    case "#weaponRanged": return "ranged";
    case "#magic": return "magic";
    case "#naturalMelee": case "#weaponMelee": case "#magicMelee": default: return "melee";
  }
}

const numOr = (v: any, d: number): number => (typeof v === "number" ? v : d);
const strOr = (v: any, d: string): string => (typeof v === "string" ? v : d);

// MELEE_SCALE — the calibration factor on melee `power·strength` so per-swing damage stays at the
// slice's tuned numbers (the powers are calibrated for the engine's native units, not the port's px
// energies; see B2 plan §f.2). Faithful melee damage = (power_L1 · strength · MELEE_SCALE) carried as
// the collision-vector L1, times damageMultiplier as `mult`. The faithful multiplicative model fixes
// the sword/punch ratio at 8 (power 1·mult 16 vs power 2·mult 1), whereas today's flat-+160 sword has
// ratio 4.33 — the two cannot both match exactly under one scale. We pin #punch to today's value (the
// natural attack, asserted by the calibration unit test):
//   #punch       (power_L1 2, mult 1,  strength 8): 2·8·SCALE·1   = 16·SCALE  == round(8*4)+8 = 48 -> SCALE 3
//   merlinSword  (power_L1 1, mult 16, strength 8): 1·8·SCALE·16  = 128·SCALE = 384
// At SCALE 3 the sword is 384 (vs today's 208), but room-1 hostiles are 15–300 energy and one-/two-shot
// by BOTH, so the room-1 clear speed is unchanged (gate verified by the smoke). The headroom only shows
// against high-energy actors (blackOrc 1200: 4 swings vs 6) which don't gate the slice.
export const MELEE_SCALE = 3;

// The base collision-vector L1 magnitude for a melee swing (before damageMultiplier is applied as mult).
export function meleeBasePower(attack: AttackData, strength: number): number {
  return attack.powerScalar * strength * MELEE_SCALE;
}

// resolveAttack(raw): build an AttackData from a (possibly partial) #attack proplist, filling from
// structAttack defaults. `raw` is normally already structAttack-merged by registry.resolveActor, but we
// re-default defensively so a bare {name,power} also resolves.
export function resolveAttack(raw: Record<string, any> | undefined): AttackData {
  const r = raw ?? {};
  const d = STRUCT_ATTACK;
  const animType = strOr(r["animType"], d["animType"] as string);
  // #power may be a point(x,y) (melee) or a scalar (bullet/spell). Keep both views.
  const pw = r["power"];
  let powerX = numOr((d["power"] as any).x, 5), powerY = numOr((d["power"] as any).y, -1), powerScalar: number;
  if (pw && typeof pw === "object" && "x" in pw) { powerX = pw.x; powerY = pw.y; powerScalar = Math.abs(pw.x) + Math.abs(pw.y); }
  else if (typeof pw === "number") { powerScalar = pw; powerX = pw; powerY = 0; }
  else { powerScalar = Math.abs(powerX) + Math.abs(powerY); }
  // #reach may be a point (inflate-rect radius) or a scalar (GeomDist threshold).
  const rch = r["reach"];
  let reach: number;
  if (rch && typeof rch === "object" && "x" in rch) reach = Math.hypot(rch.x, rch.y);
  else reach = numOr(rch, numOr(d["reach"], 25));
  return {
    name: strOr(r["name"], d["name"] as string),
    animType, type: typeFromAnimType(animType),
    cooldown: numOr(r["cooldown"], d["cooldown"] as number),
    powerX, powerY, powerScalar,
    damageMultiplier: numOr(r["damageMultiplier"], d["damageMultiplier"] as number),
    reach,
    hits: Array.isArray(r["hits"]) ? r["hits"] : (d["hits"] as string[]),
    sound: strOr(r["sound"], d["sound"] as string),
    bullet: strOr(r["bullet"], d["bullet"] as string),
    spellSpeed: numOr(r["spellSpeed"], d["spellSpeed"] as number),
    releaseSound: strOr(r["releaseSound"], d["releaseSound"] as string),
    chargeMax: numOr(r["chargeMax"], d["chargeMax"] as number),
    chargeMaxModifier: numOr(r["chargeMaxModifier"], d["chargeMaxModifier"] as number),
    chargeMaxBasic: numOr(r["chargeMaxBasic"], d["chargeMaxBasic"] as number),
    chargeStart: numOr(r["chargeStart"], d["chargeStart"] as number),
    chargeSpeed: numOr(r["chargeSpeed"], d["chargeSpeed"] as number),
    chargeSpeedMax: (r["chargeSpeedMax"] ?? d["chargeSpeedMax"]) as number | string,
    chargeStartMax: (r["chargeStartMax"] ?? d["chargeStartMax"]) as number | string,
    limitMagic: r["limitMagic"] === true,
  };
}

export class WeaponManager extends Component {
  static handles = ["getCurrentAttack", "getMeleeAttack", "getMagicAttack", "getHasSpell",
    "getCooldownFin", "getWeapons", "update", "getAgility", "getDexterity", "getManaRegeneration",
    "addSaveData", "restoreFromSave"];

  private weapons = new Map<string, AttackData>();   // pWeapons
  private order: string[] = [];                      // insertion order (getWeapons preserves it)
  private counters = new Map<string, Counter>();     // pCooldownCounters
  current: string | null = null;                     // pCurrentWeapon
  private lastMelee: string | null = null;           // most-recent melee weapon (port: auto-melee source)
  private lastMagic: string | null = null;           // most-recent magic weapon (port: charge source)
  agility = 1;        // melee cooldown inc
  dexterity = 0.2;    // ranged cooldown inc

  override init(cfg: Record<string, any>): void {
    this.weapons.clear(); this.counters.clear(); this.order = [];
    this.current = this.lastMelee = this.lastMagic = null;
    this.agility = numOr(cfg["agility"], 1);
    this.dexterity = numOr(cfg["dexterity"], 0.2);
    // initNaturalAttack: the character's own #attack becomes its first weapon (#punch for the player,
    // the resolved weapon #attack for an enemy). cfg.attack is the resolved AttackData passed by spawn*.
    const natural = cfg["attack"] as AttackData | undefined;
    if (natural && natural.name && natural.name !== "#none") this.addWeapon(natural.name, natural);
  }
  override reset(): void { this.init({}); }

  // getAgility/getDexterity/getManaRegeneration: the skill stats addCooldownCounter reads (me.big.*).
  getAgility(): number { return this.agility; }
  getDexterity(): number { return this.dexterity; }
  getManaRegeneration(): number { const mana = this.entity.tryGet(Mana); return mana ? mana.regeneration : 1; }

  // addWeapon(theWeapon, theAttack): register + build cooldown counter + auto-select (setCurrentWeapon).
  addWeapon(sym: string, attack: AttackData): void {
    if (!this.weapons.has(sym)) this.order.push(sym);
    this.weapons.set(sym, attack);
    this.addCooldownCounter(sym, attack);
    this.setCurrentWeapon(sym);
  }

  // addCooldownCounter: counter with tim[2]=cooldown, fin=true (ready), inc = the per-type skill stat.
  private addCooldownCounter(sym: string, attack: AttackData): void {
    const inc = attack.type === "melee" ? this.getAgility()
      : attack.type === "ranged" ? this.getDexterity() : this.getManaRegeneration();
    const c = new Counter(attack.cooldown, inc);
    c.fin = true; // start ready to fire
    this.counters.set(sym, c);
  }

  // setCurrentWeapon: select; also remember it as the current melee/magic weapon for the dual-mode driver.
  setCurrentWeapon(sym: string): void {
    if (!this.weapons.has(sym)) return;
    this.current = sym;
    const a = this.weapons.get(sym)!;
    if (a.type === "magic") this.lastMagic = sym; else this.lastMelee = sym;
  }

  // selectSpell(n): getWeapons("magic")[n] -> setCurrentWeapon (the 1-9 spell hotkeys).
  selectSpell(n: number): void {
    const magic = this.weaponsOfType("magic");
    if (n >= 0 && n < magic.length) this.setCurrentWeapon(magic[n]!);
  }

  getCurrentAttack(): AttackData | null { return this.current ? this.weapons.get(this.current) ?? null : null; }
  // Port dual-mode accessors: the melee weapon the player auto-swings, and the magic weapon it charges.
  getMeleeAttack(): AttackData | null { return this.lastMelee ? this.weapons.get(this.lastMelee) ?? null : null; }
  getMagicAttack(): AttackData | null { return this.lastMagic ? this.weapons.get(this.lastMagic) ?? null : null; }
  getHasSpell(): boolean { return this.weaponsOfType("magic").length > 0; } // owns a magic weapon

  // getWeapons(theType): "magic" -> animType==#magic; "nonMagic" -> animType<>#magic; or an AttackType.
  // Chain handler (receives `next` first); internal callers use weaponsOfType directly.
  getWeapons(_next: NextFn, type: "magic" | "nonMagic" | AttackType): string[] { return this.weaponsOfType(type); }
  weaponsOfType(type: "magic" | "nonMagic" | AttackType): string[] {
    return this.order.filter((sym) => {
      const a = this.weapons.get(sym)!;
      if (type === "magic") return a.type === "magic";
      if (type === "nonMagic") return a.type !== "magic";
      return a.type === type;
    });
  }

  // getCooldownFin: is the current weapon ready to fire?
  getCooldownFin(): boolean { const c = this.current ? this.counters.get(this.current) : null; return c ? c.fin : true; }
  // Cooldown gate for a SPECIFIC owned weapon (the dual-mode driver fires melee/magic independently).
  cooldownFinFor(sym: string | null): boolean { const c = sym ? this.counters.get(sym) : null; return c ? c.fin : true; }
  // resetCooldown: CounterReset on the given weapon's counter — called when that weapon FIRES (not select).
  resetCooldownFor(sym: string | null): void { const c = sym ? this.counters.get(sym) : null; if (c) c.reset(); }
  resetCooldown(): void { this.resetCooldownFor(this.current); }

  // updateCooldowns: CounterOnce on every weapon's counter each tick (recovery ≈ ceil((cd-1)/inc)).
  update(next: NextFn): void {
    for (const c of this.counters.values()) c.once();
    next();
  }

  // persist the inventory (replaces the old hasSword/hasSpell save blob).
  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["weaponMgr"] = {
      order: this.order.slice(),
      weapons: this.order.map((s) => this.weapons.get(s)),
      counters: this.order.map((s) => this.counters.get(s)!.save()),
      current: this.current, lastMelee: this.lastMelee, lastMagic: this.lastMagic,
    };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const w = sd["weaponMgr"];
    if (w && Array.isArray(w.order)) {
      this.weapons.clear(); this.counters.clear(); this.order = w.order.slice();
      w.order.forEach((sym: string, i: number) => {
        this.weapons.set(sym, w.weapons[i] as AttackData);
        this.counters.set(sym, Counter.restore(w.counters[i]));
      });
      this.current = w.current ?? null; this.lastMelee = w.lastMelee ?? null; this.lastMagic = w.lastMagic ?? null;
    } else if (sd["weapons"]) {
      // back-compat: pre-B2 saves stored {hasSword,hasSpell} booleans (no version bump). Re-add the
      // owned weapons via addWeapon so an old save keeps the sword/spell instead of reverting to punch.
      const legacy = sd["weapons"];
      if (legacy.hasSword) this.addWeaponFromActor("merlinSword");
      if (legacy.hasSpell) this.addWeaponFromActor("energyBlast");
    }
    return next(sd);
  }

  private addWeaponFromActor(actor: string): void {
    const a = resolveAttack((registry.resolveActor(actor) ?? {})["attack"] as Record<string, any>);
    if (a.name && a.name !== "#none") this.addWeapon(a.name, a);
  }
}
