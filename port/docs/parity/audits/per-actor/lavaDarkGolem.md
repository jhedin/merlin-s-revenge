# Behavioral Audit: act_lavaDarkGolem

**Actor:** lavaDarkGolem | **Type:** #objCPUCharacter | **Team:** #scarlet | **AiType:** #objAiCPU

Ranged splash thrower of #flamingRock. The flaming rock EXPLODES and leaves a lingering #fire mine.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalRanged | RANGED splash thrower | ✓ |
| `attack.bullet` | #flamingRock (#explode) | splashBullet path (fireSplashBullet) | ✓ |
| `attack.reach` | 150 | reachRanged=150 | ✓ |
| `flamingRock.reincarnateAs` | [#fire] | **FIXED** — bullet now hatches a #fire mine on death (was dropped) | ✓ |
| `team` | #scarlet | enemy | ✓ |

## Gap found + FIXED
- **bullet #reincarnateAs dropped** — the port's pooled BulletArchetype was [Movement, Projectile] with no
  reincarnation, so flamingRock exploded but left NO fire (and eggs never hatched). Now the bullet carries
  its #reincarnateAs and the Projectile death choke-point spawns each child via spawnFromSymbol
  (flamingRock→#fire mine, lizardEgg→#bug, ostrichEgg→#babyOstrich). casts/data/act_flamingRock.txt:23 +
  casts/script_objects/objBullet.txt:282 | port/src/components/projectile.ts (finish) + control.ts + archetypes.ts.

**Status: FIXED (bullet reincarnation — systemic: flamingRock + lizardEgg + ostrichEgg).**

---

## Anim-Cosmetic Sweep (2026-06-23) — REPRODUCED

**Method:** throwaway probe (`port/tools/_audit_animcosmetic.ts`, deleted) loaded the REAL `assets.json`,
spawned lavaDarkGolem + a `#aldevar` target, ticked 200 frames, then applied a non-lethal hit and a lethal kill.
Strip availability cross-checked against the ORIGINAL extracted bitmaps (`extracted/engine/bitmaps`).

| Aspect | Observed | Verdict |
|--------|----------|---------|
| (a) anim char | `spriteCharOr("lavaDarkGolem")` → **`lavaDarkGolem`** (via `#name`), NEVER `blackOrc` | CORRECT |
| (b) strips | stand(1)/walk(8)/naturalRanged(26)/grave(2) resolve to real `lavaDarkGolem_*` art; **NO `_reel`** | see (d) |
| (c) attack strip + hit sync | `lavaDarkGolem_naturalRanged` plays; bullet (#flamingRock) fires on **#animframe [7,14]** (matches data); 8 throws / 8 bullets in 200f | CORRECT |
| (d) non-lethal reel | `animAction`→`"reel"` but **no `lavaDarkGolem_reel` strip** → falls back to **stand** | FAITHFUL QUIRK |
| (e) death visual | `getGraveOn=true`; `lavaDarkGolem_grave` (2f) renders, z≪0 (behind living), faces right, no tint | CORRECT |

**On (d) — NOT a port bug.** The ORIGINAL ships NO `anm_lavaDarkGolem_reel_*` bitmap (only grave/naturalRanged/
stand/walk exist in `extracted/engine/bitmaps`). The original `objAnimSet.symExistsOrDefault` (`ParentScript 80`)
maps any MISSING strip to **`#stand`**, NOT to a stand-in char. The port's `Anim.animFor` does the identical
fallback (`idx[char_reel] ?? idx[char_stand]`). So lavaDarkGolem "reeling" by holding its STAND frame is exactly
the shipped behavior — reproduced faithfully. The white flick-on-hit (modColourTransform) still plays via
ColourTransform, so the hit is visually acknowledged even without a reel pose.

The naturalRanged attack-frame note in this file's deferred list (`#animframe:[7,14]` "deferred") is SUPERSEDED:
the port DOES gate the throw on frames [7,14] (observed), reading the lowercase `animframe` data key over the
camelCase `animFrame:2` STRUCT default.

**Anim-cosmetic: CLEAN (0 PORT divergences; 1 faithful quirk — reel→stand, no reel art in original).**
