# Behavioral Audit: act_swordNinja
**Actor:** swordNinja | #objCPUCharacter
Verified: AI mode, attack/weapon resolution, team allegiance, movement, death — all faithful.
(firingType throw-velocity, runReload, bullet-reincarnation, randomSummon wobble all confirmed where applicable.)
**Status: CLEAN.**

---

## Anim-Cosmetic Sweep (2026-06-23) — REPRODUCED

**Method:** throwaway probe (`port/tools/_audit_animcosmetic.ts`, deleted) loaded the REAL `assets.json`,
spawned swordNinja + a `#aldevar` target, ticked 200 frames, then applied a non-lethal hit and a lethal kill.

| Aspect | Observed | Verdict |
|--------|----------|---------|
| (a) anim char | `spriteCharOr("swordNinja")` → **`ninja`** (via `#name:"ninja"`), NEVER `blackOrc` | CORRECT |
| (b) strips | stand(1)/walk(8)/weaponMelee(16)/reel(1)/grave(2) all resolve to real `ninja_*` art | CORRECT |
| (c) attack strip + hit sync | `ninja_weaponMelee` plays during the swing; hit fires on **#animframe 13** (matches `ninjaSword #animframe:13`); 11 swings in 200f | CORRECT |
| (d) non-lethal reel | `animAction`→`"reel"`, `ninja_reel` (1f) present → reel STRIP shows | CORRECT |
| (e) death visual | `getGraveOn=true`; `ninja_grave` (2f) renders, z≪0 (behind living), faces right, no tint | CORRECT |

Note: `swordNinja #multiAttack:false`, so it is a pure melee swordsman (the multi-weapon ninja/shrouder path
is not exercised) — the `ninja_naturalRanged` strip is bundled but never played by this actor (faithful: the
shuriken-throwing variant is `shurikenNinja`, a separate actor). No cosmetic divergence.

**Anim-cosmetic: CLEAN (0 divergences).**
