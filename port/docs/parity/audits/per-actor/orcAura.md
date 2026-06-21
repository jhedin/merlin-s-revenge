# orcAura Parity Audit

**Actor:** orcAura (#objType #objMine, #type #explode — aura mine deployed by orcs)

## Data Parity

| Property | Original | Port | Status |
|----------|----------|------|--------|
| triggerRadius | 16 | 16 | ✓ |
| dieOnExplode | false | false | ✓ |
| timeToPrime | 0.1 | 0.1 | ✓ |
| team | #orcs | #orcs | ✓ |
| attack.type | #explode | #explode | ✓ |
| attack.hits | [#teamMembers] | [#teamMembers] | ✓ |
| attack.payloadFunction | #takeFreeze | #takeFreeze | ✓ |
| attack.freezeMultiplier | 0.5 | 0.5 | ✓ |
| attack.explodeCharge | 18 | 18 | ✓ |
| attack.damageMultiplier | 0 | 0 | ✓ |
| attack.glowTeal | false | false | ✓ |

## Behavioral Parity

### FSM: Prime Phase
- **Original** (casts/script_objects/objMine.txt:97-99): updatePrime() ticks pPrimeCounter until fin, then mode → #primed
- **Port** (port/src/components/mine.ts:65-67): prime.once() ticks counter; when fin, mode → "primed"
- **Status:** ✓ Identical

### FSM: Check & Trigger Phase
- **Original** (objMine.txt:101-108): Every pCheckCounter cycle, calls updateCheckCollisions(); if hostile found, fire #mineTriggered
- **Port** (mine.ts:70-74): Every check.fin cycle, calls collisionDetected(); if true, detonate()
- **Status:** ✓ Identical

### Collision Detection
- **Original** (objMine.txt:112-122): `g.teamMaster.findTargetWithin(me.big, pTriggerRadiusTile).dist < pTriggerRadius²`
- **Port** (mine.ts:78-84): `game.teamMaster.findHostileWithin(entity, x, y, triggerRadius, hits).obj !== null`
- **Detail:** Port's findHostileWithin (systems/teams.ts) uses Euclidean distance internally, checks `dd <= r²` then returns obj; mine.ts checks obj !== null
- **Status:** ✓ Equivalent (both detect if any hostile within triggerRadius)

### Team Allegiance
- **Original** (objMine.txt:112-114): findTargetWithin implicitly routes through team.#hates (orcs hate non-orcs)
- **Port** (mine.ts:82, systems/teams.ts:calcTargetTeams): findHostileWithin(attacker=#orcs, allegiance="#enemy") → targets non-orc team members
- **Status:** ✓ Equivalent

### Detonation
- **Original** (objMine.txt:106): `me.big.internalEvent(#mineTriggered)` → modSplashDamage catches event, runs g.teamMaster.impactAttack
- **Port** (mine.ts:88-93): `detonate()` → `resolveSplash(entity, attack, x, y, ...)` with hits=[#teamMembers], allegiance="#enemy"
- **Status:** ✓ Equivalent

### Payload Routing
- **Original** (modSplashDamage.txt:129-137, CallPayloadFunction): Dispatcher handles #takeFreeze as symbol or list
- **Port** (splash.ts:19-39, applyPayload): normPayload converts #takeFreeze → ["takeFreeze"], applyPayload iterates and calls victim.send("takeFreeze", ...)
- **Status:** ✓ Equivalent

### Freeze Application
- **Original** (CallPayloadFunction #takeFreeze): Applies freeze status via takeFreeze(vector, multiplier)
- **Port** (splash.ts:25-28): `victim.send("takeFreeze", vx, vy, attackerId, attack.freezeMultiplier, attack.glowTeal)`
- **Multiplier:** 0.5 (from attack.freezeMultiplier) ✓
- **Status:** ✓ Equivalent

### Re-arm Logic (dieOnExplode=false)
- **Original** (objMine.txt:54-62): On #explodeFin, if !pDieOnExplode: resetMine(); pExplosions++; die if count reaches limit
- **Port** (mine.ts:96-104): On detonate(), if !dieOnExplode: resetMine(); explosions++; die if count reaches limit
- **Status:** ✓ Identical

## Conclusion

**CLEAN** — All core mine FSM states, trigger detection, splash detonation, payload routing, and re-arm mechanics match the original. orcAura primes for 0.1 frames, then every 3 frames checks for #teamMembers hostiles within 16 px radius, triggers #mineTriggered to detonate an #explode area hit (damageMultiplier:0) that applies #takeFreeze (freezeMultiplier:0.5, glowTeal:false) and re-arms until removed.
