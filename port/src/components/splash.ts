// SplashDamage (modSplashDamage + the #explode branch of modAttack): the area-hit resolver invoked at
// the moment a bullet/mine TRIGGERS (lands / collides / mineTriggered). It mirrors teamMaster.impactAttack
// -> impactMeleeAttack (the disc search) but with the radius + per-victim collision vector chosen by the
// attack #type, then runs the (possibly-list) payloadFunction on every hostile in the disc.
//
// CRITICAL CALIBRATION (plan §f.1): splash damage routes through the SAME (|vx|+|vy|)·mult collision-vector
// scale B2 calibrated for single-target hits — there is NO separate splash damage formula. The radial
// vector's L1 magnitude (≈ radius−dist for splash, (hitRange−dist)·power for explode) IS the px-scale
// knockback/damage vector A1's takeHit consumes, exactly like aimedVect for melee/bullet. The falloff
// shape (centre > mid > rim≈0) and the centre-hit lethality band are pinned by unit tests.

import type { Entity } from "../engine/dispatch";
import { game } from "../game/context";
import { geomMoveVector, collisionCalcVect } from "../engine/math";
import type { AttackData } from "./weapon";

// applyPayload (CallPayloadFunction): payloadFunction is a LIST run in order on the same hit — so one
// arctic/freeze hit both freezes AND damages off the SAME vector. Faithful to the symbol|list dispatch.
export function applyPayload(payload: string[], victim: Entity, vx: number, vy: number, attack: AttackData, attackerId: number): void {
  for (const fn of payload) {
    switch (fn) {
      case "takeHit":
        victim.send("takeHit", vx, vy, attackerId, attack.damageMultiplier);
        break;
      case "takeFreeze":
        // vector payload: magnitude = (|vx|+|vy|)·freezeMultiplier·4, 0.5x speed, optional teal glow.
        victim.send("takeFreeze", vx, vy, attackerId, attack.freezeMultiplier, attack.glowTeal);
        break;
      case "takeHeal":
        victim.send("takeHeal", vx, vy, attackerId); // heals (|vx|+|vy|)·2, gold glow (modEnergy)
        break;
      case "armyTeleportOut":
        // C: army-reserve persistence is G2 (out of scope §g) — no-op.
        break;
      default:
        break;
    }
  }
}

// resolveSplash(attacker, attack, cx, cy, attackerId): hit ALL hostiles in the type-derived disc.
//  - #explode  : radius = explodeCharge/2 ; hit if dist² < (radius+targetRadius)² ; vector =
//                direction self->victim with magnitude speed = (hitRange−dist)·power (calcCollisionVectSpell).
//  - splash    : radius = power ; hit if dist² < power² ; vector = CollisionCalcVect(victim, bullet, power).
// targetRadius is a fixed unit half-extent (the port has no per-actor getRadius at this layer; B1's box ≈
// 14 px => radius ≈ 12, matching the melee/bullet collision half-extents already used).
const TARGET_RADIUS = 12;

export function resolveSplash(
  attacker: Entity, attack: AttackData, cx: number, cy: number, attackerId: number,
  hits: string[], allegiance: string,
): void {
  const explode = attack.attackType === "#explode";
  const radius = explode ? attack.explodeCharge / 2 : attack.powerScalar; // power radius for splash bullets
  if (radius <= 0) return;
  // the disc the team-search must cover: explode hits out to radius+targetRadius, splash out to power.
  const searchRadius = explode ? radius + TARGET_RADIUS : radius;
  game.teamMaster.impactAreaAttack(attacker, cx, cy, searchRadius, hits, allegiance, (v) => {
    const p = v.send("getPos") as { x: number; y: number };
    const dist = Math.hypot(p.x - cx, p.y - cy);
    let vec: { x: number; y: number };
    if (explode) {
      const hitRange = radius + TARGET_RADIUS;
      if (dist * dist >= hitRange * hitRange) return;     // calcAttackHitMagic disc test
      const speed = (hitRange - dist) * attack.powerScalar; // calcCollisionVectSpell radial falloff
      if (speed <= 0) return;
      // calcCollisionVectSpell nudges a coincident target by point(0,1) so GeomMoveVector isn't degenerate.
      const tx = (p.x === cx && p.y === cy) ? cx : p.x;
      const ty = (p.x === cx && p.y === cy) ? cy + 1 : p.y;
      vec = geomMoveVector(cx, cy, tx, ty, speed);
    } else {
      if (dist * dist >= radius * radius) return;          // calcAttackHitSplash dist² < power²
      vec = collisionCalcVect(p.x, p.y, cx, cy, radius);   // CollisionCalcVect(victimLoc, bulletLoc, power)
      if (vec.x === 0 && vec.y === 0) return;
    }
    applyPayload(attack.payloadFunction, v, vec.x, vec.y, attack, attackerId);
  });
}
