// modAttack charge math (calcAttackChargeMax/Start/Speed) — resolves the live per-cast charge values
// from a weapon's #attack data × the caster's mana stats (NO resource pool). Pure helpers.
//
//   chargeMax   = min(attack.chargeMax, capacity*chargeMaxModifier + chargeMaxBasic)
//                 * (limitMagic ? magicLimit/100 : 1)        // magicLimit defaults 100 (limiter unbuilt, §g)
//   chargeStart = min(attack.chargeStart + burst, chargeMax, chargeStartMax ?? ∞)
//   chargeSpeed = chargeSpeedMax==="unlimited" ? speed*flow : min(speed*flow, chargeSpeedMax)
//
// For energyBlast (chargeMaxModifier .75, chargeMaxBasic 5, chargeStart 0, chargeSpeed 1) against base
// mana (capacity 10, flow 1, burst 1) this reproduces the old SPELL constant exactly:
//   chargeMax = min(999, 10*.75+5) = 12.5 ; chargeStart = min(0+1, 12.5) = 1 ; chargeSpeed = 1*1 = 1.

import type { AttackData } from "./weapon";
import type { Rng } from "../engine/math";
import { game } from "../game/context";

export interface ManaStats { capacity: number; flow: number; burst: number; }

// Magic limiter (magicLimitMaster.getMagicLimit). Now a real room-scoped state (I1): an objMagicLimit
// region sets it (set(N) on spawn / setDefault() on room-leave); default 100 = no limit.
export const MAGIC_LIMIT = 100; // the default value (kept for back-compat; live value reads game.magicLimit)

// chargeMaxOf(attack, mana, rng?): the per-cast charge ceiling. `rng` enables the randomSummon wobble
// (calcAttackChargeMax 106-112) for skeleton/goblin/undead/sc summons — those let you NOT reliably hit
// the top tier each cast. Without an rng (or a non-randomSummon attack) the result is deterministic.
export function chargeMaxOf(attack: AttackData, mana: ManaStats, rng?: Rng, gmgOn = false): number {
  // I7: modAttack.gmgOn swaps pChargeMax to the flat gmgChargeMax (NO capacity calc, NO limitMagic
  // scaling — the literal gmgOn handler assigns pChargeMax = pAttack.gmgChargeMax directly).
  if (gmgOn) return attack.gmgChargeMax;
  let cm = Math.min(attack.chargeMax, mana.capacity * attack.chargeMaxModifier + attack.chargeMaxBasic);
  // calcAttackChargeMax: a #limitMagic spell's ceiling is scaled by the live magic limiter (room-scoped).
  if (attack.limitMagic) cm = cm * game.magicLimit.get() / 100;
  // randomSummon wobble: if the 2nd tier doesn't already exceed cm, randomise the ceiling within the
  // affordable band (tempMax = cm·random(20)/17 + random(tier1); cm = min(cm, tempMax) + random(2)−1).
  // random(n) is Lingo's 1..n inclusive (Rng.int). Bounded to [0, cm] by the min + the ±1 jitter clamp.
  if (rng && attack.randomSummon && attack.multistage.length >= 2) {
    const tier1 = attack.multistage[0]!.chargeRequired;
    const tier2 = attack.multistage[1]!.chargeRequired;
    if (tier2 - cm < 0) {
      const tempMax = cm * rng.int(20) / 17 + rng.int(tier1);
      cm = Math.min(cm, tempMax) + rng.int(2) - 1;
      if (cm < 0) cm = 0;
    }
  }
  return cm;
}

export function chargeStartOf(attack: AttackData, mana: ManaStats, gmgOn = false): number {
  // I7: gmgOn assigns pChargeStart = gmgChargeStart flat (energyBeam/Pulse 0, energyBlast 5).
  if (gmgOn) return Math.min(attack.gmgChargeStart, chargeMaxOf(attack, mana, undefined, true));
  // K11 — FAITHFUL calcAttackChargeStart (modAttack): the handler computes `pChargeStart + manaBurst`,
  // then a trailing `if pChargeStart <> #none then chargeStart = min(pChargeStart, chargeStartMax)`
  // OVERWRITES it (the condition checks the wrong var — an original bug). pChargeStart is always numeric
  // (structAttack default 1; energyBlast 0), so the overwrite always fires and **mana_burst is discarded**
  // for the starting charge — behavioral parity with the original (the port previously added burst; this
  // closes that deviation). chargeStartMax #none = no cap; a numeric one caps the start (summon spells).
  const cap = typeof attack.chargeStartMax === "number" ? attack.chargeStartMax : Infinity;
  return Math.min(attack.chargeStart, cap);
}

export function chargeSpeedOf(attack: AttackData, mana: ManaStats, gmgOn = false): number {
  // I7: gmgOn assigns pChargeSpeed = gmgChargeSpeed flat AND pChargeSpeedMax = gmgChargeSpeed (so the
  // raw speed is not flow-scaled — it's the fixed GMG ramp, e.g. energyBeam 2, energyBlast 5).
  if (gmgOn) return attack.gmgChargeSpeed;
  const raw = attack.chargeSpeed * mana.flow;
  if (attack.chargeSpeedMax === "#unlimited") return raw;
  return Math.min(raw, attack.chargeSpeedMax as number);
}
