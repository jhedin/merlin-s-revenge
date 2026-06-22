# Per-Actor Parity Audit: fangBunny (+ fangBunnyBaby / fangBunnyBabyBullet / fangBunnyPortal)

**Method:** Behavior derived from the ORIGINAL cast/data, then REPRODUCED in the port via a node harness
(`tools/_audit_fangBunny.ts`, since deleted) that loaded the REAL `src/generated/assets.json`, spawned each
actor with `#aldevar` target dummies (#cave hates #aldevar), and ticked ~200 frames through
`rebuildCombatSubstrate()` + the full component update.

**Harness note:** `spawnEnemy/spawnAlly/spawnDwelling` do NOT push to `game.entities` (main.ts does that).
The harness wraps them to push — without it the unit map stays empty and nothing targets/fires. (Harness
requirement, not a port bug.)

---

## SECTION 1 — Derived-correct behavior (from the original)

### fangBunny — `casts/data/act_fangBunny.txt`
| Property | Original value |
|---|---|
| objType / AiType / inherit | #objCPUCharacter / #objAiCPU / #CPUCharacter |
| team | #cave (hates #aldevar,… — `tem_cave.txt:7`) |
| energy / strength / inertia | 500 / 10 / 30 |
| walkSpeed / dexterity / damageSpeed | 6 / 10 / 3 |
| experienceImWorth / eyestrain | 75 / 25 |
| attack | `#fangStrike` #naturalMelee, **#animframe: 4**, damageMultiplier 0.5, power(0.5,1), collisionLoc(30,0), cooldown 0, hits [#teamMembers,#teamBuildings], sound `fangBunny_fire` |
| death / reincarnate | `#dieSound:#none`, no `#reincarnateAs` → leaves a grave, NO spawn-on-death |
| sprite #name | `fangBunny` (strips `fangBunny_stand/walk/naturalMelee/grave` bundled) |

**Derived:** melee bruiser. One strike per swing on strip frame 4. No babies on death, no reincarnation.

### fangBunnyBaby — `casts/data/act_fangBunnyBaby.txt`
| Property | Original value |
|---|---|
| team / energy / strength | #cave / 200 / 8 |
| walkSpeed / dexterity / inertia | 4 / 1 / 50 |
| attack | `#catapultBullet` #naturalRanged, **#animframe: [5,6,7]**, bullet `#fangBunnyBabyBullet`, reach 125, cooldown 30, firingType #fullstrength, collisionLoc(0,-5), sound `fangBunnyBaby_fire` |
| weaponTechnique | 0 |
| sprite #name | `fangBunnyBaby` (`_naturalRanged` = 8 frames) |

**Derived:** ranged thrower. **3-shot burst** per attack (one bullet per listed frame 5,6,7), 30-frame cooldown.

### fangBunnyBabyBullet — `casts/data/act_fangBunnyBabyBullet.txt`
inherit #bullet, attack #bullet power 0.5 / damageMultiplier 3, friction(4,4), weight 0.4, `#character: #bullet`,
`#recordInRoomState:false`, `#rotational:false`. **`#name:"fangBunnyBabyBullet"`** but `#character:#bullet`
→ renders off the generic bullet sprite (the `fangBunnyBabyBullet_fly/_land` strips), not a stand strip.

### fangBunnyPortal — `casts/data/act_fangBunnyPortal.txt`
#objDwelling, energy 750, totalResidents 12, team #cave. residentGroups: fangBunny (buildTime[20,25],
groupSize[1,2]) + fangBunnyBaby (buildTime[15,20], groupSize[1,3]). Strips `fangBunnyPortal_stand/grave/
produceGroup/altStand` bundled.

**Reincarnation:** `modReincarnate` (`casts/script_objects/modReincarnate.txt`) is param-driven via
`#reincarnateAs` — NONE of the four fang actors set it. There is **no reincarnation / no spawn-babies-on-death**
mechanic for fangBunny; baby production is purely the portal dwelling.

---

## SECTION 2 — Observed in the port (reproduced)

```
SPRITE CHAR:  fangBunny->"fangBunny"  fangBunnyBaby->"fangBunnyBaby"  fangBunnyPortal->"fangBunnyPortal"
              (all resolve to their REAL bundled strip — NOT blackOrc)   fangBunnyBabyBullet->"blackOrc"*

fangBunny     attack {name:#fangStrike type:melee animType:#naturalMelee animFrame:[4] reach:25 mult:0.5
                      sound:fangBunny_fire}  team:#cave
              naturalMelee strip = 6 frames; 1 hit per swing (18 swings / 18 attack-entries = 1.00/swing) ✓
              -> HIT lands when the strip SHOWS frame 5  (data #animframe = 4)        << +1 frame offset

fangBunnyBaby attack {name:#catapultBullet type:ranged animType:#naturalRanged animFrame:[5,6,7] reach:125
                      bullet:#fangBunnyBabyBullet firingType:#fullstrength cooldown:30}  team:#cave
              naturalRanged strip = 8 frames; 3 shots per UNINTERRUPTED attack ✓ (count faithful)
              -> shots fire on strip frames 6,7,8  (data #animframe = [5,6,7])        << +1 frame offset
              fangBunnyBabyBullet record present; `fangBunnyBabyBullet_fly` strip bundled

fangBunnyPortal  team:#cave; produced BOTH fangBunny (char "fangBunny") and fangBunnyBaby (char
                 "fangBunnyBaby") — neither blackOrc; 12 live residents at budget. ✓

reincarnation: fangBunny / fangBunnyBaby #reincarnateAs = none ✓ (no spawn-on-death)
```
\* fangBunnyBabyBullet→"blackOrc" is the resolver fallback for a `#character:#bullet` actor with no
`fangBunnyBabyBullet_stand`; the fired projectile renders through the Projectile/bullet path (`_fly`/`_land`
strips bundled), NOT this stand fallback — so it is not a live divergence.

---

## SECTION 3 — Compare + divergences

### ✓ FAITHFUL (no action)
- **Sprite chars** all resolve to the real bundled strips (`anim.ts:30` `spriteCharOr`); none fall back to
  blackOrc. Portal-spawned fangBunny / fangBunnyBaby also carry their own sprite.
- **fangBunny melee:** 1 hit per swing, mult 0.5, hits members+buildings, team #cave, sound, reach all match.
- **fangBunnyBaby ranged:** 3-shot burst per attack (COUNT faithful), reach 125, bullet, firingType, team.
- **fangBunnyPortal:** produces both resident types from its real `#residentGroups`, budget 12.
- **No reincarnation / no spawn-on-death** — matches the data (no `#reincarnateAs` on any fang actor).

### DIVERGENCE 1 (PORT bug, minor): animation-driven hits/shots fire ONE strip-frame LATE
- **Derived-correct:** the hit fires on the frame whose 1-based index is in `#animframe`. fangBunny → frame
  **4**; fangBunnyBaby → frames **5,6,7**.
  - Original `casts/script_objects/modAttack.txt:577-617` (`isOnAttackFrame`: `getAnimFrameFresh()` AND
    `getAnimFrame()` ∈ `pAttack.animFrame`), dispatched from `objAiAttack.txt:389-406`.
  - In the original per-tick order, `objCharacter.update` (`casts/script_objects/objCharacter.txt:299-335`)
    runs `updateAttack()` FIRST, then `ancestor.update()` advances the strip — the AI checks the frame the
    strip is CURRENTLY showing.
- **Observed (port):** the hit lands one frame later — fangBunny on strip frame **5**, fangBunnyBaby on
  **6,7,8**.
  - Port `EnemyArchetype` orders `EnemyAI` BEFORE `Anim` (`port/src/entities/archetypes.ts:36`).
    `CpuAI.updateAttack` reads `an.frameFresh()` / `an.attackFrame()` (`port/src/components/control.ts:748-764`)
    BEFORE `Anim.update` advances the strip this tick (`port/src/components/anim.ts:133-177`), so the AI
    reads the PREVIOUS tick's frame state — a one-tick read lag, so the listed `#animframe` lands +1 frame.
- **Impact:** the SHOT/HIT **COUNT is unchanged** (1 melee hit; 3-shot burst), so combat balance stays
  faithful. Only the on-screen frame the strike/throw VISUALLY syncs to is shifted by one frame. Low
  severity. (The frame-8 burst shot outside [5,6,7] is the same lag surfacing the one-shot strip's final
  crossing; net is still 3 shots.)
- **Verdict:** real but minor PORT timing divergence rooted in component update order. It is SYSTEMIC (every
  animation-driven enemy attack, not fangBunny-specific) — do NOT patch it per-actor.

### DIVERGENCE 2 (stale comment, NOT a behavior bug): "no act_ record" comment is wrong
- `port/src/entities/archetypes.ts:78` comment: *"#fangBunnyBaby / #SpeedyGuy etc. have no act_ record."*
- **Reality:** `act_fangBunnyBaby.txt` DOES exist; `registry.resolveActor("fangBunnyBaby")` resolves it and
  the portal correctly spawns fangBunnyBaby (verified: 8 produced, char `fangBunnyBaby`). The real filter
  (`archetypes.ts:88`) does the right thing — only the inline comment is inaccurate. No behavioral effect
  (documentation cleanup, not a fix).

### Candidate ORIGINAL-GAME quirks (faithful — document, do NOT fix)
- fangBunny `#attack.cooldown: 0` → the port re-derives an effective cooldown from the swing-strip length
  (`archetypes.ts:206-207`), so it doesn't swing every frame. Faithful to the original gating swing re-entry
  on `getAnimLooped()` (the animation IS the cadence clock), not on the literal 0.
- fangBunnyBabyBullet `#character:#bullet` (no own stand strip) → renders as a generic bullet. The original's
  own choice. Faithful.

---

**Files (dual-tree):**
- Original: `casts/data/act_fangBunny.txt`, `act_fangBunnyBaby.txt`, `act_fangBunnyBabyBullet.txt`,
  `act_fangBunnyPortal.txt`; `casts/script_objects/modAttack.txt:577-617`, `objAiAttack.txt:389-413`,
  `objCharacter.txt:299-335`, `modReincarnate.txt`; `casts/data/tem_cave.txt`.
- Port: `port/src/entities/archetypes.ts:36,78,88,151-389`, `port/src/components/control.ts:730-883`,
  `port/src/components/anim.ts:30-45,133-177`, `port/src/components/weapon.ts:180-185`,
  `port/src/data/registry.ts`.
