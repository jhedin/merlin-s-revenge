# Audit: druid (Druid — Monster Heal Spellcaster)

Method: derived behavior from `casts/data/act_druid.txt` + `act_healBlast.txt` +
`objAiCPUSpellCaster.txt`, then REPRODUCED in the port via a throwaway node harness
(`tools/_audit_druid.ts`, since deleted) loading the real `src/generated/assets.json` bundle.
Spawned a druid + a damaged friendly monster (heal target) + a hostile `#aldevar` unit, ticked
300 frames, observed sprite resolution / cast count / heal payload / kiting / death.

## Derived-correct behavior (ORIGINAL)

Source: `casts/data/act_druid.txt`, `casts/data/act_healBlast.txt`,
`casts/data/act_energyBlast.txt` (energyBlastBullet ref), `casts/script_objects/objAiCPUSpellCaster.txt`,
`casts/script_objects/modWeaponManager.txt`, `casts/script_objects/modEnergy.txt`.

| Property | Original (casts/) | Port (observed) | Status |
|----------|-------------------|------------------|--------|
| #objType | #objCPUCharacter | ✓ | MATCH |
| #AiType | #objAiCPUSpellCaster | ✓ ranged+runReload+dodgesBullets | MATCH |
| #team | #monsters | ✓ #monsters | MATCH |
| #name (sprite char) | "druid" | ✓ resolves to `druid` (real strip, NOT blackOrc) | MATCH |
| #energy | 50 | ✓ 50/50 | MATCH |
| #inertia | 60 | ✓ 60 | MATCH |
| #walkSpeed | 3.5 (×0.6 → 2.1 px/tick) | ✓ moves/kites | MATCH |
| #weapon | #healBlast | ✓ current weapon #healBlast | MATCH |
| #attack (own) | #naturalMelee #punch, animFrame 14, reach pt(25,10) | backup only — see Divergence 1 | quirk |
| healBlast.animType | #magic | ✓ #magic (reach 9999) | MATCH |
| healBlast.animframe | #none | ✓ `[]` (cast fires on strip completion) | MATCH |
| healBlast.bullet | #energyBlastBullet | ✓ #energyBlastBullet | MATCH |
| healBlast.payloadFunction | #takeHeal | ✓ `["takeHeal"]` | MATCH |
| healBlast.targetAllegiance | #friendly | ✓ #friendly | MATCH |
| healBlast.targetCriteria | #lowestHealth | ✓ #lowestHealth (skips full-health) | MATCH |
| healBlast.targetRoles / hits | [[#teamMembers]] / [#teamMembers] | ✓ | MATCH |
| healBlast.spellSpeed | 30 | ✓ 30 | MATCH |
| #graveOn | (default true) | ✓ dies, druid_grave strip bundled | MATCH |

## Reproduced behavior (PORT, observed)

`anim.char = "druid"` (real strip exists), current weapon `#healBlast`, animType `#magic`,
reach 9999, animFrame `[]`, payload `["takeHeal"]`, bullet `#energyBlastBullet`,
targeting `{allegiance:#friendly, criteria:#lowestHealth, roles:[[#teamMembers]], hits:[#teamMembers]}`.

300-frame run (`tools/_audit_druid.ts`):
- Cast 2 heal bolts (frames 9, 76) on its own `#monsters` team, then STOPPED — correct, because
  once the heal target reached full health, `#lowestHealth` refresh (`systems/teams.ts:144`) rejects
  full-health candidates (`f >= 1 → continue`), so there is nothing left to heal.
- Heal target healed 480 → 1200 (full). `takeHeal` payload applied (`components/combat.ts:66`,
  modEnergy shape: healAmount = (|vx|+|vy|)·2).
- Plays `druid_charge` (the wind-up strip), plus walk/stand/reel — animates, never stands frozen
  (`components/control.ts:557-563` prefers the `charge` strip for a `#magic` caster).
- Kited / repositioned off spawn via the K4 `optimumPosition` chain
  (`components/control.ts:889-907`).
- Faced its heal target; died on a lethal hit; `druid_grave` strip is bundled.

→ The actor is behaviorally FAITHFUL. No PORT bugs found.

## Divergences

### Divergence 1 (FAITHFUL quirk — non-observable; NOT a bug)
The druid carries its OWN `#attack` (`#naturalMelee #punch`, animFrame 14) AND its `#weapon`
(`#healBlast`, `#magic`).

- Original: `modWeaponManager.txt:103-153` — `initNaturalAttack` registers the `#punch` melee
  weapon, THEN `initStartingWeapon` registers `#healBlast`; each `addWeapon` calls
  `setCurrentWeapon`, so BOTH weapons exist and `#healBlast` (last added) is current. The melee is
  a never-used backup because a spellcaster's `getAttack().reach == 9999` keeps it in
  `#moveToOptimumPosition` forever (`objAiCPUSpellCaster.txt:264-272`).
- Port: `entities/archetypes.ts:169-176` — for a spellcaster whose `#weapon` is `#magic`, it
  REPLACES the natural attack with the weapon attack (`atk = weaponAtk`), so only `#healBlast` is
  registered — the melee `#punch` backup is dropped.

Impact: NONE observable. A spellcaster never falls back to melee (reach 9999 always satisfied,
optimumPosition runs the heal cast). The dropped melee weapon and its `animFrame 14` are inert in
both engines for this actor. Documented as a faithful-enough simplification, not a fix target.

## Conclusion
druid is FAITHFUL. Sprite resolves to its real `druid` strip (not blackOrc); it casts `#healBlast`
(magic, reach 9999, `#energyBlastBullet`, `#takeHeal`) at its weakest friendly `#monsters`
teammate, heals it to full, then idles correctly; it kites, faces, and dies with a grave. The one
discrepancy (dropped inert melee backup weapon) is non-observable.
