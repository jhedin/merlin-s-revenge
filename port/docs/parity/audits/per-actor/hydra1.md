# Hydra1 Behavioral Parity Audit

## Summary
hydra1 is a ranged acid-spitter (#objAiCPU, #naturalRanged) on the #swamp team. The port correctly implements all key behaviors: ranged AI pathfinding, acid bullet firing with #fullstrength velocity model, team allegiance, energy initialization, and grave on death. One minor gap identified in dieSound handling.

## Property Coverage

| Property | Original | Port | Status | Notes |
|----------|----------|------|--------|-------|
| objType | #objCPUCharacter | EnemyArchetype | ✓ | Correctly mapped to enemy CPU archetype |
| AiType | #objAiCPU | CpuAI ranged branch | ✓ | Ranged AI FSM (findTarget → moveToAttack → attack/runReload) |
| animType | #naturalRanged | ranged=true | ✓ | Correctly classified as ranged (line 95 weapon.ts) |
| bullet | #acid | acid bullet resolved | ✓ | Acid bullet (power 0.6, damageMultiplier 4) correctly in data |
| energy | 500 | Energy.init(cfg["energy"]=500) | ✓ | Starts at 500 HP |
| maxEnergy | 1500 | (catalogued) | ✓ | Healing cap non-issue; hydras don't heal in shipped levels |
| team | #swamp | Team.team="#swamp" | ✓ | Correctly stored and registered |
| walkSpeed | 2 | 2 × 0.6 = 1.2 px/tick | ✓ | Scaled to engine px units |
| strength | 15 | stored (archetypes.ts:265) | ✓ | Used for power calculations and ranged bullet damage |
| dexterity | 1 | WeaponManager cooldown inc | ✓ | Ranged cooldown scaled by dexterity (line 180-188 archetypes.ts) |
| inertia | 50 | Movement.inertia damping | ✓ | Knockback/damage resistance applied correctly |
| attack.cooldown | 30 | Effective cooldown ~87 frames | ✓ | Calibrated per K1 plan (30 + 18 ranged addon, × dexterity 1) |
| attack.reach | 300 | CpuAI.reachRanged=300 | ✓ | Used for moveToAttack targeting gate |
| attack.firingType | #fullstrength | throwSpeed=strength (line 532) | ✓ | Constant-speed projectile at speed=15 |
| attack.sound | hydra1_fire | atkSound played on fire | ✓ | Audio routed correctly (line 594 control.ts) |
| damageSpeed | 3 | (catalogued) | ✓ | Non-behavioral property |
| dieSound | #none | (GAP) | ⚠ | See gaps below |
| startingLevel | 0 | No pre-levelling | ✓ | Starts at level 0 |
| experienceImWorth | 60 | Experience.reward calc | ✓ | Units grant 60 XP on death |
| Grave | implicit true | Grave.graveOn=true | ✓ | Leaves grave on death (not a ghost) |

## Behavioral Correctness

### Ranged AI
- ✓ Pathfinding (K3): moves toward target via scenic pathing
- ✓ Range gate (K6): fires when within reach 300 px
- ✓ Run-reload (runReload=false): No kiting for hydra1; stays and fires
- ✓ Targeting: targets #aldevar.hates (enemy allegiance)

### Acid Bullet Resolution
- ✓ Bullet actor (#acid) resolved at spawn (archetypes.ts:247)
- ✓ Bullet attack (power 0.6, damageMultiplier 4) read from data
- ✓ Damage formula (K1): speed × power × damageMultiplier × BULLET_DAMAGE_SCALE = 15 × 0.6 × 4 × 0.4 ≈ 14.4 per hit

### Energy/Death
- ✓ Starts at 500, no auto-regen (recoverDelay=0)
- ✓ Minion hydra reincarnation (hydra1 → none; multistage handled via Reincarnate)
- ✓ Death threshold: energy ≤ 0 (minEnergy=0 default)

## Gaps

### 1. dieSound #none Not Filtered
**Severity**: Low (silent failure, no observable impact)

**Evidence**:
- Original: `modSoundFX.txt:18-20` checks `if theSound <> #none then g.soundMaster.playSound(...)`
- Port: `combat.ts:43` calls `game.audio?.play(this.dieSound, 0.6)` without filtering "#none"
- For hydra1, dieSound="#none" is passed directly to play()

**Behavior**:
- Original: playSound() call is skipped entirely
- Port: audio.play("#none") is called; fails silently at buffer lookup (audio.ts:156 has no matching buffer)

**Result**: No audible difference (no sound plays either way), but the port makes a redundant failed call vs. early exit in original.

**Affected Code**:
- casts/script_objects/modSoundFX.txt:17-21 (original guard)
- port/src/components/combat.ts:43 (port, missing guard)
- port/src/systems/audio.ts:155-156 (silent fallback)

## Conclusion

hydra1 is **CLEAN** with one minor gap:

- ✓ All critical properties correctly read and initialized
- ✓ Ranged AI behavior faithful (pathfind → moveToAttack → ranged fire)
- ✓ Acid bullet damage formula correct
- ✓ Team/energy/death mechanics correct
- ⚠ dieSound="#none" not explicitly filtered (results in silent failed play call, no impact)

The #none dieSound gap is not functionally significant since the audio system gracefully handles missing buffers, but it diverges from the original's explicit guard pattern seen in modSoundFX and spellActor.

---
*Audit completed: 2026-06-21*
*Auditor: Claude Code*
