# Rendering Fidelity Audit

**Scope:** Every draw call in `port/src/main.ts` and `port/src/render/*.ts` compared to the
original Shockwave/Lingo game in `casts/` and `extracted/engine/scripts/`.

**Goal:** 100% visual parity. Three previously-fixed gaps are explicitly excluded:
- (a) bullets now use the real `<char>_fly` strip rotated to flight angle
- (b) spells now use the tinted/scaled `spell_charge` sprite
- (c) room exits now confined to the bilateral doorway only

**Layer reference** (MovieScript 16 - main.lasm globals):

| Layer name              | z value |
|------------------------|---------|
| gMapLayer              | 1       |
| gMineLayer             | 25      |
| gGameObjectLayer       | 50      |
| gGameBulletLayer       | 75      |
| gPlayerLayer           | 99      |
| gMapBoundaryLayer      | 150     |
| gGameEnergyBarLayer    | 170     |
| gGameTextLayer         | 180     |
| gMenuLayer             | 190     |
| gMenuTextLayer         | 200     |
| gCutSceneSpeechLayer   | 210     |
| gGlobalDisplayLayer    | 220     |
| gPaletteLayer          | 240     |

---

## WHY THE PRIOR SWEEP MISSED THESE

The prior 6-lens sweep audited per-Lingo-object logic (components, AI, combat math) but never
opened the rendering pipeline files. Rendering is concentrated in:
- `port/src/main.ts` (the game loop's draw block, lines ~374-420 + standalone draw functions)
- `port/src/render/*.ts` (minimap, rollover, effects, healthBar, screens)

None of those files contain game-logic components, so the component-by-component sweep never
reached them. Additionally, some gaps are invisible to grep for "Anim" or "sprite" because the
port replaced real art with procedural canvas primitives — there are no broken imports to flag.

---

## GAP 1 — Pickups: diamond polygon instead of real pickup sprites

**Severity:** CRITICAL (visible on every map, first room)

### Port's current draw

`port/src/main.ts:494-507` (`drawPickups`):

```typescript
ctx.beginPath(); // diamond
ctx.moveTo(m.x, m.y - 5); ctx.lineTo(m.x + 5, m.y);
ctx.lineTo(m.x, m.y + 5); ctx.lineTo(m.x - 5, m.y);
ctx.closePath(); ctx.fill();
```

A colored blinking diamond is drawn for every pickup type. Color is keyed from a static
`PICKUP_COLOR` dict (e.g. `heal:#3d6`, `sword:#fe8`). Blinking is a 250 ms `Date.now()` toggle.

### Original render

`casts/data/act_powerUp.txt` (base), `act_medikit.txt`, `act_walkSpeed.txt`, `act_healBlast.txt`,
`act_manaBurst.txt`, `act_manaCapacity.txt`, `act_manaFlow.txt`:

Each pickup actor has two render fields:
- `#member: member("walkSpeed_potion", "gfx")` — the **idle static bitmap** rendered as a
  `#sprite` channel (Director `#member` type). This is the normal visual.
- `#character: #walkSpeed` (etc.) — an animated strip that plays when the pickup is "animating"
  (collected or a brief flash). The character name is the same as the effect key.

`casts/script_objects/objPowerUpWriting.txt`, `objPotion.txt`, `objScroll.txt`, `objMedikit.txt`
handle display via the sprite master. The _idle_ sprite is the `#member` bitmap; blinking is
handled by `startTempInvince` / `flickWhite` at spawn time (not a raw alpha toggle).

`casts/script_objects/modMedikit.txt` handles the medikit specifically: same pattern, `#member:
member("medikit_on", "gfx")`.

### Art bundled in assets.json?

| Actor / char   | assets.json key              | Present? |
|---------------|------------------------------|----------|
| medikit        | `medikit_stand` etc.         | NO       |
| walkSpeed      | `walkSpeed_stand` etc.       | NO       |
| healBlast      | `healBlast_stand` etc.       | NO       |
| manaBurst      | `manaBurst_stand` etc.       | NO       |
| manaCapacity   | `manaCapacity_stand` etc.    | NO       |
| manaFlow       | `manaFlow_stand` etc.        | NO       |
| sword          | `merlinSword_stand` (exists) | YES      |
| spell (basic)  | `spell_charge` (exists)      | YES (orb)|

The static `#member` bitmaps (e.g. `walkSpeed_potion.png`) exist under
`extracted/engine/bitmaps/` but are NOT imported into `assets.json`.

### Root cause

`PickupArchetype` (`port/src/entities/archetypes.ts:65`) creates entities with only
`[Identity, Pickup, Movement]` — no `Anim` component. The entity never enters the
`sprites = game.entities.filter(...).map(e => e.get(Anim).sprite())` path. `drawPickups` is a
separate hand-written fallback that only knows about the diamond polygon.

### Fix sketch

1. Add `Anim` to `PickupArchetype` with `animChar` set to the pickup's effect key (e.g.
   `"medikit"`, `"walkSpeed"`) or a fallback (`"merlinSword"` for `"sword"`, `"spell"` for
   spell scrolls).
2. Import and include the per-pickup char art in `assets.json` (builder pass or manual addition
   for the `_stand` strip of each pickup type).
3. Remove `drawPickups` from `main.ts` — the `Anim`-based `drawSprites` path will handle it.
4. Wire `isFinished` → entity removal (already done via `collected` flag) so the sprite vanishes
   on collection.

---

## GAP 2 — Freeze overlay: extra blue rectangle duplicates ColourTransform tint

**Severity:** HIGH (wrong visual on any frozen enemy)

### Port's current draw

`port/src/main.ts:396-401`:

```typescript
for (const e of game.entities) {
  if ((e.type === "enemy" || e.type === "ally") && !e.send("isDead") && e.send("isFrozen")) {
    const p = e.send("getPos") as { x: number; y: number };
    renderer.ctx.fillStyle = "rgba(80,220,255,0.35)";
    renderer.ctx.fillRect(p.x - 9, p.y - 20, 18, 22);
  }
}
```

A 35%-opacity blue rectangle is drawn over every frozen entity after the sprites are composited.

### Original render

`casts/script_objects/modFreeze.txt` (freeze component):

```
me.big.glowTeal()
pGlowTeal = true
```

The freeze visual is a **ColourTransform tint** — `glowTeal()` (cyan/teal palette shift) applied
to the entity's own sprite via `modColourTransform`. No separate overlay object exists. The freeze
is invisible except via the sprite colour.

### Port already handles this correctly

`port/src/components/freeze.ts` calls `this.entity.tryGet(ColourTransform)?.glowTeal()` on first
freeze, which correctly activates the teal palette tween in `ColourTransform`. The `Anim.sprite()`
method reads `ColourTransform.getColourTransform()` and passes `tint` to the renderer.

The rectangle in `main.ts` is therefore a **duplicate** — it adds a box over an already-tinted
sprite, making frozen enemies look like they have a blue halo block rather than a tinted body.

### Fix sketch

Delete lines 396-402 from `port/src/main.ts`. No other change needed — `ColourTransform` already
carries the freeze visual.

---

## GAP 3 — HUD health bar: procedural bars instead of health_bar_surround sprite

**Severity:** HIGH (HUD is always visible during play)

### Port's current draw

`port/src/main.ts:459-473` (`drawHud`):

```typescript
ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(6, 6, 104, 24);  // black bg
ctx.fillStyle = healthBarColour(hp); ctx.fillRect(8, 8, 100 * hp, 6);  // health bar
ctx.fillStyle = "#fc4"; ctx.fillRect(8, 18, 100 * Math.min(1, xp.frac()), 4);  // xp bar
```

A plain dark rectangle is the HUD frame; colored fill-rects represent HP and XP.

### Original render

`casts/script_objects/objPlayerCharacter.txt`:

```
surroundSpr = g.spriteMaster.getSpriteWithMember(member("health_bar_surround", "gfx"))
```

The HUD frame is a dedicated **bitmap member** `health_bar_surround` that is composited as a
sprite over the health fill bar. The bar itself is `objMulticolourEnergyBar` (whose color model
the port correctly implements in `port/src/render/healthBar.ts`), but it sits inside this
surround sprite, not a plain black rect.

### Art bundled in assets.json?

`extracted/engine/bitmaps/health_bar_surroundD.png` exists but is **NOT** in `assets.json`.

### Fix sketch

1. Add `health_bar_surround` as a static image entry in `assets.json`.
2. In `drawHud`, after drawing the fill bar, draw the surround bitmap at the correct HUD anchor
   position (determine offset from the surround bitmap's dimensions vs. the fill bar rect).
3. The fill bar color logic (`healthBarColour`) is already correct — no change there.

---

## GAP 4 — HUD: medikit count and extra lives display entirely missing

**Severity:** HIGH (core HUD elements absent)

### Port's current draw

`port/src/main.ts:459-473` (`drawHud`): No medikit count, no extra lives display of any kind.

### Original render

**Medikit count** — `casts/script_objects/medikitMaster.txt`:

```
params.offMember = member("medikit_off", "gfx")
params.onMember  = member("medikit_on", "gfx")
```

`objMedikitDisplayer` renders a row of medikit icon sprites (on/off) representing the player's
banked kit count. Typically up to 3 icons, filled left-to-right. Uses bitmap members
`medikit_on` and `medikit_off`. Position is at `gGameEnergyBarLayer` (z=170).

**Extra lives count** — `casts/script_objects/modExtraLives.txt`:

```
pExtraLivesTextMember = member("extraLives_text", "gfx")
```

A text-sprite displaying the remaining extra-lives count. Rendered at `gGameEnergyBarLayer`.

### Art bundled in assets.json?

| Member           | extracted/engine/bitmaps/ | assets.json |
|-----------------|--------------------------|-------------|
| medikit_on       | medikit_onD.png  YES     | NO          |
| medikit_off      | medikit_offD.png YES     | NO          |
| extraLives_text  | NOT FOUND                | NO          |

### Fix sketch

1. Add `medikit_on` and `medikit_off` bitmaps to `assets.json`.
2. In `drawHud`, read `game.player.send("getMedikitCount")` (or equivalent from `Medikit`
   component) and render a row of medikit icons using the on/off bitmaps.
3. Add `extraLives_text` if the bitmap is found; otherwise render a plain text counter for extra
   lives alongside the medikit row.
4. Position both at the correct HUD anchor (inspect `objMedikitDisplayer` init for x/y offsets
   relative to the health bar).

---

## GAP 5 — Minimap: solid colors instead of real 4×4 bitmap tiles

**Severity:** MEDIUM (visible only in nav mode, but clearly wrong art)

### Port's current draw

`port/src/render/minimap.ts` (`drawMinimap`): A `STATUS_COLOR` dict maps room state to plain CSS
hex colors (e.g. infested → `"#c33"`, cleared → `"#363"`). Each room cell is a solid-color
`fillRect`.

### Original render

`casts/script_objects/modMiniMap.txt`:

```
miniInfested  = member("miniInfested",  "gfx")   -- red-flecked 4×4 bitmap
miniCurrent   = member("miniCurrent",   "gfx")   -- highlighted 4×4 bitmap
miniClear     = member("miniClear",     "gfx")   -- green 4×4 bitmap
miniSpecial   = member("miniSpecial",   "gfx")   -- special-room 4×4 bitmap
miniFriendlyD = member("miniFriendlyD", "gfx")   -- friendly-dwelling 4×4 bitmap
```

Each cell is drawn by blitting the matching 4×4 bitmap tile, not a filled rectangle. The tiles
carry internal pixel detail (e.g. miniInfested has a textured red pattern rather than a solid
fill).

### Art bundled in assets.json?

All five bitmaps exist under `extracted/engine/bitmaps/` as
`miniInfestedD.png`, `miniCurrentD.png`, `miniClearD.png`, `miniSpecialD.png`,
`miniFriendlyDD.png` but **none** are in `assets.json`.

### Fix sketch

1. Add the five mini-map bitmaps to `assets.json` as static images.
2. In `drawMinimap`, replace `ctx.fillStyle = STATUS_COLOR[...]` + `fillRect` with
   `ctx.drawImage(assets.img("miniInfested"), ...)` etc., tiling or stretching each 4×4 bitmap
   to the cell width/height.

---

## GAP 6 — Rollover level display: pixel squares instead of star bitmaps

**Severity:** MEDIUM (visible on mouse-hover over any character)

### Port's current draw

`port/src/render/rollover.ts:40`:

```typescript
ctx.fillStyle = "#fc4";
for (let i = 0; i < Math.min(lvl, 8); i++) ctx.fillRect(bx + i * 3, by + 4, 2, 2);
```

Up to 8 yellow 2×2 pixel squares represent the character's level.

### Original render

`casts/script_objects/objMoveableLevelBar.txt`:

```
member("star_tiny",   "gfx")   -- small star pip
member("star_medium", "gfx")   -- medium star pip
member("star_large",  "gfx")   -- large star pip
```

Level is shown as a row of star pip bitmaps. Size varies by level bracket (tiny/medium/large).
The rollover bar composites these star members rather than drawing rectangles.

### Art bundled in assets.json?

| Member        | extracted/engine/bitmaps/    | assets.json |
|--------------|------------------------------|-------------|
| star_tiny     | star_tinyD.png  YES          | NO          |
| star_medium   | star_mediumD.png YES         | NO          |
| star_large    | star_largeD.png YES          | NO          |

### Fix sketch

1. Add `star_tiny`, `star_medium`, `star_large` to `assets.json`.
2. In `rollover.ts` `drawHealthRollover`, replace the `fillRect` loop with star bitmap draws.
   Inspect `objMoveableLevelBar` for which size is used at which level bracket (e.g. levels 1-3
   use tiny, 4-6 medium, 7+ large — or a mixed row). Match the spacing to the original 24px-wide
   bar.

---

## GAP 7 — dwarfAxe bullet: wrong bulletChar key ("dwarfAxe" vs "axe")

**Severity:** MEDIUM (dwarfAxe enemies fire invisible bullets in the port)

### Port's current behavior

`port/src/entities/archetypes.ts:263`:

```typescript
bulletChar = atk["bullet"].replace(/^#/, "");
// atk["bullet"] = "#dwarfAxe" -> bulletChar = "dwarfAxe"
```

The bullet actor's **key name** is used as the char. The port then looks for `dwarfAxe_fly` in
`assets.json`, which does not exist, so bullets from dwarfAxe enemies render as the dot fallback.

### Original render

`casts/data/act_dwarfAxe.txt`:

```
#character: #bullet
#name: "axe"
```

The bullet's `#name` field is `"axe"`, not `"dwarfAxe"`. The `modAnimSet` system uses `#name`
as the sprite character, so the fly strip is `axe_fly` — which **IS** present in `assets.json`.

### Fix sketch

In `archetypes.ts` line 263-264, after resolving `bulletActor`, read the `#name` field:

```typescript
bulletChar = atk["bullet"].replace(/^#/, "");       // actor key, e.g. "dwarfAxe"
const bulletActor = registry.resolveActor(bulletChar);
const nameOverride = typeof bulletActor?.["name"] === "string" ? bulletActor["name"] : null;
if (nameOverride) bulletChar = nameOverride;        // prefer #name: "axe"
```

This brings dwarfAxe bullets to `axe_fly` and would fix any other actor that similarly carries a
`#name` different from its key.

---

## GAP 8 — Draw order: pickups rendered after bullets/spells, should be z-sorted with actors

**Severity:** MEDIUM (pickups appear in front of all projectiles)

### Port's current draw order

`port/src/main.ts:383-389`:

```typescript
const sprites = game.entities
  .filter((e) => e.type !== "bullet" && e.type !== "pickup" && e.type !== "marker" && e.type !== "spell")
  .map((e) => e.get(Anim).sprite())...;
renderer.drawSprites(sprites);    // actors at gGameObjectLayer=50
drawBullets(renderer);            // bullets at gGameBulletLayer=75
drawSpells(renderer);             // spells at gGameBulletLayer=75
drawPickups(renderer);            // pickups LAST — effectively z=∞
```

Pickups draw after `drawBullets` and `drawSpells`, so they appear in front of all projectiles.

### Original render

Layer constants from `MovieScript 16 - main.lasm`:
- `gGameObjectLayer = 50` — actors and pickups
- `gGameBulletLayer = 75` — bullets and spells

`casts/script_objects/objPowerUpWriting.txt` (the pickup base class) uses `gGameObjectLayer=50`,
the same layer as enemies and allies. Pickups should be z-sorted **with** the actor band, NOT
after the bullet/spell band.

### Fix sketch

Once Anim is added to `PickupArchetype` (Gap 1 fix), pickups will enter `drawSprites` naturally
along with all other `gGameObjectLayer` entities. The explicit `drawPickups` call and its filter
exclusion in the entity map are both removed.

---

## GAP 9 — Title screen: procedural text instead of real background art

**Severity:** LOW-MEDIUM (first visible screen)

### Port's current draw

`port/src/main.ts:444-454` (`drawTitle`):

```typescript
ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, w, h);
ctx.fillStyle = "#fc4"; ctx.font = "bold 26px serif";
ctx.fillText("MERLIN'S REVENGE", w / 2, h / 2 - 48);
```

Dark blue rectangle with a serif text title and small monospace controls hint.

### Original render

The original title screen uses a full background bitmap and layered alpha overlays:
- `extracted/engine/bitmaps/background.png` — main title background
- `extracted/engine/bitmaps/backgroundAlpha01.png` — first overlay
- `extracted/engine/bitmaps/backgroundAlpha02.png` — second overlay

These are composited as Director sprite channels at `gGlobalDisplayLayer` (z=220).

### Art bundled in assets.json?

`background.png`, `backgroundAlpha01.png`, `backgroundAlpha02.png` exist in
`extracted/engine/bitmaps/` but are **NOT** in `assets.json`.

### Fix sketch

1. Add the three background bitmaps to `assets.json` as static images.
2. In `drawTitle`, replace the `fillStyle`/`fillRect` block with `ctx.drawImage` for each layer
   in order (background → alpha01 → alpha02), scaled to fill the canvas.
3. Keep the controls-hint text overlay; remove only the procedural dark rect + title text.

---

## GAP 10 — Charge meter: arc() ring added by port, no original equivalent

**Severity:** LOW (extra UI element that shouldn't exist)

### Port's current draw

`port/src/main.ts:476-488` (`drawCharge`):

```typescript
ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();        // outer ring
ctx.beginPath(); ctx.arc(x, y, 9, -Math.PI/2, -Math.PI/2 + frac*Math.PI*2); ctx.stroke(); // progress arc
```

Two concentric arcs at the cursor position indicate charge progress (0 → full sweep).

### Original render

The original charge feedback is the `spell_charge` orb itself — `updateSize` scales the orb's
width/height proportionally to `charge * chargeSize`. The growing orb at `chargeLoc` IS the
charge meter. No separate ring overlay exists in the original.

The `drawSpells` function in the port already renders the growing `spell_charge` orb (the fixed
spell rendering from the prior sweep). The arc ring is a port-only addition that overlaps with the
actual orb, creating a double-indicator that doesn't match the original.

### Fix sketch

Delete the `drawCharge` function body (or the entire function) from `port/src/main.ts` and remove
its call at line 404. The `spell_charge` orb at the cursor already provides the charge feedback.

---

## GAP 11 — goblinArrow / fangBunnyBabyBullet: no fly sprite in original or port

**Severity:** LOW (minor actors, no art in source)

### Port's current behavior

`bulletChar` for `goblinArrow` and `fangBunnyBabyBullet` is set to those actor keys. No
`goblinArrow_fly` or `fangBunnyBabyBullet_fly` strip exists in `assets.json`, nor is any fly
bitmap found under `extracted/engine/bitmaps/`. These bullets render as dots (no art).

### Original render

No `extracted/engine/bitmaps/goblinArrow*.png` or `fangBunnyBabyBullet*.png` were located. The
original likely also rendered these as simple Director line/point sprites or used a generic bullet
shape — the absence of art in `extracted/` suggests this is faithful by omission rather than a gap.

### Fix sketch

No action required — this appears to match the original's behavior. If evidence of real art for
these bullets is found in a later asset extraction pass, add it then.

---

## Summary table

| # | Gap title                          | Severity    | Art missing from assets.json? |
|---|-----------------------------------|-------------|-------------------------------|
| 1 | Pickups: diamond polygon vs sprites | CRITICAL   | YES (medikit, walkSpeed, healBlast, manaCapacity, manaFlow, manaBurst) |
| 2 | Freeze overlay: extra blue rect     | HIGH       | N/A (no art needed — remove rect) |
| 3 | HUD: missing health_bar_surround    | HIGH       | YES (health_bar_surround) |
| 4 | HUD: missing medikit/extra-lives    | HIGH       | YES (medikit_on, medikit_off; extraLives_text not found) |
| 5 | Minimap: solid colors vs bitmaps    | MEDIUM     | YES (miniInfested, miniCurrent, miniClear, miniSpecial, miniFriendlyD) |
| 6 | Rollover level: squares vs stars    | MEDIUM     | YES (star_tiny, star_medium, star_large) |
| 7 | dwarfAxe bullet: wrong char key     | MEDIUM     | NO (axe_fly already present) |
| 8 | Draw order: pickups after bullets   | MEDIUM     | N/A (resolved by Gap 1 fix) |
| 9 | Title screen: procedural vs art     | LOW-MEDIUM | YES (background, backgroundAlpha01/02) |
|10 | Charge meter: arc ring not original | LOW       | N/A (no art — remove code) |
|11 | goblinArrow/fangBunny: no fly art   | LOW        | N/A (no original art either) |

RENDERING AUDIT | GAPS=11
