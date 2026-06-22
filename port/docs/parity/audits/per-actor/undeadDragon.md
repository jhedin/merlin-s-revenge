# Behavioral Audit: act_undeadDragon

**Actor:** undeadDragon | **Type:** #objCPUCharacter | **Team:** #undead | **AiType:** #objAiCPU

Method: derived correct behavior from `casts/data/act_undeadDragon.txt` + the resolved #inherit/#attack
chain and the original modAttack/modWeaponManager/objAiAttack scripts; then REPRODUCED it in the port by
spawning `undeadDragon` against a live target and ticking 250 frames (probe `tools/_audit_undeadDragon.ts`,
since deleted). Bundle: `src/generated/assets.json`.

## Derived-correct vs observed

| Property | Derived (original) | Observed (port, ran) | Status |
|----------|--------------------|----------------------|--------|
| objType / AiType | #objCPUCharacter / #objAiCPU | EnemyArchetype, committed-target CPU FSM | ✓ |
| team | #undead (hates aldevar/village/orcs/…) | `#undead`; hunts the aldevar player | ✓ |
| energy | 500 | 500 | ✓ |
| strength / dexterity | 10 / 10 | 10 / 10 | ✓ |
| experienceImWorth | 50 | 50 | ✓ |
| walkSpeed | 3 (→ ×0.6 px/tick) | 3 → moved toward target (#moveToAttack) | ✓ |
| **#name (sprite char)** | `"undeadDragon"` | `spriteCharOr → "undeadDragon"`; anim.char = `undeadDragon`, **never blackOrc** (verified across 250 ticks). `undeadDragon_stand/walk/reel/naturalRanged/grave` all bundled | ✓ |
| attack.animType | #naturalRanged | resolves type=`ranged`, fights at range, plays `undeadDragon_naturalRanged` | ✓ |
| **attack.#animframe** | `[3]` (fire on frame 3, **one shot per cycle**) | exactly **1 bullet per attack cycle** (14 shots in 250 ticks) | ✓ |
| attack.bullet / #name | #blueFlame / #blueFlame | bullet entity char = `blueFlame`; `blueFlame_fly` bundled | ✓ |
| attack.reach | 150 | reach 150 used as the ranged fire gate | ✓ |
| **attack.#firingType** | #fullstrength → constant speed = getStrength() (10) | bullet speed = **10.00 px/tick** (= strength, NOT distance/10=7.0) | ✓ |
| attack.sound | "dragon_fire" | played on fire; `dragon_fire` bundled | ✓ |
| takeHitSound | "dragon_hit" | forwarded; `dragon_hit` bundled | ✓ |
| dieSound | #none | no death sound | ✓ |
| death / grave | modGrave, graveOn (default true), **no reincarnation** | died on lethal hit; graveOn true, `undeadDragon_grave` bundled. No reincarnate module — correct (undeadDragon does NOT reincarnate; that's the undeadSummon spell, not this actor) | ✓ |
| collisionLoc | point(16,-8) | muzzle offset for the blueFlame spawn | ✓ |

## DIVERGENCES

### D1 — Fire cadence: port ~18 ticks vs original ~14–15 ticks (cooldown:0 weapon)  — PORT abstraction, not a bug
- **Original:** `act_undeadDragon.txt:12` `#cooldown: 0`. In modWeaponManager the cooldown counter is
  built with `c.tim[2] = theAttack.cooldown` = 0 (`modWeaponManager.txt:171`), so `getCooldownFin` is
  **always true** for this weapon. Re-attack is therefore gated ONLY by the attack animation completing
  (objAiAttack.attack checks getCooldownFin then re-enters; `objAiAttack.txt:38`). The
  `undeadDragon_naturalRanged` strip is 7 frames × `dela:2` ≈ **14–15 ticks**, so the original dragon
  breathes roughly every 14–15 ticks.
- **Port:** `archetypes.ts:206-207` derives `effectiveCooldown` for EVERY ranged weapon as
  `framesWanted = ceil((rawCooldown-1)/inc) + 18`; for `rawCooldown:0`, inc(dexterity)=10 →
  `ceil(-1/10)+18 = 18`, `effectiveCooldown = round(18×10+1) = 181`, recovering in **18 ticks**. Observed
  cadence was a flat **18-tick** gap (fire ticks 5,23,41,…,239). The attack window (anim 14 +2 = 16) is
  shorter than 18, so the cooldown counter — not the animation — sets the cadence.
- **Classification:** This is the port-wide `+18` ranged-cooldown buffer (documented at `archetypes.ts:189-207`),
  applied uniformly to all ranged enemies. It mis-models a literal `cooldown:0` weapon (which the original
  intends to fire as fast as its anim plays) by ~3–4 ticks/shot. NOT a dragon-specific port bug and within the
  team-wide cooldown-feel calibration; flagged here for completeness. Slow-firing by ~20%, never wrong-output.

## Faithful original-game quirks (documented, NOT fixed)
- `#cooldown: 0` with `#dexterity: 10` means the original's only fire-rate limiter is the attack-anim length —
  intentional in the original data (the dragon is a fast continuous breather). The port's calibration slightly
  slows it (D1).

## Verified, no divergence
- Sprite resolution: renders as its real `undeadDragon` strip (the audit's headline risk — a wrong fallback to
  `blackOrc` — does NOT occur). Bullet renders as `blueFlame`.
- One shot per `#animframe` (no dropped/duplicated frames; the list `[3]` fires exactly once per cycle).
- `#fullstrength` firing model correctly produces a constant-speed (strength=10) projectile, matching the
  original `throwVect = distXY / (distToTarget/strength)` (magnitude = strength). `modAttack.txt:753-765`.
- Team allegiance, energy, XP, movement, death→grave, takeHit/attack sounds — all faithful.

**Status: 1 divergence (D1, a documented port-wide cooldown abstraction; no dragon-specific PORT bug).**
