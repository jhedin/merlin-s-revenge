# Actor Audit: skelitonFootSoldier (REPRODUCED)

Method: derived behavior from `casts/data/act_skelitonFootSoldier.txt` + inherited
`objCPUCharacter`/`objCharacter`/`modWeaponManager`, then **reproduced** the actor in a
headless port harness (throwaway `tools/_audit_skelitonFootSoldier.ts`, now deleted): real
`@/generated/assets.json`, `CollisionGrid(80,80,32)`, `teamMaster.unitMap.configure(32,0,0)`,
spawned via `spawnEnemy("skelitonFootSoldier")` vs an inert `#aldevar` dummy (a team `#undead`
hates), ticked 200 frames with `rebuildCombatSubstrate()` each tick, then killed to observe death.

## Dual tree

```
DATA  act_skelitonFootSoldier  (#objCPUCharacter, #AiType #objAiCPU, #inherit #CPUCharacter)
        #team #undead   #energy 90   #strength 3   #dexterity 10   #walkSpeed 4   #inertia 85
        #damageSpeed 3  #eyestrain 25  #experienceImWorth 3  #startingLevel 0
        #dieSound #none  #graveOn true   (no #reincarnateAs / #reincarnateInto — LEAF node)
        #attack:
          #animType #weaponMelee   #name #swordSwipe   #animframe 8
          #power point(3,0)   #damageMultiplier 1   #cooldown 0
          #collisionLoc point(20,0)   #hits [#teamMembers,#teamBuildings]   #sound "skeleton_fire"
        NO #data block / NO #name-sprite override  → sprite char keys off #name "skelitonFootSoldier"

PORT  EnemyArchetype (spawnEnemy) → CpuAI + WeaponManager + Anim + Energy + Grave + Reincarnate + Team
        team "#undead"  energy 90  strength 3  dexterity 10  maxSpeed 2.4 (=4×0.6)  inertia 85
        attack resolveAttack: animType "#weaponMelee" name "#swordSwipe" animFrame [8]
          power {3,0} mult 1  collisionLoc {20,0}  melee reach 20 (=|collisionLoc.x| clamp[16,90])
          effective cooldown 14 (rawCd 0 → recovery + melee fire-frame offset)
        animChar = spriteCharOr("skelitonFootSoldier") = "skelitonFootSoldier" (real strip)
        graveOn true; reincarnate list [] (leaf); dieSound none
```

## Derived vs Observed

| Aspect | Derived (original) | Observed (port reproduction) | Verdict |
|--------|--------------------|------------------------------|---------|
| Sprite char (`#data #name`) | keys off `#name "skelitonFootSoldier"`; strips bundled | `spriteCharOr → "skelitonFootSoldier"`, NOT blackOrc; strips `_stand/_walk/_weaponMelee/_reel/_grave` all present | FAITHFUL |
| Team / allegiance | `#undead`, hates `#aldevar`+others | team `#undead`; targeting `#enemy` `#closestDistance`; hits `[#teamMembers,#teamBuildings]`; engages `#aldevar` dummy | FAITHFUL |
| Energy / strength / dexterity | 90 / 3 / 10 | 90 / 3 / 10 | FAITHFUL |
| Movement | walkSpeed 4, inertia 85 | maxSpeed 2.4 (4×0.6 calib), inertia 85 | FAITHFUL |
| Attack type / weapon | `#weaponMelee` `#swordSwipe` | type "melee", name "#swordSwipe" | FAITHFUL |
| **#animframe (hit gate)** | **8** (fire on strip frame 8) | runtime `animFrame [8]`; **observed STRIP FRAME at every hit = 8** | FAITHFUL |
| Hits per swing | 1 (strip is 9-frame one-shot; frame 8 crosses once) | `[8,8,8,8,8,8,8,8,8,8,8]` → exactly 1 hit/swing | FAITHFUL |
| Reach (melee) | `#collisionLoc.x` = 20 (melee uses strike point, not `#reach`) | AI melee reach 20; targeting reach 20 | FAITHFUL |
| Power / mult | point(3,0), mult 1 | power {3,0}, mult 1 | FAITHFUL |
| Cadence | cooldown 0 → re-swing after the swing strip replays | steady **17 frames** between swing entries | FAITHFUL |
| Death | dieSound #none, killedInAction on lethal hit | isDead=true, killedInAction=true, no sound | FAITHFUL |
| Grave | `#graveOn true` → leaves a grave (drawGrave) | getGraveOn=true; `_grave` strip exists; corpse → grave action | FAITHFUL |
| Reincarnation | none (no `#reincarnateAs`/`#reincarnateInto`) | Reincarnate list `[]`; entity count stays 2 (no children spawned on death) | FAITHFUL |
| runReload / ranged | melee, no kiting | ranged=false, runReload=false | FAITHFUL |

## Probe-fail checks (NOT port divergences)

- Runtime `getCurrentAttack().reach = 25` is the structMaster `#reach` default, irrelevant for a
  melee weapon — the unit gates approach + damage on the strike point (`collisionLoc.x = 20`), which
  the harness confirms (AI reach 20). Faithful: `objAiCPU.targetInReachMelee` uses the strike point.
- The raw registry `attack.animFrame` shows the structMaster default `2`; this is the **pre-merge**
  default. `resolveAttack` reads the data override `#animframe 8` and the LIVE WeaponManager attack
  carries `animFrame [8]` — verified by reproduction (every hit fires on strip frame 8). No off-by-one.
- "hits per swing = 0.92" in the raw counts is `11 hits / 12 swing-entries`: the 12th swing was
  entered just before tick 200 and had not yet reached frame 8. Per-swing hit count is exactly 1.

## FAITHFUL vs PORT-BUG

- All audited behaviors reproduce FAITHFULLY. No port-bugs found.
- Doc-only nuance: the prior audit text described the effective cooldown as "~25 effective frames";
  the reproduced re-swing cadence is **17 frames** (effective cooldown 14 + strip replay). This is a
  stale prose estimate, not a behavioral divergence — corrected here.

## Conclusion

**CLEAN.** Reproduced end-to-end: the actor resolves its own bundled `skelitonFootSoldier` sprite
(not blackOrc), swings `#swordSwipe` firing exactly once on `#animframe 8`, melee reach 20, steady
17-frame cadence, `#undead` allegiance, and dies to a grave with no reincarnation (leaf node).
