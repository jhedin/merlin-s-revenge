# HUD Bars Cluster Parity Audit

> **Follow-up (2026-06-21) — hover-health BUILT, and a correction.** The extracted globals settle the per-unit bar question: `gEnemyEnergyMasterOn = 0` (the always-on enemy bars are a Rapunzel feature, OFF here) and `gCharacterEnergyRolloverOn = 1` (hovering a character shows its energy + level + XP). So the port's previous **always-on** `drawEnemyBar` was the unfaithful part. Replaced with a hover **rollover** (`port/src/render/rollover.ts`, `characterEnergyRollOverMaster`): the mouse picks the character under the cursor and floats its energy (multicolour bar) + level (star pips) + experience bar at the unit; the modFreeze frost overlay stays always-on (it's a status indicator, not a health bar). Covered by `port/test/rollover.test.ts`.
>
> **gMapBoundary visual line — genuine NON-GAP in the port's render model.** `modBoundary` fills the 128px margin OUTSIDE the map rect (to mask off-map area when Director's stage was larger than the room). The port sizes the canvas to exactly one room (`viewW = roomSize.x * tile`), with no camera/margin and the player clamped inside — so the boundary bands at +128px are entirely off-canvas and would never render. Not built (it would be invisible rectangles); documented as structurally moot.
**Files audited (Lingo):**
- `casts/script_objects/objEnergyBar.txt`
- `casts/script_objects/objMulticolourEnergyBar.txt`
- `casts/script_objects/objMoveableEnergyBar.txt`
- `casts/script_objects/objExperienceBar.txt`
- `casts/script_objects/objMoveableExperienceBar.txt`
- `casts/script_objects/objMoveableLevelBar.txt`
- `casts/script_objects/objSpellIcons.txt`

**Port counterpart:** `port/src/main.ts` (drawHud, drawEnemyBar) + `port/src/components/combat.ts`, `experience.ts`

**Cross-reference sources:**
- `extracted/engine/scripts/MovieScript 16 - main.lasm` — layer globals (gGameEnergyBarLayer=170, gMapBoundaryLayer=150)
- `extracted/engine/scripts/MovieScript 1 - GameSpecific.ls` — gCharacterEnergyRolloverOn=1
- `casts/master_objects/characterEnergyRollOverMaster.txt` — runtime wiring of the three rollover bars
- `casts/script_objects/objPlayerMerlinCharacter.txt` — creates the player's objMulticolourEnergyBar

---

## Lingo Object Roles (established before analysing port)

| Object | Role |
|---|---|
| `objEnergyBar` | Base fill-bar: maps energy fraction to sprite width/height; single solid colour |
| `objMulticolourEnergyBar` | Extends objEnergyBar; recolours the fill after each energy update: red (0%) → yellow (50%) → green (100%) |
| `objMoveableEnergyBar` | Float-over-character wrapper: tracks a target, calculates a rect below the target's sprite, holds an `objEnergyBar` inside; coloured by team colour |
| `objExperienceBar` | Structurally identical to objEnergyBar but uses `expPnts`/`percentToNxt`; fixed yellow (rgb(244,216,11)) |
| `objMoveableExperienceBar` | Float-over-character wrapper for XP bar; only visible when `expPnts > 0` |
| `objMoveableLevelBar` | Float-over-character ABOVE target (above sprite + pGapY=4); draws a composite star-image: large=10 levels, medium=5 levels, tiny=1 level |
| `objSpellIcons` | Attaches to a live spell actor; shows which summon tier is queued (full vs half-blend = available vs unavailable) |

Runtime wiring: `characterEnergyRollOverMaster` owns one of each moveable bar and drives all three each update when the mouse hovers over a character. `objPlayerMerlinCharacter.init` creates its own `objMulticolourEnergyBar` bound to the `health_bar_surround` sprite (the player's persistent fixed HUD bar at the top of screen).

---

## Handler-by-Handler Analysis

---

### objEnergyBar

#### `on new` / `on init`
**Lingo (objEnergyBar.txt:17-60):** Establishes defaults: align=#left, barBorder=2, colour=white, orientation=#horizontal, layer=1. `init` reads all params, resolves `pSurroundRect` from a bound sprite if not given, creates a bar sprite via `initBarSpr`, sets colour, then calls `me.ID.bigMe.updateEnergy(pEnergy)` to draw the initial fill.

**Port:** No direct TS equivalent class. The player-HUD health bar is drawn imperatively in `drawHud` (main.ts:438-452); enemy/ally hover bars are in `drawEnemyBar` (main.ts:593-604). There is no `objEnergyBar` class instance in the port.

**Activation:** Called; both drawHud and drawEnemyBar are unconditionally invoked every render frame from `renderScene` (main.ts:382-387).

**Assessment:** The mapping is a structural replacement, not a gap per se—the port does draw health bars. Specific handler semantics below.

---

#### `on initBarSpr` (objEnergyBar.txt:62-77)
**Lingo:** Acquires a sprite, sets `locZ = pLayer` (default 1). Uses `dot_right` member for right-align and `dot_bottom` member for vertical orientation.

**Port:** No sprite pooling. The bar is drawn via `ctx.fillRect`. Z-order is determined by draw-call sequence (see §Draw-Order).

---

#### `on updateEnergy` (objEnergyBar.txt:142-158)
**Lingo:**
```lingo
percentEnergy = VarPercent(pEnergy, [0, pMaxEnergy])    -- energy as 0..100
barWidth = VarValRange(percentEnergy, [0, pMaxBarWidth]) -- scale to pixels
pBarSpr.width = barWidth  -- (horizontal case)
```
Fill is proportional. Bar shrinks LEFT→RIGHT for `#left` align (default); RIGHT→LEFT for `#right` align (uses `dot_right` member which pins the right edge). Vertical mode sets `pBarSpr.height`.

**Port — player bar (main.ts:443):**
```ts
ctx.fillRect(8, 8, 100 * hp, 6);  // hp = energyFrac() = energy/max
```
100px total width, fills left→right. Proportional — matches `#horizontal #left`. Width 100px is a fixed layout constant (no dynamic sprite).

**Port — enemy/ally bar (main.ts:603):**
```ts
ctx.fillRect(p.x - 10, p.y - 25, 20 * frac, 2);  // 20px total
```
20px total width, fills left→right. Proportional — matches orientation/direction.

**Parity:** Fill direction (#left, proportional to fraction) matches for both bars. Pixel dimensions differ from the original layout but layout fidelity is not a hard gameplay requirement.

---

#### `on reset` / `on resetToZero` (objEnergyBar.txt:79-88)
**Lingo:** `reset(currentEnergy, maxEnergy, colour)` — sets new max/colour and calls updateEnergy. `resetToZero` snaps to 0.

**Port:** No explicit reset path; the bar is recomputed from `energyFrac()` every frame. Functionally equivalent.

---

#### `on setColour` / `on setMaxEnergy` / `on setSurroundRect` / `on setSurroundSpr` (objEnergyBar.txt:106-121)
**Lingo:** Simple property setters used by callers (MoveableEnergyBar, PlayerMerlinCharacter).

**Port:** Not applicable — no property state; colour is set at draw time.

---

#### `on updateBarOnSurround` (objEnergyBar.txt:123-140)
**Lingo:** Insets the bar rect by `pBarBorder` pixels inside the surround rect, then copies the locZ from the surround sprite +1. Called every time the float-over surround rect moves.

**Port:** Not applicable (no sprite pooling; no surround-sprite system). The enemy bar at `p.y - 25` is effectively a fixed offset above the entity position computed per frame.

---

#### `on finish` (objEnergyBar.txt:92-100)
**Lingo:** Returns bar sprite to sprite pool; clears `pSurroundSpr`.

**Port:** Not applicable (no sprite pool).

---

#### `on getCurrentEnergyPercent` (objEnergyBar.txt:102-104)
**Lingo:** Returns `pCurrentEnergyPercent` (0–100) set by `updateEnergy`.

**Port:** `Energy.energyFrac()` (combat.ts:111) returns 0–1 fraction. Multicolour logic below reads this.

---

### objMulticolourEnergyBar

#### `on new` (objMulticolourEnergyBar.txt:9-17)
**Lingo:** Defaults `colourRange = [rgb(255,0,0), rgb(255,255,0), rgb(0,200,0)]` — three stops from red (0%) through yellow (50%) to green (100%).

#### `on setColourRange` (objMulticolourEnergyBar.txt:25-29)
**Lingo:** `pNumRanges = count - 1 = 2`, `pRangePercent = 100 / 2 = 50`.

#### `on updateEnergy` (objMulticolourEnergyBar.txt:31-47)
**Lingo — colour selection:**
```lingo
colRange = VarFloor(energyPercent / 50) + 1   -- 1 or 2 (or 3 when 100%)
colPercent = VarFloor(energyPercent) mod 50 * 2
if colRange = 3 then
  newColour = pColourRange[3]                  -- exactly green at 100%
else
  newColour = VarColRange(colPercent, pColourRange[colRange], pColourRange[colRange+1])
end if
```
So:
- 0%–<50%: interpolate red → yellow (colRange=1)
- 50%–<100%: interpolate yellow → green (colRange=2)
- 100%: lock to green (colRange=3)

**Context:** This is the **player's own main HUD health bar**. `objPlayerMerlinCharacter.init` (objPlayerMerlinCharacter.txt:60) requests `#objMulticolourEnergyBar`. On every `energyChanged` (objPlayerMerlinCharacter.txt:106), it calls `pEnergyBar.updateEnergy(me.pEnergy)` which re-evaluates the colour.

**Port — player health bar colour (main.ts:443):**
```ts
ctx.fillStyle = hp > 0.3 ? "#3c9" : "#e44";
```
Binary threshold at 30%: teal above, red at or below. No yellow intermediate. No smooth gradient. Threshold diverges from the original 50% mid-point.

**GAP — Semantic: The original player health bar is a smooth red→yellow→green gradient. The port is binary green/red at the wrong threshold (30%, not 50%). The yellow band (50%–30% range) is entirely missing.**

**Missing test:** No test asserts the colour of the player health bar at different health percentages. The bar's pixel colour is not verified — it could be the wrong hue at every health level and CI would not detect it.

---

#### `on init` (objMulticolourEnergyBar.txt:19-23)
**Lingo:** `setColourRange` called BEFORE `ancestor.init` so the colour range is in place when `init` calls `updateEnergy` for the initial draw.

**Port:** Not applicable (no object lifecycle).

---

### objMoveableEnergyBar

**Role:** The per-character hover health bar shown when the mouse rolls over a character. Driven by `characterEnergyRollOverMaster`. Uses team colour (e.g. the player-team's colour for allies, enemy-team colour for enemies).

#### `on setTarget` (objMoveableEnergyBar.txt:75-83)
**Lingo:** Acquires `targetTeamColour` from `g.teamMaster.getTeamColour(pTarget.getTeam())` and calls `pEnergyBar.reset(energy, maxEnergy, teamColour)`. The bar is plain `objEnergyBar` — NOT multicolour — coloured by team.

#### `on update` (objMoveableEnergyBar.txt:91-99)
**Lingo:** Each game tick: if target alive → `displayTargetEnergy()` → `calcSurroundRect()` (uses `pTarget.calcEnergyRectBottom()` + pSurroundHeight=4 offset) → `setSpriteRect` → `updateEnergyBar` (current energy from `pTarget.getEnergy()`).

#### `on targetDead` (objMoveableEnergyBar.txt:85-89)
**Lingo:** Clears pTarget, calls `finishEnergyBar()` and moves bar off-screen.

**Port:** No hover health bar system. The `drawEnemyBar` (main.ts:593-604) draws bars on ALL visible enemies/allies unconditionally every frame, not only on mouse-hover. It uses a fixed team colour (`"#e44"` for enemies, `"#4d6"` for allies) rather than the team master's colour.

**KNOWN CATALOGUED GAP (gCharacterEnergyRolloverOn=1):** The per-character hover UI is documented in `_findings.md` as a catalogued gap. Note as required but not re-litigated here.

**Additional observation (not catalogued):** The port's `drawEnemyBar` shows bars on ALL non-dead enemies and allies every frame regardless of mouse position. This is behaviorally different from the original (bars only on hover) but since `gCharacterEnergyRolloverOn` gap is already logged, this is part of the same gap.

**Z-order:** Original bar drawn at `gGameEnergyBarLayer=170` (above map=1, objects=50, bullets=75, player=99, boundary=150; below menus=190). Port's `drawEnemyBar` is called after `drawSprites` (actor sprites) and before `drawHud` (main.ts:382-387), so the enemy bar is effectively above actors but under the player's HUD. This preserves the intended occlusion relationship (bar above the character, player HUD on top).

---

### objExperienceBar

#### `on new` (objExperienceBar.txt:35-65)
**Lingo:** colour defaults to `rgb(244,216,11)` (yellow). Note: `init` also hard-codes `pColour = rgb(244,216,11)` (line 111) and calls `setColour(pColour)`, ignoring the `params.colour` passed in (the `reset` path also comments out `setColour`). So the XP bar is ALWAYS yellow regardless of team.

#### `on updateExp` (objExperienceBar.txt:319-351) — the active path
**Lingo:**
```lingo
on updateExp me, levelData
  barWidth = VarValRange(levelData.percentToNxt * 100, [0, pMaxBarWidth])
  pBarSpr.width = barWidth
  pCurrentExperiencePercent = levelData.percentToNxt
end
```
`percentToNxt` is the fraction of the way to the NEXT level (0–1). The bar fills proportionally.

#### `on updateExperience` (objExperienceBar.txt:283-315) — legacy path
**Lingo:** Uses raw `pExperience / pMaxExperience` via `VarPercent`. The `updateExp` variant above is what `objMoveableExperienceBar.updateExperienceBar` calls (uses `levelData.percentToNxt`).

**Port — player XP bar (main.ts:445):**
```ts
ctx.fillRect(8, 18, 100 * Math.min(1, xp.frac()), 4);
```
`xp.frac()` is `(this.xp - this.lastThreshold) / span` (experience.ts:43). This is the fraction within the current level band — identical semantics to `percentToNxt`. Fixed yellow (`"#fc4"`). The `Math.min(1, ...)` clamp handles the level-up instant (brief overfill before threshold advances).

**Parity:** Player XP bar formula matches `percentToNxt`. Colour #fc4 (yellow) matches rgb(244,216,11). **CLEAN.**

**Player XP bar is not one of the moveable/rollover bars — it is the player's own fixed HUD bar drawn in `drawHud`.**

---

### objMoveableExperienceBar

**Role:** Hover XP bar for arbitrary characters shown by `characterEnergyRollOverMaster`, positioned 3px below the hover energy bar (`calcSurroundRect` adds +3 to top/bottom vs the energy bar's rect).

#### `on displayTargetExperience` (objMoveableExperienceBar.txt:105-123)
**Lingo:** Shows bar ONLY when `pTarget.getExperienceData().expPnts > 0`. If expPnts=0, calls `clearTarget()`.

#### `on setTarget` (objMoveableExperienceBar.txt:157-178)
**Lingo:** Initialises bar only if `expToNxtLvl > 0 AND expPnts > 0`; otherwise calls `clearTarget()`.

**Port:** No implementation. Part of the catalogued `gCharacterEnergyRolloverOn` gap.

---

### objMoveableLevelBar

**Role:** Star display ABOVE a character (not below like the energy/XP bars). Positioned above the top of the target sprite (`targetLoc.locV - targetReg.locV - spr.height + spr.member.regPoint.locV - pGapY`). Rebuilt as a pixel image whenever the target levels up.

#### `on setTarget` (objMoveableLevelBar.txt:173-185)
**Lingo:** Subscribes to `#outOfEnergy`, `#leaveGame` (once each), and `#levelUp` (always). On `#levelUp`, calls `constructStarsImage()` to regenerate the star picture.

#### `on constructStarsImage` / `on drawStarsImage` / `on drawStarsInImage` / `on calcNumbersOfStars` (objMoveableLevelBar.txt:73-148)
**Lingo:** Computes star counts: `numLarge = level / 10`, `numMedium = leftOver / 5`, `numTiny = leftOver mod 5`. Draws them left→right into a fresh image (large stars first, then medium, then tiny). Uses pixel art members: `star_tiny`, `star_medium`, `star_large` from the `gfx` cast.

#### `on displayAboveTarget` (objMoveableLevelBar.txt:85-103)
**Lingo:** Positions sprite above the character, pegged to `gGameEnergyBarLayer=170`. Contains a kludge guard: `if spr.locz <> gGameEnergyBarLayer then spr.locz = gGameEnergyBarLayer` — explicitly forces z back after something external changes it.

#### `on update` (objMoveableLevelBar.txt:187-193)
**Lingo:** Calls `ancestor.update()` then `displayAboveTarget()` every tick.

**Port:** No star display. No `objMoveableLevelBar` equivalent in the port. Part of the catalogued `gCharacterEnergyRolloverOn` gap.

**Additional note on gGameEnergyBarLayer:** The global is set to 170 in `MovieScript 16 - main.lasm:87`. It is used as the locZ for all moveable bars (energy, XP, level). It sits above `gMapBoundaryLayer=150` and below `gMenuLayer=190`. The port has no layer constant for these bars — they are part of the catalogued gap, so no additional flag needed.

---

### objSpellIcons

#### `on new` (objSpellIcons.txt:11-23)
**Lingo:** Creates with `objAutoUpdate` ancestor, adds `modAnimSet`, `modFader`, `modSprite` modules. Defaults `spellStrip=#none`, `spellToAttachTo=#none`.

#### `on init` (objSpellIcons.txt:34-46)
**Lingo:** Sets `pUnitAvailableBlend=100` (opaque), `pUnitNotAvailableBlend=50` (half transparent). Calls `me.calcStart()` and `me.pauseAnim()` (still-frame from the spell's anim strip). Sets `locZ = pSpellToAttachTo.getLocZ() + 1` (just above the spell orb).

#### `on displayIconNumber` (objSpellIcons.txt:48-57)
**Lingo:** Seeks to a specific frame in the anim strip, advances one frame, sets blend to 100 (available) or 50 (unavailable). Called by `modSpellMultistage.displayIcon()` during charge.

#### `on explode` (objSpellIcons.txt:59-61)
**Lingo:** Starts `startQuickFade` when the spell explodes (icons fade out with the orb).

#### `on finishConditionMet` (objSpellIcons.txt:64-66)
**Lingo:** Always returns false — icons persist until `explode()` triggers a fade.

#### `on getAnimSym` (objSpellIcons.txt:68-70)
**Lingo:** Returns `pSpellStrip` (e.g. `#armySummon`), overriding the standard anim lookup so icons use the spell-specific frames.

#### `on update` (objSpellIcons.txt:72-79)
**Lingo:** Calls `ancestor.update()` then repositions the icon rect to match the spell actor's current rect/loc.

**Port:** No implementation. Explicitly acknowledged as OUT OF SCOPE in `modSpellMultistage.md` (handler #12: "displayIcon / ensureSpellIcons — OUT OF SCOPE per plan §g").

**Z-order:** Original icons sit at `pSpellToAttachTo.getLocZ() + 1` — directly above the spell orb. Port draws the spell orb via `drawSpells` (main.ts:519-536) with no icon overlay. Since icons are out of scope, no z-order gap to flag.

---

## Global / Initial-State Cross-Reference

| Global | Authoritative value (GameSpecific.ls or main.lasm) | Port |
|---|---|---|
| `gGameEnergyBarLayer` | 170 (main.lasm:87) | Not used (rollover gap) |
| `gCharacterEnergyRolloverOn` | 1 = ON (GameSpecific.ls:10) | Not implemented (catalogued) |
| `gEnemyEnergyMasterOn` | 0 = OFF (defaultGameGlobals:163) | Matches (no enemy-energy-master bars) |
| `gMapBoundaryLayer` | 150 (main.lasm:85) | Not used in HUD |
| Player bar default colour | white → overridden to multicolour (PlayerMerlinCharacter.txt:60) | Binary #3c9/#e44 |
| XP bar colour | rgb(244,216,11) hard-coded (objExperienceBar.txt:111) | #fc4 ≈ yellow ✓ |

---

## Draw-Order / Occlusion Analysis

**Original render stack (z-order):**
```
gMapLayer=1         background tiles
gGameObjectLayer=50 NPC/enemy sprites
gGameBulletLayer=75 bullets
gPlayerLayer=99     player sprite
gMapBoundaryLayer=150 foreground tiles (foreground passive)
gGameEnergyBarLayer=170 all hover bars (moveable energy/XP/level) + player HUD bar
gGameTextLayer=180  text overlays
gMenuLayer=190      menus
```

**Port render sequence (main.ts:363-399):**
```
drawTileLayer(passive)          ≈ gMapLayer
drawTileLayer(active)           ≈ gGameObjectLayer underlayer
drawSprites()                   actors (z-sorted by y position)
drawBullets()                   bullets
drawSpells()                    spell orbs
drawTileLayer(foreground, 0.5)  ≈ gMapBoundaryLayer (foreground passive)
drawExitArrows()                exits
drawEnemyBar()                  enemy/ally health bars   ← HERE
drawCharge()                    charge ring
drawHud()                       player HUD (health + XP bars)  ← HERE
drawMinimap()                   minimap
```

**Occlusion for player HUD bar:**
- Original: drawn at gGameEnergyBarLayer=170, above everything except text and menus.
- Port: `drawHud` is the LAST game-content draw call before minimap. Drawn AFTER the foreground tile layer (0.5 alpha), exit arrows, enemy bars. **Order correct** — player HUD bar is above the world, not occluded.

**Occlusion for enemy bars:**
- Original (hover system): drawn at gGameEnergyBarLayer=170, so bars are above the foreground tile layer.
- Port: `drawEnemyBar` called after `drawTileLayer(foreground)` — same relative order. **Order correct.**

**Occlusion gap:** None detected. Both player HUD bar and enemy bars are drawn above the world layers in the port. The moveable level/XP/energy rollover bars are not ported (catalogued gap) so their z-order cannot be verified.

---

## Missing-Test Detection

| Observable signal | Test exists? | Notes |
|---|---|---|
| Player health bar fills proportionally | No dedicated test | main.ts:443 reachable via render path; proportion formula `100 * hp` correct |
| **Player health bar colour transitions red→yellow→green** | **NO TEST** | Binary #3c9/#e44 drawn, no test asserts colour at 60%, 40%, 20% health — a broken or wrong threshold is invisible to CI |
| Player XP bar fills proportionally | No dedicated test | Formula `100 * Math.min(1, xp.frac())` matches Lingo percentToNxt |
| Player XP bar colour (yellow) | No dedicated test | #fc4 visually correct; non-critical |
| Enemy bar fills and positioned above entity | No dedicated test | drawEnemyBar reachable; no pixel assertion |
| Hover bars (rollover) appear on mouse-over | No test | Entire feature missing (catalogued gap) |
| Star display above character on level-up | No test | Entire feature missing (catalogued gap) |
| Spell icon blend (available/unavailable) | No test | Entire feature out of scope |

---

## Findings Summary

### GAP 1 — Player health bar: wrong colour model (semantic)
**File:** `port/src/main.ts:443`
**Original:** `objMulticolourEnergyBar.updateEnergy` → smooth interpolation red(0%)→yellow(50%)→green(100%) via `VarColRange`. Three-stop gradient; the colour changes continuously as health changes.
**Port:** Binary threshold `hp > 0.3 ? "#3c9" : "#e44"`. No yellow. Threshold at 30% not 50%.
**Impact:** Player-visible. The yellow warning band (30%–50% health) is never shown. The colour change fires too late (at 30%, not 50%). A player relying on colour to judge health safety gets wrong information.
**Source (Lingo):** `objMulticolourEnergyBar.txt:31-47`, `objPlayerMerlinCharacter.txt:60`
**Source (TS):** `port/src/main.ts:443`
**Missing test:** No test checks the player HUD's rendered colour at different health fractions.

**FIXED (2026-06-21):** Extracted `healthBarColour()` to `port/src/render/healthBar.ts` — a faithful port of `objMulticolourEnergyBar.updateEnergy` + `VarColRange`: the whole bar is one colour sliding red(0%)→yellow(50%)→green(100%), linear within each half (stops rgb(255,0,0)/(255,255,0)/(0,200,0)). `drawHud` now calls it (`main.ts:443`). Covered by `port/test/health_bar.test.ts` (anchors at the three stops, interpolates within each half, and explicitly guards against the old binary-at-30% regression).

### GAP 2 — Rollover bars (energy + XP + level stars) not ported
**Files:** `objMoveableEnergyBar.txt`, `objMoveableExperienceBar.txt`, `objMoveableLevelBar.txt`
**Status:** ALREADY CATALOGUED in `_findings.md` under "gCharacterEnergyRolloverOn=1". Noting here for completeness per audit scope.
**Impact:** When mouse hovers over an enemy or ally, no health/XP/level display appears. gCharacterEnergyRolloverOn=1 in GameSpecific — this is ON in the real game.

### GAP 3 — Spell icons not ported (out of scope)
**File:** `objSpellIcons.txt`
**Status:** Explicitly out of scope per `modSpellMultistage.md` §12. No change to status.
**Impact:** During multistage spell charging (armySummon), no icon shows which unit tier is queued. The "available vs unavailable" (50% vs 100% blend) visual feedback is absent.

### CLEAN — Player XP bar
Player XP bar formula (`Experience.frac()`) matches Lingo `percentToNxt`. Colour #fc4 ≈ rgb(244,216,11). Fill is proportional and left-anchored. **CLEAN.**

### CLEAN — Draw order / occlusion
Player HUD and enemy bars are both drawn above the world layers in the port. Z-order relationship preserved. **CLEAN.**

### CLEAN — Enemy/ally health bar fill
`drawEnemyBar` fills left-to-right proportional to `energyFrac()`. Direction and proportion match Lingo `objEnergyBar.updateEnergy` (#horizontal #left). **CLEAN.**

---
