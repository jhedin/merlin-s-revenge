# SS-2 — Health bar (RE-OPENED) — AUDIT + PLAN

Re-verified by tracing every health/energy-bar draw path in both trees. The prior pass's
"swapped to the real `health_bar_surround` member" claim is **literally true but functionally
broken**: the real surround bitmap *is* blitted, but in the wrong z-order, so it paints over the
coloured fill. The bar therefore renders as a flat opaque-white box — exactly the "unfaithful"
symptom the user reports.

---

## SECTION 1 — Original (how the bar really works)

In this engine the "health" bar is an **energy bar**. Two distinct families/paths:

### A. Player HUD bar — `objPlayerCharacter` + `objEnergyBar`
`casts/script_objects/objPlayerCharacter.txt:49-57`

```
pEnergyBar = g.objectMaster.requestObject(#objEnergyBar)
surroundSpr = g.spriteMaster.getSpriteWithMember(member("health_bar_surround", "gfx"))
surroundRect = surroundSpr.rect.duplicate()
params.surroundSpr = surroundSpr
params.surroundRect = surroundRect
params.maxEnergy / currentEnergy = me.pEnergy
pEnergyBar.init(params)
```

`objEnergyBar` (`casts/script_objects/objEnergyBar.txt`):
- **Surround** = the real member `health_bar_surround` (`extracted/.../00254_health_bar_surround_D2.png`,
  **100×14**), blitted as a sprite.
- **Fill** = a separate sprite whose member is a **1×1 solid dot** stretched to a rect:
  - `initBarSpr` (`:62-77`): default member is the implicit horizontal dot; `dot_right`
    (`extracted/.../00346_dot_right.png`, **1×1**) for right-align, `dot_bottom`
    (`extracted/.../04416_dot_bottom.png`, **1×1**) for vertical. It is a SOLID COLOUR sprite,
    **not** a multi-frame sheet and **not** frame-indexed.
  - `updateBarOnSurround` (`:123-140`): `barRect = pSurroundRect.inflate(-barBorder, -barBorder)`
    (HUD `barBorder = 2`); `pBarSpr.rect = barRect`; **`pBarSpr.locZ = pSurroundSpr.locZ + 1`**
    → the fill is on a HIGHER layer, drawn **on top of** the surround, inset by the border.
  - `updateEnergy` (`:142-158`): `percent = VarPercent(pEnergy,[0,maxEnergy])`;
    `barWidth = VarValRange(percent,[0,pMaxBarWidth])`; `pBarSpr.width = barWidth`.
    → **the fill is a colour rect whose WIDTH is clipped to the energy %** (left-anchored).
- **Colour** = HUD player bar is the multicolour model. `objMulticolourEnergyBar`
  (`casts/script_objects/objMulticolourEnergyBar.txt`) slides one colour along
  `rgb(255,0,0) → rgb(255,255,0) → rgb(0,200,0)` at 0/50/100 %. (Plain `objEnergyBar` defaults to
  white `rgb(255,255,255)`; the player HUD uses the multicolour subclass — matched by the port's
  `healthBarColour`.)

**Draw order (critical): surround sprite FIRST, fill sprite ON TOP (locZ+1), inset by border.**
The surround interior is opaque white (verified: 960/960 interior px = `(255,255,255,255)`), so the
fill MUST be drawn after/over it — never under it.

### B. Floating per-unit / boss bar — `objMoveableEnergyBar`
`casts/script_objects/objMoveableEnergyBar.txt` (+ `objMulticolourEnergyBar`)
- Driven by `characterEnergyRollOverMaster` (rollover only; `gEnemyEnergyMasterOn = 0` → no always-on
  enemy bars in Merlin's Revenge).
- **No fixed surround bitmap.** `calcSurroundRect` (`:42-52`) builds the surround rect dynamically from
  `pTarget.calcEnergyRectBottom()` (a generated rect just under the unit), `pSurroundHeight = 4`.
- Same `objEnergyBar` fill mechanism (`ensureEnergyBar` `:60-69`, `barBorder = 1`); colour =
  `g.teamMaster.getTeamColour(target.team)` (`setTarget` `:81-82`) — i.e. **team colour, not the
  red→green multicolour** of the HUD.
- So the floating bar is intrinsically procedural-rect even in the original (a generated box + a clipped
  colour fill); there is no member art to "miss" here except the level stars drawn alongside it.

### Member-art family in `extracted/`
- `00254_health_bar_surround_D2.png` (100×14) — HUD surround. **Bundled** (`assets.json` member
  `health_bar_surround`, build_assets.ts:313).
- `00346_dot_right.png` (1×1), `04416_dot_bottom.png` (1×1) — solid fill dots. **Not bundled** (not
  needed: a 1×1 solid dot == a `fillRect`).
- `00184_health_grey_locz151_a.png` (68×13) — unrelated grey art (not the active bar).
- No multi-frame `health_bar_fill` sheet exists → confirms fill is **width-clipped, not frame-indexed**.
- `energy`/`mana`: the player HUD has **no** mana/energy pool bar (magic charge is shown by the head
  orb, not a HUD bar) — correctly absent in the port.

---

## SECTION 2 — Port (every bar draw site)

| # | Site | File:line | Surround | Fill | reuses-real-member? |
|---|------|-----------|----------|------|---------------------|
| 1 | Player HUD bar (art branch) | `port/src/main.ts:467-471` | real `health_bar_surround` blit | `fillRect` width-clipped, multicolour | **partial — real surround, but WRONG Z-ORDER** |
| 2 | Player HUD bar (fallback) | `port/src/main.ts:472-474` | procedural box | `fillRect` width-clipped | procedural (only when art unbundled — not the live path) |
| 3 | Floating rollover bar | `port/src/render/rollover.ts:50` | procedural box (`:49`) | `fillRect` width-clipped, multicolour | procedural (matches original's generated-rect floating bar) |
| 4 | Colour model | `port/src/render/healthBar.ts:8-20` | — | — | faithful to `objMulticolourEnergyBar` |

### THE DIVERGENCE (site #1 — the live HUD bar)
`port/src/main.ts:468-471`:
```ts
if (surround) {
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(8, 6, surround.w, surround.h);
  ctx.fillStyle = healthBarColour(hp); ctx.fillRect(8, 10, Math.round(surround.w * hp), 6); // fill
  ctx.drawImage(surround.img, 8, 6);                                                        // surround OVER fill
}
```

1. **Wrong draw order (root cause).** The fill rect is drawn FIRST, then `drawImage(surround)` is drawn
   ON TOP. The surround bitmap's interior is **fully opaque solid white** (verified: every interior
   pixel `(255,255,255,255)`), so it completely covers the coloured fill. Net result on screen: a flat
   white bar that never shows health colour or depletion. The original draws the **fill on locZ+1, i.e.
   OVER the surround** (`objEnergyBar.txt:130`). The comment at `main.ts:466` ("its keyed white interior
   lets the fill show through") is **factually wrong** — the interior is opaque, not keyed.

2. **No border inset.** The fill is drawn full-width at the surround's outer edge (`x=8`, width
   `surround.w * hp`, fixed `y=10`, fixed `h=6`). The original insets the fill by `barBorder = 2` on all
   sides (`barRect = surroundRect.inflate(-2,-2)` → fill occupies x∈[10,98], the 96-px-wide white
   interior), so the surround frame stays visible as a border around the fill.

3. **Hard-coded fill geometry.** `y=10, h=6` are magic numbers unrelated to the 14-px-tall surround;
   should derive from the inset rect (interior is rows 2..12 → y≈8, h≈10 after a 2px border... actual
   white interior spans the full inner height).

(Sites #2/#3/#4 are acceptable: the fallback box only triggers if the art is missing; the floating bar
mirrors the original's generated-rect approach + uses real `star_*` member art; the colour model is
faithful.)

---

## SECTION 3 — FIX PLAN (player HUD bar, `port/src/main.ts:468-471`)

Replace the `if (surround)` body with **surround-first, fill-on-top, border-inset**:

```ts
const X = 8, Y = 6, B = 2;                          // barBorder = 2 (objPlayerCharacter/objEnergyBar)
ctx.drawImage(surround.img, X, Y);                  // 1) real surround FIRST (replaces the white interior)
const iw = surround.w - 2 * B, ih = surround.h - 2 * B;   // inflate(-B,-B): 96 × 10
ctx.fillStyle = healthBarColour(hp);
ctx.fillRect(X + B, Y + B, Math.round(iw * hp), ih); // 2) fill ON TOP, inset, width-clipped to hp%
```

- **Member to blit:** `health_bar_surround` (already bundled) — keep as the frame, drawn first.
- **Fill formula:** width-clipped solid colour rect (NOT frame-indexed — original uses a 1×1 stretched
  dot). `width = round((surround.w - 2*barBorder) * energyFrac)`, left-anchored, `barBorder = 2`.
- **Position:** surround at `(8,6)`; fill at `(8+2, 6+2)`, size `(96, 10)` clipped by `hp`.
- **Colour:** keep `healthBarColour(hp)` (faithful `objMulticolourEnergyBar` red→yellow→green).
- **Drop** the `rgba(0,0,0,0.6)` backdrop in the art branch (the opaque surround already provides the
  background; the original draws no separate dark box behind it). Keep the backdrop only in the
  no-art fallback branch.
- Fix the misleading comment at `main.ts:466` (interior is opaque white, not keyed/transparent).

Floating bar (`rollover.ts`) and colour model need **no change**.

No probe was created (the trace was read-only); nothing to delete.

---

SS-2-healthbar | DIVERGENCES=3
- HUD bar: opaque surround blitted OVER the fill (wrong z-order) → flat white bar, no colour shows
- HUD bar: fill not inset by barBorder (2px) → surround frame not preserved around the fill
- HUD bar: comment/assumption that the surround interior is keyed/transparent is false (it is opaque white)
