# Behavioral Audit: act_hydra1

**Actor:** hydra1 | **Type:** #objCPUCharacter | **AiType:** #objAiCPU | **Team:** #swamp
**Method:** REPRODUCED in-port via `tools/_audit_hydra1.ts` (deleted) — real `generated/assets.json`
bundle, real `generated/data.json` registry, `CollisionGrid(80,80,32)`, `unitMap.configure(32,0,0)`,
`rebuildCombatSubstrate()` each tick. Spawned hydra1 + a player target, ran 260 ticks, then killed it
and ran 30 more to test reincarnation.

hydra1 is the **terminal (smallest) head** of the swamp Hydra: a slow ranged #acid spitter. The chain is
hydra3 → hydra2 → hydra1 (each `#reincarnateAs` its predecessor on death); **hydra1 has NO
`#reincarnateAs`, so it dies for good.**

---

## SECTION 1 — Derived-correct behavior (from the ORIGINAL)

Source: `casts/data/act_hydra1.txt`, `act_hydra2.txt`, `act_hydra3.txt`, `act_acid.txt`;
`casts/script_objects/modAttack.txt`, `modReincarnate.txt`, `modCharacterAttackProperties.txt`.

| Property | Original (act_hydra1.txt) | Meaning |
|----------|---------------------------|---------|
| `objType` / `AiType` / `inherit` | #objCPUCharacter / #objAiCPU / #CPUCharacter | a CPU combatant |
| `attack.animType` | **#naturalRanged** | fires a bullet at range (FSM = moveToAttack→fire) |
| `attack.bullet` | **#acid** | acid bullet (#inherit #bullet, power 0.6, damageMultiplier 4) |
| `attack.animframe` | **3** (single integer) | fire ONCE per cycle, on frame 3 of the strip |
| `attack.firingType` | **#fullstrength** | throw speed = attacker strength (constant-speed projectile) |
| `attack.reach` | **300** | ranged standoff distance |
| `attack.cooldown` | **30** | ranged re-fire gate (modified by #dexterity counter) |
| `attack.collisionLoc` | point(30,-5) | muzzle offset |
| `attack.name` / `sound` | #spitBullet / "hydra1_fire" | |
| `energy` / `maxEnergy` | **500 / 1500** | spawns at 500; maxEnergy is a heal cap |
| `minEnergy` | (absent → 0) | **dies at 0** (vs hydra2=500, hydra3=1000 die at floor into a child) |
| `reincarnateAs` | **(absent)** | **NO reincarnation — terminal head** |
| `team` | #swamp | enemy allegiance |
| `walkSpeed` | **2** | slow (vs hydra2/hydra3 = 6) |
| `strength` / `dexterity` / `eyestrain` | 15 / 1 / 20 | strength→throw speed; eyestrain→aim scatter |
| `experienceImWorth` / `dieSound` | 60 / #none | |

**isOnAttackFrame** (modAttack.txt:577-621): `#animframe: 3` is an integer (not a list), so the unit fires
exactly when `currentFrame == 3` AND the frame is fresh — **one shot per attack-strip cycle**.

**Reincarnation** (modReincarnate.txt:37-72): triggered on `#leftTeam` + `getKilledInAction`, iterating
`pReincarnateAs`. hydra1's list is empty → no spawn. (Context: hydra2 → [#hydra1], hydra3 → [#hydra2].)

---

## SECTION 2 — Observed in the PORT (reproduced)

```
anim char: hydra1
attack: {name:#spitBullet, animType:#naturalRanged, type:ranged, bullet:#acid,
         animFrame:[3], firingType:#fullstrength, reach:300, cooldown:48, collisionLoc:{30,-5}}
strips: hydra1_stand 1f | hydra1_walk 5f | hydra1_naturalRanged 6f | hydra1_grave 2f
        (hydra1_naturalMelee MISSING — n/a, hydra1 is ranged)
firing (260 ticks, target in reach):
   first bullet tick 5 | total 6 | bullet char = acid
   fire ticks: 5,52,99,146,193,240 | gaps: 47,47,47,47,47 (perfectly regular, ONE acid per cycle)
death / reincarnation:
   loseEnergy → isDead:true, energyFrac:0
   enemies before=1, after 30 ticks=1 (the dead hydra1 only; NO child spawned)
   hydra1 reincarnateAs (data): null → parsed [] ✓
   hydra2 reincarnateAs "#hydra1" → ["hydra1"] ✓   hydra3 "#hydra2" → ["hydra2"] ✓
```

---

## SECTION 3 — Derived-correct vs Observed

| Behavior | Derived (original) | Observed (port) | Status |
|----------|--------------------|-----------------|--------|
| Attack type | #naturalRanged → bullet | type "ranged", fires bullet | ✓ FAITHFUL |
| Bullet | #acid | acid spawned & flies | ✓ FAITHFUL |
| Shots per #animframe cycle | 1 (integer animframe 3) | exactly 1 per cycle (6 fires, regular) | ✓ FAITHFUL |
| firingType | #fullstrength (speed=strength) | firingType #fullstrength, full-strength branch | ✓ FAITHFUL |
| reach / collisionLoc | 300 / (30,-5) | 300 / (30,-5) | ✓ FAITHFUL |
| Sprite strips | hydra1_stand/walk/naturalRanged/grave bundled | all resolve, NO fallback to blackOrc | ✓ FAITHFUL |
| Attack strip | the 6-frame naturalRanged, fire on frame 3 | `hydra1_naturalRanged` (6f), animFrame [3] | ✓ FAITHFUL |
| energy / maxEnergy | 500 / 1500 | energy 500, max 1500 heal-cap | ✓ FAITHFUL |
| minEnergy (death floor) | 0 (dies fully) | undefined → 0 | ✓ FAITHFUL |
| Reincarnation | none (terminal head) | reincarnateAs [] → no child on death | ✓ FAITHFUL |
| Death | grave (hydra1_grave 2f), no respawn | isDead, grave strip present, stays dead | ✓ FAITHFUL |
| team / allegiance | #swamp (enemy) | #swamp, targets the player | ✓ FAITHFUL |
| walkSpeed | 2 (slow) | 2×0.6 px/tick (slice conv) | ✓ FAITHFUL |

### Documented-faithful calibration (NOT a divergence)
- **cooldown 30 → effective 48**: spawnEnemy re-derives every ranged enemy's cooldown
  (`archetypes.ts:206-207`: `framesWanted = ceil((30-1)/dexterity 1) + 18 = 47`,
  `effectiveCooldown = round(47*1+1) = 48`). This is the slice-wide B2 §f.3 attack-feel calibration applied
  to ALL ranged CPUs, not hydra1-specific. Observed gaps (47 ticks) match it exactly. Faithful by design.
- **Bullet damage** uses the K1 fixed-reference model (`power·4.5·BULLET_DAMAGE_SCALE`, mult 4 from acid),
  a deliberate decoupling of damage from travel speed (documented in `acid.md` / control.ts:838-847).
  Not a divergence — it is the project's pinned abstraction.

### Prior-audit note (audio channel leak) — UNCHANGED
The previous hydra1.md recorded a `dieSound:#none` engine bug (audio.ts channel leak) already FIXED.
Re-verified out of scope here: hydra1's #none die-sound is filtered (no-op), no regression observed.

---

## Verdict

**hydra1 is behaviorally FAITHFUL.** Every action resolves to a real bundled strip (no fallback); it fires
exactly one #acid bullet per attack cycle at #fullstrength within reach 300; it dies into a grave with NO
reincarnation (correct — terminal head, while hydra2/hydra3 correctly chain down). No PORT divergences and
no new candidate original-game bugs found.

**hydra1 | DIVERGENCES=0**
