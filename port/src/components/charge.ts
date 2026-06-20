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

export interface ManaStats { capacity: number; flow: number; burst: number; }

// Magic limiter (magicLimitMaster.getMagicLimit). Limiter master is unbuilt (§g) -> always 100 (no-op).
export const MAGIC_LIMIT = 100;

export function chargeMaxOf(attack: AttackData, mana: ManaStats): number {
  let cm = Math.min(attack.chargeMax, mana.capacity * attack.chargeMaxModifier + attack.chargeMaxBasic);
  if (attack.limitMagic) cm = cm * MAGIC_LIMIT / 100;
  return cm;
}

export function chargeStartOf(attack: AttackData, mana: ManaStats): number {
  // NOTE (deliberate, per the B2 "spell unchanged" gate): the port keeps today's `chargeStart + burst`
  // (clamped to chargeMax / chargeStartMax). Raw Lingo calcAttackChargeStart has a trailing
  // `if pChargeStart <> #none then chargeStart = min(pChargeStart, chargeStartMax)` that OVERWRITES the
  // burst-added value (so energyBlast actually starts at 0, not 0+burst). Honoring that literally would
  // change today's numbers (burst no longer raises the starting charge) — the gate forbids that here, so
  // we reproduce today's behavior. Revisit with the C-phase spell-content pass if burst-start matters.
  let cs = attack.chargeStart + mana.burst;
  cs = Math.min(cs, chargeMaxOf(attack, mana));
  if (attack.chargeStartMax !== "#none" && typeof attack.chargeStartMax === "number") {
    cs = Math.min(cs, attack.chargeStartMax);
  }
  return cs;
}

export function chargeSpeedOf(attack: AttackData, mana: ManaStats): number {
  const raw = attack.chargeSpeed * mana.flow;
  if (attack.chargeSpeedMax === "#unlimited") return raw;
  return Math.min(raw, attack.chargeSpeedMax as number);
}
