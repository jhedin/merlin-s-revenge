# iceAura Audit

## Summary
iceAura (actor #objMine with #payloadFunction #takeFreeze) is a freezing proximity mine on team #ice. Behavioral parity verified: all critical properties migrated, FSM structure matches, freeze payload correctly routed.

## Critical Properties
| Property | Lingo | Port | Status |
|----------|-------|------|--------|
| objType | #objMine | #objMine | ✓ |
| team | #ice | #ice | ✓ |
| teamRole | #teamMines | #teamMines | ✓ |
| payloadFunction | #takeFreeze | ["takeFreeze"] (normalized) | ✓ |
| freezeMultiplier | .5 | 0.5 | ✓ |
| damageMultiplier | 0 | 0 | ✓ |
| triggerRadius | 16 | 16 | ✓ |
| timeToPrime | 0.1 | 0.1 | ✓ |
| dieOnExplode | false | false | ✓ |
| explodeCharge | 18 | 18 (attack.explodeCharge) | ✓ |
| glowTeal | false | false | ✓ |

## FSM Verification

### Lingo (objMine.txt)
- **#stand** (0-29): updatePrime counts down pPrimeCounter (tim[2]=0.1) → goal #primed
- **#primed** (30+): updateCheck ticks every 3 frames; on fin, updateCheckCollisions → if dist < triggerRadius² → #mineTriggered event
- **#mineTriggered** → modExploder.explode() → g.teamMaster.impactAttack(me.big) → resolveSplash + #explodeFin
- **#explodeFin**: dieOnExplode=false → resetMine() re-arms, pExplosions++; no dieOnExplodeNumber → re-arms forever

### Port (Mine.ts)
- **stand** (0-29): prime.once() ticks down → prime.fin → mode="primed" ✓
- **primed** (30+): check.once() every 3 frames; on check.fin → collisionDetected() searches hostiles in triggerRadius ✓
- **detonate**: calls resolveSplash(attack, ...) where attack.payloadFunction=["takeFreeze"] ✓
- **post-detonate**: dieOnExplode=false → resetMine() re-arms, explosions++; no dieOnExplodeNumber → re-arms forever ✓

## Payload Verification

### Lingo freeze flow
1. modExploder.explode() → g.teamMaster.impactAttack(me.big) (modSplashDamage.txt:133)
2. teamMaster scans disc (power radius) for hostiles matching hits=[#teamMembers]
3. For each hostile: calcCollisionVect(targetLoc, attackLoc, power) → collision vector
4. CallPayloadFunction(payloadFunctions=[#takeFreeze], victim, collisionVect, me.big, owner)
5. modFreeze.takeFreeze(collisionVect, attackingObj, owner):
   - If not frozen: latch frozen=true, set speed=0.5x, arm glowTeal if attackObj.attack.glowTeal=true
   - Add freeze ticks: (|vx|+|vy|) × freezeMultiplier × 4, clamped to tim[2]=1000 (modFreeze.txt:70-88)

### Port freeze flow
1. Mine.detonate() → resolveSplash(entity, attack, x, y, attackerId, hits=[#teamMembers], "#enemy")
2. resolveSplash: radius=explodeCharge/2=9; explode disc hit test (dist² < (radius+12)²)
3. calcCollisionVectSpell: speed=(hitRange-dist)×power; geomMoveVector(cx, cy, tx, ty, speed)
4. applyPayload(attack.payloadFunction=["takeFreeze"], victim, vx, vy, attack, attackerId):
   - victim.send("takeFreeze", vx, vy, attackerId, attack.freezeMultiplier=0.5, attack.glowTeal=false)
5. Freeze.takeFreeze(vx, vy, attackerId, freezeMultiplier=0.5, glowTeal=false):
   - If not frozen: frozen=true, speed=0.5x; glowTeal=false (no glow for iceAura)
   - Add freeze ticks: (|vx|+|vy|) × 0.5 × 4, clamped to FREEZE_MAX=1000 ✓

## Team Allegiance Verification
- iceAura team=#ice; when it explodes (mine.detonate), allegiance="#enemy" is passed to resolveSplash
- resolveSplash → impactAreaAttack(attacker, ..., allegiance="#enemy")
- calcTargetTeams("#ice", "#enemy") resolves to the team(s) that #ice hates
- #ice team hates: aldevar, orcs, undead (standard Merlin RTS alignment)
- Hostiles from those teams trigger and freeze correctly ✓

## Component Cascade (Port Implementation)
```
Mine (FSM) ──[detonate]──> resolveSplash ──> impactAreaAttack ──> applyPayload ──> Freeze.takeFreeze
    attack=iceAura#attack            │              │                  │              │
    payloadFunction=[takeFreeze] ─────┼──────────────┤                  └──────> (|vx|+|vy|)×mult×4
    freezeMultiplier=0.5 ────────────┼──────────────┼──────────────────────────> ticks += min(FREEZE_MAX)
```

## Test Coverage
- Port test (phase_i.test.ts:271-279): snowAura (sister freeze mine) correctly freezes on detonate
- snowAura has identical data to iceAura (same #payloadFunction, #freezeMultiplier, #damageMultiplier)
- Test verifies: frozen=true, energy unchanged (damageMultiplier=0), freezeFactor=0.5 ✓

## Non-Issues Confirmed
- audio/volume: not applicable to phase I (system in scope §g.3)
- eyestrain: sprite animation not in scope
- rotational: auras are static (walkSpeed=0)
- miniMapStatus: #clr (clear) — rendering not behavior
- collideWithTarget: false — expected for static mines
- glowTeal: false — iceAura does not glow (only arcticBlast freeze does)

## Conclusion
iceAura exhibits **identical freeze behavior** in Lingo and port:
1. Primes for 0.1s
2. Checks for hostiles in radius 16 every 3 frames
3. Detonates on trigger, running takeFreeze payload on all hostiles in explode disc
4. Freezes to 0.5x speed for (|vx|+|vy|)×0.5×4 ticks, capped at 1000
5. Re-arms indefinitely (no dieOnExplodeNumber)
6. Team-gated to #ice's hates (aldevar, orcs, undead)

**Status: CLEAN**
