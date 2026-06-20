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
  // I7 GMG (modGoldenMachineGun / modAttack.gmgOn): when the GMG is on, the live charge params swap to
  // these and gmgAutoFire drives the continuous auto-fire loop (spellCharged -> release+recharge).
  gmgChargeMax: number; gmgChargeSpeed: number; gmgChargeStart: number; gmgAutoFire: boolean;
  // I8 beams (modFireBullets / performBeamAttack): a #releaseFunction:#fireBullets spell streams a
  // bullet every fireDelay frames, draining chargePerUnit per shot. beam -> the energyBeam render path
  // (spawn at the target loc, sprite stretched to the caster->target distance + rotated).
  beam: boolean; fireDelay: number; releaseFunction: string;
  // C2 splash / explode / status payload (modSplashDamage / modExploder / CallPayloadFunction)
  attackType: string;                 // raw #attack.type (#explode / #bullet / #melee / #magic / #auto)
  explodeCharge: number;              // #explode radius source (radius = explodeCharge/2)
  splashDamageOn: boolean;            // #splashDamageOn bullet (radius = power)
  payloadFunction: string[];          // CallPayloadFunction list (#takeHit/#takeFreeze/#takeHeal/...)
  freezeMultiplier: number;           // #takeFreeze magnitude scale
  glowTeal: boolean;                  // teal status overlay on first freeze
  // C3 summon (modSpellMultistage)
  explodeFunction: string;            // #summonUnit / #depositMines / #none
  multistage: Array<{ type: string; chargeRequired: number }>; // charge tier -> unit type
  randomSummon: boolean;              // charge-wobble flavour (skeleton/goblin/sc/undead)
  residentTeamCategory: string;       // the team a summoned unit joins (#aldevar / #monsterSummon)
  chargePerUnit: number;              // #depositMines: numMines = charge/chargePerUnit
}

// normalize a #payloadFunction (symbol | list | #none) into a clean string[] of function names.
function normPayload(v: any): string[] {
  const one = (s: any): string => (typeof s === "string" ? s.replace(/^#/, "") : "");
  const arr = Array.isArray(v) ? v.map(one) : [one(v)];
  return arr.filter((s) => s && s !== "none" && s !== "void");
}
// normalize #multistage (a proplist {type:chargeRequired}) into ordered ascending tiers.
function normMultistage(v: any): Array<{ type: string; chargeRequired: number }> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  return Object.entries(v)
    .map(([type, charge]) => ({ type, chargeRequired: Number(charge) }))
    .filter((t) => Number.isFinite(t.chargeRequired))
    .sort((a, b) => a.chargeRequired - b.chargeRequired);
}

// AttackSetTypeFromAnimType: naturalMelee/weaponMelee/magicMelee -> melee; weaponRanged -> ranged;
// magic -> magic. (Unknown -> melee, the safe default for a contact attack.)
export function typeFromAnimType(animType: string): AttackType {
  switch (animType) {
    case "#weaponRanged": return "ranged";
    case "#magic": return "magic";
    // NOTE: #naturalRanged is intentionally NOT mapped to "ranged" here — the slice's CpuAI `ranged` flag
    // (spawnEnemy) and the cooldown calibration treat the bundled #naturalRanged actors as melee-feel
    // combatants, and globally reclassifying them would shift ~30 actors' fire-rate/behaviour (out of K
    // scope). K6 (ninja/shrouder) classifies its two weapons explicitly instead (rangedNatural cfg).
    case "#naturalRanged": case "#naturalMelee": case "#weaponMelee": case "#magicMelee": default: return "melee";
  }
}

const numOr = (v: any, d: number): number => (typeof v === "number" ? v : d);
const strOr = (v: any, d: string): string => (typeof v === "string" ? v : d);

// MELEE_SCALE — the calibration factor on melee `power·strength` so per-swing damage stays at the
// slice's tuned numbers (the powers are calibrated for the engine's native units, not the port's px
// energies; see B2 plan §f.2). Faithful melee damage = (power_L1 · strength · MELEE_SCALE) carried as
// the collision-vector L1, times damageMultiplier as `mult`. The faithful multiplicative model fixes
// the sword/punch ratio at 8 (power 1·mult 16 vs power 2·mult 1), whereas the pre-B2 flat-+160 sword has
// ratio 5.0 — the two cannot both match exactly under one scale. We pin #punch to the pre-B2 value (the
// natural attack, asserted by the calibration unit test):
//   #punch       (power_L1 2, mult 1,  strength 8): 2·8·SCALE·1   = 16·SCALE  == round(8*4)+8 = 40 -> SCALE 2.5
//   merlinSword  (power_L1 1, mult 16, strength 8): 1·8·SCALE·16  = 128·SCALE = 320
// #punch lands at exactly the pre-B2 40. The sword is 320 (vs pre-B2's 200) — the unavoidable, faithful
// consequence of its real damageMultiplier 16; room-1 hostiles are 15–300 energy and cleared by both
// (gate verified by the smoke), the headroom only showing against high-energy actors (blackOrc 1200:
// 4 swings vs 6) which don't gate the slice.
export const MELEE_SCALE = 2.5;
// DAMAGE_SCALE — alias of MELEE_SCALE; the single PLAYER-side melee scale (K1). The player's #punch/sword
// stay pinned (40 / 320). Kept as a named export so the player path and the calibration are self-documenting.
export const DAMAGE_SCALE = MELEE_SCALE;

// K1 — the ENEMY-side scales. The port's MELEE_SCALE was reverse-engineered from the PLAYER's
// power(2)·strength(8) so #punch=40; applying it to enemies (mults 3–16) inflates them 11–22× (a swordOrc
// would 3-shot, a blackOrc one-shot the player). So the enemy side gets its OWN consistent scale on the
// SAME faithful power·strength·mult formula — a deliberate, documented px-scale decoupling (the same kind
// A1 took for knockback). ENEMY_DAMAGE_SCALE holds the rank-and-file (warrior/swordOrc) near today's
// ~4/hit while restoring the faithful ordering the tuned model erased (blackOrc, str 30, now hits HARDER
// than swordOrc — 16 vs 4 — faithfully, with no one-shots). BULLET_DAMAGE_SCALE on speed·power·mult keeps
// enemy bolts near today's per-hit. See docs/parity/plans/K1-faithful-damage.md §b.
export const ENEMY_DAMAGE_SCALE = 0.18;   // on enemy melee power·strength·mult
export const BULLET_DAMAGE_SCALE = 0.40;  // on enemy/spell bullet speed·power·mult

// The base collision-vector L1 magnitude for a melee swing (before damageMultiplier is applied as mult).
export function meleeBasePower(attack: AttackData, strength: number): number {
  return attack.powerScalar * strength * MELEE_SCALE;
}

// enemyMeleeBasePower — the ENEMY twin of meleeBasePower (K1): the same faithful power·strength product,
// scaled by the enemy-side ENEMY_DAMAGE_SCALE instead of the player's MELEE_SCALE. damageMultiplier is
// carried as `mult` (so the L1 here is power·strength·ENEMY_DAMAGE_SCALE), inertia-damped at the victim.
export function enemyMeleeBasePower(attack: AttackData, strength: number): number {
  return attack.powerScalar * strength * ENEMY_DAMAGE_SCALE;
}

// resolveAttack(raw): build an AttackData from a (possibly partial) #attack proplist, filling from
// structAttack defaults. `raw` is normally already structAttack-merged by registry.resolveActor, but we
// re-default defensively so a bare {name,power} also resolves.
// resolveAttack(raw, owner?): owner is the resolved ACTOR record (for top-level #splashDamageOn /
// #explodeEvents that live OUTSIDE the #attack proplist — towerAxe/energyPulse/energyMine bullets).
export function resolveAttack(raw: Record<string, any> | undefined, owner?: Record<string, any>): AttackData {
  const r = raw ?? {};
  const o = owner ?? {};
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
    // I7 GMG charge-param set (defaults 0 / false so a non-GMG weapon under GMG can't fire — only
    // energyBlast/energyBeam/energyPulse carry gmgAutoFire). gmgChargeSpeedMax mirrors gmgChargeSpeed.
    gmgChargeMax: numOr(r["gmgChargeMax"], 0),
    gmgChargeSpeed: numOr(r["gmgChargeSpeed"], 0),
    gmgChargeStart: numOr(r["gmgChargeStart"], 0),
    gmgAutoFire: r["gmgAutoFire"] === true,
    // I8 beams: streaming-release fields (#none releaseFunction -> single bolt, the B2 default).
    beam: r["beam"] === true,
    fireDelay: numOr(r["fireDelay"], 0),
    releaseFunction: strOr(r["releaseFunction"], "#none"),
    // C2/C3: raw #type drives the splash resolver branch; splashDamageOn is a top-level actor prop.
    attackType: strOr(r["type"], d["type"] as string),
    explodeCharge: numOr(r["explodeCharge"], d["explodeCharge"] as number),
    splashDamageOn: o["splashDamageOn"] === true || r["splashDamageOn"] === true,
    payloadFunction: normPayload(r["payloadFunction"] ?? d["payloadFunction"]),
    freezeMultiplier: numOr(r["freezeMultiplier"], d["freezeMultiplier"] as number),
    glowTeal: r["glowTeal"] === true,
    explodeFunction: strOr(r["explodeFunction"], d["explodeFunction"] as string),
    multistage: normMultistage(r["multistage"]),
    randomSummon: r["randomSummon"] === true,
    residentTeamCategory: strOr(r["residentTeamCategory"], d["residentTeamCategory"] as string),
    chargePerUnit: numOr(r["chargePerUnit"], d["chargePerUnit"] as number),
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
    // K6 setMultiAttack: a #multiAttack CPU carries a SECOND weapon (the #weapon's melee #attack) so the
    // range-based auto-switch has both to choose between (weapon 1 = ranged natural, weapon 2 = melee).
    const second = cfg["attack2"] as AttackData | undefined;
    if (second && second.name && second.name !== "#none" && second.name !== natural?.name) {
      this.addWeapon(second.name, second);
      this.setCurrentWeapon(natural?.name ?? second.name); // default to weapon 1 (ranged), faithful
    }
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

  // setMultiAttack (modWeaponManager.setMultiAttack): range-based 2-weapon auto-switch for a #multiAttack
  // CPU with ≥2 weapons — natural ranged weapon 1 + melee weapon 2 (ninja: shuriken+ninjaSword, shrouder:
  // throwSmoke+pinShooter). All compares SQUARED (faithful). targetObj is the AI's committed target (so we
  // can read its attack type); (tx,ty)/(mx,my) the target/self loc; bufferDist the switch radius (#bufferDist).
  setMultiAttack(targetObj: import("../engine/dispatch").Entity | null, tx: number, ty: number, mx: number, my: number, bufferDist: number): void {
    const w1 = this.order[0], w2 = this.order[1];
    if (!w1 || !w2) return;                         // need ≥2 weapons
    if (!targetObj) { this.setCurrentWeapon(w1); return; }  // no target → ranged weapon 1
    const distToTarget = (tx - mx) ** 2 + (ty - my) ** 2;   // GeomDistSqr
    const a2 = this.weapons.get(w2)!;
    // if weapon 2 is itself ranged, the buffer is weapon 2's reach.
    let buf = bufferDist;
    if (a2.type === "ranged") buf = a2.reach;
    const attackDist = distToTarget - buf * buf;
    if (attackDist > 0) { this.setCurrentWeapon(w1); return; }  // target beyond buffer → ranged weapon 1
    // within the buffer: branch on the TARGET's attack type.
    const targetType = (targetObj.send("getTargeting") as { hits: string[] } | undefined) ? this.targetAttackType(targetObj) : "melee";
    if (targetType === "melee") {
      // a melee target at dist²>20 with our weapon 2 being melee → keep ranged weapon 1 (poke from range).
      if (distToTarget > 20 && a2.type === "melee") this.setCurrentWeapon(w1);
      else this.setCurrentWeapon(w2);
    } else {
      this.setCurrentWeapon(w2);                    // non-melee target inside buffer → melee weapon 2
    }
  }

  // the committed target's own attack type (targetObj.getAttack().type) — drives the melee/non-melee branch.
  private targetAttackType(targetObj: import("../engine/dispatch").Entity): "melee" | "ranged" | "magic" {
    const ca = targetObj.send("getCurrentAttack") as AttackData | null | undefined;
    return ca ? ca.type : "melee";
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
