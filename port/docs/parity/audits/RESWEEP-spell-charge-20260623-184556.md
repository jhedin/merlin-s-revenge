# RESWEEP — Spell charge orb (player charging visual) — 2026-06-23

Bug report: "the spell charging still isn't pixel perfect." The growing charge orb
shown over Merlin's head while holding the cast key is mis-positioned / mis-sized
vs the original.

## Scope of the visual
The charge orb is the live `objSpell` actor in `#charge` mode — the generic
`spell_charge` orb (member 1904, 63×63, reg `[31,31]` = centred), tinted to the
spell's `#chargeColour`, scaled so its width/height == `calcSize()`, and re-aligned
over the caster every frame.

## Original anchor / offset / size formula (cast file:line)

Orb centre each frame = `calcChargeLoc()` + `calcChargeOffset()`, scaled to `calcSize()`:

- `objCharacter.calcChargeLoc` (`casts/script_objects/objCharacter.txt:113-123`)
  `chargeLoc = caster.getLoc() + chargeLocOffset`, where
  `chargeLocOffset.locH = pChargeLoc.locH * dir` (flipped by facing), `locV` unflipped.
  Player `pChargeLoc` = `point(0,-8)` (default `objCharacter.txt:29`; `act_player.txt`
  has **no** `#chargeLoc` override — only `#gmgChargeLoc point(10,-1)` for the GMG).
- `objSpell.calcChargeOffset` (`casts/script_objects/objSpell.txt:90-108`)
  `#top` → `point(0, -calcSize()/2)`; `#side` → `point(±calcSize()/2, 0)`.
  Player offset side = `#top` (default `objCharacter.txt:31`; flips to `#side` only
  under GMG, `objCharacter.txt:245`).
- `objSpell.calcSize` (`casts/script_objects/objSpell.txt:110-112`)
  `size = pCurrentCharge * getAttack().chargeSize`. energyBlast has no `#chargeSize`
  → structAttack default **1** (`structMaster.txt:151`). So `size = charge` (px, diameter).
- `objSpell.updateSize` (`casts/script_objects/objSpell.txt:303-308`)
  `setSpriteWidth(size); setSpriteHeight(size)` — exact, **no minimum floor**
  (`objSpriteMember.txt:270-272` / `242-244` just assign `pSprite.width/height = newVal`).
- Re-align every frame: `objAiAttack.internalEvent #updateReel`
  (`casts/script_objects/objAiAttack.txt:248-253`) calls `chargingSpell.align(calcChargeLoc())`.

Net player formula (energyBlast, `#top`, chargeLoc `(0,-8)`):
```
size   = charge                       (chargeSize 1)
orbCx  = casterX                      (chargeLoc.h 0)
orbCy  = casterY - 8 - size/2         (chargeLoc.v -8, #top rise -size/2)
```

## Port current formula (port file:line)

- Position source — `port/src/components/control.ts:250`:
  `...setCharge(this.charge, muzzle(magic, m).x, muzzle(magic, m).y)`.
  `muzzle` (`control.ts:39-42`) = `caster.loc + attack.collisionLoc` (x flipped by facing).
  energyBlast `#collisionLoc = point(0,-8)` (`act_energyBlast.txt:22`).
- `SpellActor.setCharge` (`port/src/components/spellActor.ts:80-87`):
  `#top` → `m.x = casterX; m.y = casterY - size()/2` (`size()` = `charge*chargeSize`,
  `spellActor.ts:89`). Equivalent rise to the original.
- Render — `port/src/main.ts:626`:
  `const size = Math.max(4, sa.size());` then drawn at `(m.x, m.y)`, reg `[31,31]`,
  `scaleX/Y = size / 63` (`main.ts:633-634`).

Net port formula:
```
size_pos  = charge                        (setCharge uses unfloored size)
size_draw = max(4, charge)                (render floor — DIVERGENCE)
orbCx     = casterX                        (collisionLoc.x 0)
orbCy     = (casterY - 8) - charge/2       (rise uses unfloored size)
```

## Precise discrepancy (pinned)

1. **Render size floor `Math.max(4, …)` (root cause).** `main.ts:626` clamps the drawn
   orb to a 4px minimum that does not exist in the original (`updateSize` →
   `setSpriteWidth(calcSize())`, no floor). For charge < 4 (the first frames of every
   cast — energyBlast starts at chargeStart 0, +1/tick) the orb is drawn too large:

   | charge | size (orig) | size (port) | orb centreY Δ |
   |-------:|------------:|------------:|--------------:|
   |   1    |     1       |     4       |  −1.5 px (too high) |
   |   2    |     2       |     4       |  −1.0 px (too high) |
   |   3.99 |     3.99    |     4       |   0    |
   |  ≥4    |    =        |    =        |   0    |

   The vertical error arises because the orb's `#top` rise is computed from the *true*
   size in `setCharge` (`m.y = casterY-8 - charge/2`) but the renderer paints the
   *floored* size centred at that point — so the floored orb's bottom edge floats above
   the chargeLoc instead of touching it, and it reads as both bigger and lifted at the
   start of the charge. For charge ≥ 4 (size ≥ 4) the port is pixel-exact.

2. **(Latent, not currently visible) chargeLoc vs collisionLoc conflation.** The port
   anchors the orb at the *spell weapon's* `#collisionLoc` (the muzzle), whereas the
   original anchors at the *caster's* `#chargeLoc`. For the player + energyBlast these
   coincide (both `point(0,-8)`), so the live bug is invisible today. But it is the wrong
   source: any spell whose `#collisionLoc` ≠ the caster's `#chargeLoc`, or any caster
   with a non-default `#chargeLoc`, would mis-anchor. (Also: under GMG the original
   switches to `#side` + `chargeLoc point(10,-1)`; the port hardcodes `offsetSide "#top"`
   in `ensureSpell`/`configure` — a separate GMG-only deviation, out of scope for the
   non-GMG charge complaint but worth tracking.)

## Concrete fix

Primary (fixes the reported pixel error):
- `port/src/main.ts:626` — drop the 4px floor so the drawn size equals `calcSize()`
  exactly, matching `setSpriteWidth(calcSize())`:
  ```ts
  const size = sa.size();            // was: Math.max(4, sa.size())
  ```
  Keep the existing `Math.max(1, f!.w/h)` guards in the scale divisor (they only avoid
  divide-by-zero, not a visible floor). The procedural-fallback branch's `r = size/2`
  then also tracks the true size. With this, charge-1 → 1px orb, growing 1px/tick,
  bottom edge pinned to chargeLoc — pixel-identical to the original at every charge.

Secondary (correctness hardening, optional, no visible change for the player today):
- Anchor the orb at the caster's `#chargeLoc`, not the spell's muzzle. Resolve the
  caster's `chargeLoc` (default `(0,-8)`, x flipped by facing) and pass that to
  `setCharge` at `control.ts:250` (and the release/CPU sites 336/853/970/991) instead of
  `muzzle(magic, m)`. This decouples the charge-orb anchor from `collisionLoc` and makes
  non-energyBlast / non-default-caster spells faithful.

## Verification
Throwaway probe (`tools/_audit_charge.ts`, removed) reproduced the table above:
`dY = 0` for charge ≥ 4, `dY = −1.5 … −1.0` and `size 4 vs 1–2` for charge 1–3.99.
Removing the floor zeroes the delta at all charges.
