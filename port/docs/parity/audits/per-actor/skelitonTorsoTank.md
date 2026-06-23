# Audit: skelitonTorsoTank (Skeleton-Lord body part — middle tier)

Method: REPRODUCED in the port via a throwaway harness (`tools/_audit_skelitonTorsoTank.ts`,
since deleted) that loaded the real `src/generated/assets.json`, spawned the actor with an inert
hated target (#aldevar dwarf at 150px, inside reach 200), ticked 250 frames updating all entities
(bullets included), rebuilt the combat substrate each tick, then killed the actor to observe
death/grave/reincarnation. Derived behavior comes from `casts/data/act_skelitonTorsoTank.txt` and
the skeleton-lord body-part family (skelitonLord → skelitonUpper → **skelitonTorsoTank** →
skelitonHead reincarnation chain).

## Family context (derived)

The skelitonLord splits into a CASCADE of body parts as each tier dies:

| Actor | reincarnateAs | energy | attack | bullet | notes |
|-------|---------------|--------|--------|--------|-------|
| skelitonLord | [Upper, LowerLeg, Sword] | 750 | weapon skelitonLordSword (melee) | — | graveOn:false (vanishes) |
| skelitonUpper | [TorsoTank, Arm, Arm] | 220 | weapon skelitonSummon (caster) | — | graveOn:false, spellcaster |
| **skelitonTorsoTank** | **[skelitonHead, #none]** | **200** | **inline #naturalRanged** | **skelitonMissile** | **graveOn:true** |
| skelitonHead | (none) | 10 | inline #naturalRanged | skelitonMissile | graveOn:true, reach 600 |
| skelitonLowerLeg | [FootSoldier, FootSoldier] | 120 | naturalMelee highKick | — | graveOn:true |
| skelitonArm | (none) | 110 | weaponMelee swordSwipe | — | graveOn:true |

## Property Coverage (derived vs observed)

| Property | Original (casts/data/act_skelitonTorsoTank.txt) | Port (observed) | Status |
|----------|--------------------------------------------------|------------------|--------|
| #objType | #objCPUCharacter | ✓ EnemyArchetype CPU | ✓ MATCH |
| #AiType | #objAiCPU | ✓ committed-target FSM (moveToAttack) | ✓ MATCH |
| #team | #undead | ✓ #undead, tagged `enemy` | ✓ MATCH |
| #name (sprite char) | "skelitonTorsoTank" | ✓ animChar = `skelitonTorsoTank` (NOT blackOrc) | ✓ MATCH |
| #energy | 200 | ✓ energyFrac 1.0 at 200 | ✓ MATCH |
| #strength | 10 | ✓ 10 | ✓ MATCH |
| #walkSpeed | 6 | ✓ 6 (→3.6 px/tick) | ✓ MATCH |
| #experienceImWorth | 15 | ✓ 15 | ✓ MATCH |
| #eyestrain | 40 | ✓ 40 (aim scatter; bullet vy varies ±1.7) | ✓ MATCH |
| #inertia | 80 | ✓ 80 | ✓ MATCH |
| #damageSpeed | 3 | ✓ 3 | ✓ MATCH |
| #dieSound | #none | ✓ none | ✓ MATCH |
| #graveOn | true | ✓ true; corpse persists as grave | ✓ MATCH |
| #reincarnateAs | [#skelitonHead, #none] | ✓ spawns exactly 1 skelitonHead | ✓ MATCH |
| #attack.animType | #naturalRanged | ✓ type=ranged | ✓ MATCH |
| #attack.bullet | #skelitonMissile | ✓ fires skelitonMissile bullets | ✓ MATCH |
| #attack.animframe | 5 | ✓ animFrame [5] — 1 shot/cycle | ✓ MATCH |
| #attack.reach | 200 | ✓ reach 200; target@150 in reach | ✓ MATCH |
| #attack.collisionLoc | point(15,-3) | ✓ {x:15,y:-3} (bullet spawn offset) | ✓ MATCH |
| #attack.cooldown | 10 | ✓ raw 10 → effectiveCooldown 22 (calibrated, see B1) | ✓ MATCH |
| #attack.firingType | #fullstrength | ✓ #fullstrength (fixed throw velocity) | ✓ MATCH |
| #attack.sound | "quadranid_fire" | ✓ atkSound forwarded | ✓ MATCH |
| #attack.name | #fireMissile | ✓ #fireMissile | ✓ MATCH |

## Behavioral correctness (observed)

### Sprite char — resolves to real bundled strip (NOT blackOrc)
`spriteCharOr("skelitonTorsoTank")` finds the bundled `skelitonTorsoTank_stand` strip off the data
`#name`, so `animChar = "skelitonTorsoTank"`. The full strip set is bundled:
`skelitonTorsoTank_{stand,walk,naturalRanged(8f, one-shot),grave(2f)}`. **No blackOrc fallback.** ✓

### Ranged attack — 1 missile per #animframe 5 crossing
- AI runs `moveToAttack` (committed-target ranged FSM) for the entire run (target always at 150px,
  inside reach 200, so it never needs to close further).
- The 8-frame one-shot `naturalRanged` strip fires the hit once per FRESH crossing of frame 5
  (`animFrame:[5]`). Observed **11 shots in 250 ticks, exactly 1 bullet per cycle** — never a double
  or zero. Bullets spawn at the collisionLoc offset (≈425,~397) flying right (v≈9.6,±1).
- **Cadence: a clean 22-tick period** (gaps all 22). This is the documented effective-cooldown
  calibration: data cooldown 10 + dexterity 1 → recovery ceil((10-1)/1)=9, plus the fire-frame
  offset (ticks to replay the strip to its gating frame 5) → effectiveCooldown 22, matching the
  original objAiAttack "reset cooldown AT the firing frame, then the strip must replay" cadence.
- #eyestrain 40 scatters the aim: bullet vy varies across shots (−0.9 … +1.7), faithful to
  `objAiAttack.modifyLocWithEyestrain` (scatter scaled by dist/reach). ✓

### Death / grave / reincarnation
- Lethal `loseEnergy` sets `dead=true, killedInAction=true`. ✓
- `graveOn:true` → the dead tank persists in `game.entities` as its own grave (holds the
  `skelitonTorsoTank_grave` frame, drawn behind the living). ✓
- `Reincarnate` fires once (latched): `[#skelitonHead, #none]` → **exactly 1 skelitonHead spawned**
  (the `#none` placeholder correctly skipped, so the list-of-2 yields 1 child), at the corpse loc,
  team #undead, animChar `skelitonHead`. The child re-arms its OWN attack chain (it has no further
  reincarnateAs, so the cascade terminates there). ✓

## DIVERGENCES

NONE. Every derived property and behavior (team, energy, ranged attack via skelitonMissile, animframe
5 → 1 shot/cycle, reach 200, sprite char, grave persistence, and the [#skelitonHead,#none] → 1-head
reincarnation) reproduced faithfully in the port. The 22-tick cadence is the intended
effective-cooldown calibration (B1, documented in `archetypes.ts`), modeling the original's
fire-at-frame cooldown reset — a FAITHFUL modeling choice, not a divergence.

No probe-API artifacts: `loseEnergy(amount, attackerId)`, `getCurrentAttack`, `findTarget`,
`getGraveOn`, `getKilledInAction`, and `getActorType` all returned valid results; the spawned
skelitonHead was located via the real `getActorType` message.

---

## RE-VERIFY (2026-06-23) — fresh reproduction (`tools/_audit_combat.ts skelitonTorsoTank --dist=250`)
Real `assets.json`/`data.json`, pinned `#aldevar` player target.
- **Strips:** `stand`✓ `walk`✓ `grave`✓ `naturalRanged`✓ `reel`✓ (animChar=skelitonTorsoTank, no blackOrc/_stand fallback).
- **Ranged attack (#naturalRanged #fireMissile / bullet #skelitonMissile, reach 200, animFrame[5]):** fired **5 missiles over 250 ticks**, bullets reached & damaged the pinned target (firstDamage t=50), `#firingType:#fullstrength` velocity ~9.6px/tick. ✓
- **Reincarnation:** kill → `[skelitonHead]` (the `#none` 2nd entry correctly skipped). ✓
- **Verdict: CLEAN.**
