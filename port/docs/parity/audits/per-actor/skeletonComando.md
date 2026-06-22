# Actor Parity Audit: skeletonComando

**Date:** 2026-06-22 (re-audit; supersedes the earlier DIVERGENCES=1 report — that root divergence is now FIXED)
**Actor:** skeletonComando
**Sources:** casts/data/act_skeletonComando.txt, casts/data/act_skeletonComandoSword.txt,
  casts/script_objects/objAiCPU.txt, casts/script_objects/objAiAttack.txt,
  casts/script_objects/objCPUCharacter.txt, casts/script_objects/modEnergy.txt,
  casts/script_objects/modWeaponTechnique.txt, casts/master_objects/structMaster.txt,
  port/src/entities/archetypes.ts, port/src/components/weapon.ts, port/src/components/control.ts
**Probe:** port/tools/_audit_skeletonComando.ts (RUN 2026-06-22 against the real src/generated/assets.json bundle; DELETED after run)

**Result: CLEAN — 0 PORT DIVERGENCES.** (1 faithful original-game quirk: the `dammageMultiplier` typo, documented WONTFIX.)

---

## 1. Derived correct behavior (from the ORIGINAL cast/data)

### Identity / team
- `#objType: #objCPUCharacter`, `#AiType: #objAiCPU`, `#inherit: #CPUCharacter`
  (CPUCharacter adds `frictionReel point(10,10)`, `pathfinding`, `walkType:#anyDirSpeed`, base walkSpeed 3 — overridden).
- `#team: #undead` (hostile to #aldevar).
- No `#collisionDetection:false`, no `#reincarnateAs`, no `#minEnergy`, no `#leaveWhenFinished`, no `#multiAttack`, no `#runReload`, not a ghost.

### Stats (act_skeletonComando.txt)
| Property | Value |
|----------|-------|
| energy | 275 |
| strength | 12 |
| dexterity | 4 |
| eyestrain | 30 |
| inertia | 65 |
| walkSpeed | 8 (overrides CPUCharacter 3) |
| experienceImWorth | 20 |
| damageSpeed | 5 |
| stallSpeed | 4 |
| frictionReel | point(10,10) (inherited) |

### Sprite char (`#data #name`)
Art char = **`skeletonComando`** (`#name: "skeletonComando"`). modAnimSet keys strips off `#name`.
Bundled strips (src/generated/assets.json `anims`): `skeletonComando_stand`, `_walk`, `_weaponMelee`, `_reel`, `_grave` — ALL present.
No death strip; death plays the grave strip (`objCPUCharacter.flasherFinished` → `drawGrave`).

### Weapon: skeletonComandoSword (act_skeletonComandoSword.txt — `#objPowerUp #inherit #weapon`)
| Field | Value | Meaning |
|-------|-------|---------|
| `#animType` | `#weaponMelee` | melee-contact attack |
| `#animframe` | 3 | hit fires on the (1-based) frame-3 crossing → exactly ONE hit per swing |
| `#cooldown` | 0 | raw |
| `#collisionLoc` | point(27, -3) | strike point → melee reach = |x| = 27 px |
| `#power` | point(1, 0) | melee knockback magnitude (scalar 1) |
| `#hits` | [#teamMembers, #teamBuildings] | strikes units AND buildings |
| `#sound` | "skeleton_fire" | swing sound |
| `#dammageMultiplier` | 14 | **MISSPELLED — see §3 WONTFIX (never read)** |

### Cadence (modWeaponTechnique / WeaponManager)
weaponTechnique 0 → no frame add/skip. The swing-to-swing cadence = effective melee cooldown
(rawCooldown 0 + 6-frame buffer, scaled by agility 1) + the weaponMelee strip play.

### AI / death
- Committed-target melee FSM (objAiCPU): `findTarget → moveToAttack → attack(weaponMelee strip) → attackFin`.
- `targetInReachMelee` gates on the strike point (collisionLoc.x = 27 px), NOT `#reach` (ranged-only).
- Lethal hit → `flasherFinished` → `goMode(#finish)` + `drawGrave()` + `setDead(true)`; leaves a grave (graveOn default true).

---

## 2. Reproduced in the PORT (probe RUN, 200 ticks)

Harness: real `src/generated/assets.json` bundle; `CollisionGrid(80,80,32)`; `unitMap.configure(32,0,0)`;
`rebuildCombatSubstrate()` each tick; skeletonComando spawned at (400,400) with a pinned live victim at (470,400).

| Observable | Derived-correct | Observed (port) | Status |
|------------|-----------------|-----------------|--------|
| anim char resolves to real strip (NOT blackOrc) | `skeletonComando` | `skeletonComando` (blackOrc fallback = false) | ✅ |
| attack.animType | `#weaponMelee` | `#weaponMelee` (type=melee) | ✅ |
| attack.animFrame | `[3]` | `[3]` | ✅ |
| hit COUNT per #animframe | 1 hit / swing | 18 swings / 18 disc-hits / 18 damaging-hits over 200t (1 per ~11t) | ✅ |
| collisionLoc | {27,-3} | {27,-3} | ✅ |
| reach (CpuAI / impact disc) | 27 (strike pt) / 25 (attack.reach) | CpuAI.reach=27, Targeting disc=27 | ✅ |
| power | scalar 1 | powerScalar 1 | ✅ |
| sound | skeleton_fire | skeleton_fire | ✅ |
| hits roles | [#teamMembers,#teamBuildings] | [#teamMembers,#teamBuildings] | ✅ |
| damageMultiplier (effective) | 1 (typo → default) | 1 | ✅ (faithful quirk) |
| per-hit damage | ~2.16 (power·str·scale·mult=1) | firstHitDmg 2.16 | ✅ |
| ranged / runReload / ghost | false / false / false | false / false / false | ✅ |
| FSM | findTarget→moveToAttack→attack | moveToAttack (+dazed on reel) observed; closes to in-reach and swings | ✅ |
| facing toward target at +x | faces right (facingLeft=false) | facingLeft=false | ✅ |
| death + grave | dies, leaves grave | isDead=true, getGraveOn=true, grave strip bundled | ✅ |
| team / energy | #undead / 275 | #undead / 275 | ✅ |

Every derived behavior reproduced faithfully. No FAILs.
(Probe note: an early "0 hits" reading was a harness artifact — the probe was resetting the victim's energy
BEFORE sampling it. Once the read was booked before the per-tick restore, 18 damaging hits matched the 18 swings.)

---

## 3. Divergences & quirks

### NO PORT DIVERGENCES.

### Prior report DIV-1 is now FIXED (verified, not inherited)
The earlier audit reported a root divergence: the `hasAttack` guard rejected the weapon because
`act_skeletonComandoSword.txt` declares an unquoted bare-symbol `#name: skeletonComandoSword`, which the
data parser serialises as `{ "$global": "skeletonComandoSword" }` (an object, not a string). The old guard
required `typeof atk["name"] === "string"`, so `hasAttack` went false and the unit fell back to a synthetic
`#naturalMelee` attack (wrong animType/animFrame/cooldown/power/collisionLoc/hits/sound).

**Current code already handles this** — `port/src/entities/archetypes.ts:215-219` normalises a `$global`
name object to `"#" + name` before the guard:
```typescript
const atkNameRaw = atk["name"];
const atkName = typeof atkNameRaw === "string" ? atkNameRaw
  : atkNameRaw && typeof atkNameRaw === "object" && "$global" in (atkNameRaw as Record<string, unknown>)
    ? "#" + String((atkNameRaw as Record<string, string>)["$global"]) : "";
const hasAttack = animType !== "" && atkName !== "" && atkName !== "#none";
```
The live probe confirms the weapon attack now resolves correctly (animType `#weaponMelee`, animFrame `[3]`,
collisionLoc {27,-3}, sound `skeleton_fire`, power 1). The prior DIVERGENCES=1 finding no longer reproduces.

### WONTFIX — FAITHFUL original-game bug: the `dammageMultiplier` typo
- **Original data** (`casts/data/act_skeletonComandoSword.txt:14`): `#dammageMultiplier: 14` (double-m typo).
- **Original engine** (`casts/script_objects/modEnergy.txt:276`): `multiplier = attackingObj.getAttack().damageMultiplier` — reads the CORRECTLY-spelled key.
- **Original default** (`casts/master_objects/structMaster.txt:171`): `a[#damageMultiplier] = 1`.
- Because the `#attack` proplist is structAttack-merged, the typo `#dammageMultiplier:14` lands as a separate,
  never-read property; `#damageMultiplier` stays at its default **1**. So in the ORIGINAL GAME this sword
  swings at multiplier **1, not 14** — its intended 14× was lost to the typo.
- **Port** (`port/src/components/weapon.ts:194` reads `r["damageMultiplier"]`; `port/src/data/registry.ts:26`
  STRUCT_ATTACK default `damageMultiplier: 1`): resolves to **1** too. Probe confirmed `attack.damageMultiplier = 1`.
- This is a candidate ORIGINAL-GAME bug, faithfully reproduced. **Do NOT "fix" to 14** — that would diverge from the original.
- (The sibling `act_skeletonGiantSword.txt` carries the identical `#dammageMultiplier:8` typo — same WONTFIX class.)

---

## Summary

| Category | Count |
|----------|-------|
| Real PORT divergences | 0 |
| Faithful original-game quirks (WONTFIX) | 1 (dammageMultiplier typo → mult 1) |
| Prior reported divergences now FIXED & re-verified | 1 ($global name guard) |

**Status: DIVERGENCES=0** — skeletonComando is parity-clean; behavior reproduced faithfully against the real bundle.

---

`skeletonComando | DIVERGENCES=0`
- No port divergences. Faithful quirk: `#dammageMultiplier:14` typo in act_skeletonComandoSword.txt is never read by the engine (modEnergy reads `damageMultiplier`); effective multiplier is 1 in both original and port (WONTFIX). The prior `$global` weapon-name guard divergence is already fixed at archetypes.ts:215-219.
