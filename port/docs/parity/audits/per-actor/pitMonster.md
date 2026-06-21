# Audit: pitMonster

## Actor Profile
- **Type**: Re-arming mine (#objMine)
- **Lingo**: casts/data/act_pitMonster.txt
- **TS Port**: port/src/components/mine.ts + port/src/entities/objTypes.ts (spawnMine)
- **Data**: port/src/generated/data.json (act_pitMonster)

## Critical Properties
| Property | Lingo | TS Port | Status |
|----------|-------|---------|--------|
| `dieOnExplode` | false | false | ✓ |
| `timeToPrime` | 120 | 120 | ✓ |
| `triggerRadius` | 50 | 50 | ✓ |
| `timeToCheck` | (default 3) | (default 3) | ✓ |
| `dieOnExplodeNumber` | 0 | 0 | ✓ |
| `team` | #pitMonsters | #pitMonsters | ✓ |
| `teamRole` | #teamMines | #teamMines | ✓ |
| `attack.type` | #explode | #explode | ✓ |
| `attack.damageMultiplier` | 40 | 40 | ✓ |
| `attack.hits` | [#teamMembers] | [#teamMembers] | ✓ |

## FSM Behavioral Verification

### Prime Phase (casts/script_objects/objMine.txt:97-99)
```lingo
on updatePrime me
  fin = pPrimeCounter.fin
  if fin = false then Counter(pPrimeCounter)
  return fin
```
**TS Equivalent** (mine.ts:66-67):
```typescript
if (this.prime.fin) { this.mode = "primed"; } else this.prime.once();
```
Counter `hi=120, inc=1` → takes exactly 120 frames to reach fin. ✓

### Check Phase (objMine.txt:101-108)
```lingo
#primed:
  fin = me.updateCheck()
  if fin then       
    fin = me.updateCheckCollisions()
    if fin then
      me.big.internalEvent(#mineTriggered)
```
**TS Equivalent** (mine.ts:70-73):
```typescript
if (this.check.fin) {
  this.check.reset();
  if (this.collisionDetected()) this.detonate();
} else this.check.once();
```
Check counter `hi=3, inc=1` → every 3 frames when fin, collision test runs. ✓

### Collision Detection (objMine.txt:112-122)
```lingo
on updateCheckCollisions me
  dist = g.teamMaster.findTargetWithin(me.big,pTriggerRadiusTile).dist
  if dist < pTriggerRadius*pTriggerRadius then
    fin = true
```
**TS Equivalent** (mine.ts:79-84):
```typescript
private collisionDetected(): boolean {
  const hits = this.attack.hits.length ? this.attack.hits : ["#teamMembers"];
  const r = game.teamMaster.findHostileWithin(this.entity, m.x, m.y, this.triggerRadius, hits);
  return r.obj !== null;
}
```
Both use radius=50 and find nearest hostile within that distance. ✓
- Lingo uses dist² comparison; TS uses hypot + explicit dist check wrapped in findHostileWithin. ✓
- Both filter by team allegiance: #pitMonsters → hates [#aldevar, #monsterSummon, #cave, #goblins, #ice, #ninja, #magicalAlliance, #monsters, #swamp, #undead, #village, #scarlet, #orcs]. ✓
- Both filter by role (#teamMembers from attack.hits). ✓

### Detonate → Explode (objMine.txt:53-64 + modExploder.txt:41-47)
**Lingo**:
```lingo
#explodeFin:
  if pDieOnExplode then
    me.big.setDead(true)
  else
    me.resetMine()
    pExplosions = pExplosions +1
    if pDieOnExplodeNumber <= pExplosions and pDieOnExplodeNumber <> 0 then
      me.big.setDead(true)
```

**TS Equivalent** (mine.ts:95-104):
```typescript
if (this.dieOnExplode) {
  this.entity.send("takeHit", 999999, 0, this.entity.id);
} else {
  this.resetMine();
  this.explosions++;
  if (this.dieOnExplodeNumber !== 0 && this.explosions >= this.dieOnExplodeNumber) {
    this.entity.send("takeHit", 999999, 0, this.entity.id);
  }
}
```
Logic is equivalent: dieOnExplode=false → re-arm forever (dieOnExplodeNumber=0 never triggers death). ✓

**Splash Resolution** (mine.ts:88-94):
```typescript
resolveSplash(this.entity, this.attack, m.x, m.y, this.entity.id, hits, "#enemy");
if (this.explodeSound) game.audio?.play(this.explodeSound, 0.5);
```
- Uses resolveSplash (same engine as Lingo modExploder + modSplashDamage). ✓
- attack.type=#explode → explodeCharge/2 radius = 100/2=50px area. ✓
- Applies payload (takeHit for damage). ✓
- explodeSound=#none → silent (no-op). ✓

## Room-Clear Gating
MineArchetype.type = "mine" (objTypes.ts:36) → does NOT gate room-clear. ✓
This is correct: a re-arming pitMonster never dies, so it should not block level progression.

## Conclusion
All behavioral paths match:
- **Prime**: 120 frames before armed ✓
- **Check**: Every 3 frames scan for hostile within 50px ✓
- **Detonate**: Area splash at mine location ✓
- **Re-arm**: dieOnExplode=false + dieOnExplodeNumber=0 → loops forever ✓
- **Team Allegiance**: #pitMonsters team hates correctly applied ✓
- **Hit Roles**: #teamMembers filter applied ✓
- **Room-Clear**: Type "mine" → does not gate ✓

**CLEAN** — no behavioral divergences detected.
