# Parity Audit: experienceStar

## Actor Type
`#objStar` / `#experienceStar` (collectible XP reward)

## Data Properties
- **Lingo (casts/data/act_experienceStar.txt)**: objType=#objStar, character=#experienceStar, lifeCount=30, inertia=50, weight=1, friction=(1,10), minimapStatus=#clr
- **Port (port/src/generated/data.json)**: Same properties present and correct

## Behavioral Flow

### Original Lingo (casts/)
1. **XP Award on Kill** (casts/script_objects/modExperience.txt:99-118):
   - Enemy dies → `attributeExperience()` called (line 190)
   - Attacker gains `pExperienceImWorth + (victim.pExperienceGained / 2)` (line 112)
   - Level-up check: `attemptToLevelUp()` (line 142)

2. **Visual Star Drop** (casts/script_objects/modStarReleaser.txt:30-46):
   - `releaseStar()` queues star release (line 31)
   - `update()` calls `g.starMaster.experienceStar(me.big)` to spawn visual entity (line 39)
   - Star is #objStar with character=#experienceStar, acts as #objAiPowerUp (collision pickup)

3. **Star Collection** (casts/script_objects/objAiPowerUp.txt:26-36):
   - On player collision: calls `me.pCharacterPrg.collected(pPlayer)` (line 31)
   - objCharacter has no collected() handler → no-op
   - Star is visually consumed; XP was already awarded on kill

### Port TypeScript (port/src/)
1. **XP Award on Kill** (port/src/components/combat.ts:44-46):
   - Enemy dies → Energy component sets `dead=true` (line 41)
   - Attacker gains `killer?.send("gainXp", this.entity.send("getReward"))` (line 46)
   - `getReward()` returns `imWorth + floor(xp/2)` (experience.ts:40), matches Lingo

2. **Level-up Flow** (port/src/components/experience.ts:34-37):
   - `gainXp()` loop-checks `attemptLevelUp()` until threshold not met (line 36)
   - Threshold formula matches Lingo modExperience line 87
   - Single kill can grant multiple levels (same as Lingo line 141)

3. **Visual Star Drop**:
   - Port does **NOT** spawn visual #experienceStar entities
   - No `starMaster` equivalent; no collectible star actor
   - XP is the only game mechanic — no cosmetic pickup needed

## Correctness Assessment

**BEHAVIORAL PARITY: CONFIRMED**

The port is mechanically correct:
- XP awarded on kill matches Lingo formula and amount
- Level-up thresholds and multi-level-per-kill logic preserved
- Lingo stars are **visual only** (objCharacter.collected is a no-op); Lingo also awards XP directly at kill time, not on star collection

**Missing Feature (Non-Behavioral)**:
- Visual experienceStar entities are not spawned when enemies die
- This is cosmetic feedback only; the audit spec excludes cosmetic gaps
- XP mechanic (the behavioral core) is fully implemented

## Verdict
CLEAN — No behavioral divergence detected.
