# Behavioral Audit: act_evilTv  (REPRODUCED)

**Actor:** evilTv | **Type:** #objCPUCharacter | **AiType:** #objAiCPU | **Team:** #monsters
**Method:** ran a headless harness (`tools/_audit_evilTv.ts`, since deleted) that loaded the REAL
`src/generated/assets.json`, spawned `evilTv` with an inert #aldevar target ~360px away (> reach), and
ticked 250 frames (rebuildCombatSubstrate + send("update") each tick, bullets ticked).

## Derived-correct behavior (from `casts/data/act_evilTv.txt` + `act_spark.txt` + masters)

A ranged thrower CPU. `#attack`: `#naturalRanged`, `#bullet:#spark`, `#animFrame:5`, `#reach:200`,
`#firingType:#fullStrength`, `#cooldown:150`, `#sound:"quadranid_fire"`, `#collisionLoc:point(-1,-9)`,
`#targetRoles:[[#teamMembers],[#teamBuildings]]`. Stats: energy 125, strength 7, dexterity 10, walkSpeed 4,
inertia 60, damageSpeed 3, eyestrain 1, weaponTechnique 3, `#dieSound:#none`, `#runReload:true`,
`#startingLevel:0`. Sprite char = the data `#name` "evilTv" (objAnimSet.init keys strips off `name`, not
`charType` — `casts/script_objects/objAnimSet.txt:13`), so it must render off `anm_evilTv_*` strips. Bullet
`spark` (`#friction:point(3,3)`, `#attack{ #type:#bullet, power:0.4, damageMultiplier:8 }`) renders off
`spark_*`. KITES after each shot (`getRunReload` → goMode #runReload — `casts/script_objects/objCPUCharacter.txt:162`,
`casts/script_objects/objAiCPU.txt:53`). `#fullstrength` throw speed = strength (`casts/script_objects/modAttack.txt:753-759`).

## Reproduced (observed) vs derived

| Aspect | Derived-correct | Observed in port | Status |
|--------|-----------------|------------------|--------|
| anim char | `evilTv` (its #name strip) | `evilTv` (NOT blackOrc) — `evilTv_{stand,walk,naturalRanged,reel,grave}` all bundled & used | ✓ |
| attack mode | ranged thrower | `EnemyAI.ranged=true`, reachRanged=200 | ✓ |
| bullet | `#spark` → char `spark` | `bulletChar="spark"`; spark bullets fired, `spark_fly`/`spark_land` bundled | ✓ |
| #animFrame 5 → shots | 1 shot / attack cycle (strip has 8 frames, frame 5 fires) | exactly 1 bullet per cycle; 6 shots / 250 ticks | ✓ |
| bullet reaches target | yes (reach 200, fullStrength) | bullet closed to <16px of target → hit; travel ~411px (passThrough, faithful) | ✓ |
| #firingType #fullStrength | throwSpeed = strength = 7 | `isFullStrength` branch → throwSpeed=max(1,7)=7 (`src/components/control.ts:825-826`) | ✓ |
| runReload kiting | kite away after each shot | mode histogram `{moveToAttack:204, runReload:46}` — entered runReload after shots, retreated, re-engaged | ✓ |
| moveToAttack | approach when out of reach | started 360px out (> reach 200), closed to ~195px before firing | ✓ |
| facing | face the target | final facing right (target to the right); 10 facing flips while kiting/re-aiming | ✓ |
| cadence | ~recovery 23 ticks + kite travel | ~41 ticks/shot incl. kite — `effectiveCooldown` counter hi 231 = (ceil((150-1)/10)=15 +8 fireOffset)×10+1 | ✓ |
| team/allegiance | #monsters, hostile to #aldevar | spawned #monsters, hunted the #aldevar dummy | ✓ |
| energy / inertia / stats | 125 / 60 / str7 dex10 | resolved record matches exactly | ✓ |
| death/grave | grave shows (#graveOn default true) | `evilTv_grave` (2 frames) bundled; Grave.graveOn=true | ✓ |
| dieSound | #none | resolved "#none" — no death sound | ✓ |

## Divergences

**NONE.** Every derived behavior reproduced faithfully. The two properties historically at risk for this
actor are both handled:
- `#runReload:true` is read data-first (`src/entities/archetypes.ts:285`: `d["runReload"] === true || …`) —
  confirmed kiting in the run (46 runReload ticks). Original gate: `casts/script_objects/objCPUCharacter.txt:162`
  / `casts/script_objects/objAiCPU.txt:53`.
- `#firingType:#fullStrength` → throw velocity = strength (`src/components/control.ts:825-826`). Original:
  `casts/script_objects/modAttack.txt:753-759`.

## Faithful original-game quirks (NOT bugs — do not "fix")
- `#eyestrain:1` adds slight aim scatter at distance (`aimWithEyestrain`) so the player can dodge — faithful
  (`objAiAttack.modifyLocWithEyestrain`).
- Bullet flies past the target on a miss (passThrough projectile) and decays via `#friction` 3 — faithful
  `objMoveXY` behavior; the spark hits on collision, not on a homing guarantee.
- `#weaponTechnique:3` — the original hardcodes the technique inc; catalogued elsewhere, no per-actor effect.

**Status: FAITHFUL — 0 divergences (reproduced).**
