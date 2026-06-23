# SS-hud — three cosmetic HUD families bundled in `extracted` but UNBUNDLED + undrawn

Read-only investigation + implementation plan. **No code changed.** Three families are present
in `extracted/manifest.json` but neither bundled by `port/tools/build_assets.ts` nor drawn by the
port. Each section gives: the exact extracted sprite name(s), the original draw routine (file:line),
the port gap (file:line), and a concrete fix (build-assets bundling snippet + draw-code sketch).

Verified against `extracted/manifest.json` → `engine.bitmaps[]` (3104 entries, each
`{file,id,name,w,h,reg}`). All clean names below resolve through the **existing** build-assets
"shortest-prefix" matcher (`bitmaps.filter(b => b.name === name || b.name.startsWith(name))`
sorted by name length — `tools/build_assets.ts:323-324`).

---

## FAMILY 1 — `*_writing` powerup-name captions (19 sprites)

### 1.1 Exact extracted sprites (clean name → least-mangled candidate the matcher picks)

| clean (effect) | extracted name | id | w×h | reg |
|---|---|---|---|---|
| `manaBurst_writing` | `manaBurst_writingC` | 2004 | 77×13 | [37,6] |
| `manaFlow_writing` | `manaFlow_writingC` | 2126 | 93×13 | [46,6] |
| `manaCapacity_writing` | `manaCapacity_writingC` | 2227 | 64×11 | [32,5] |
| `energyBlast_writing` | `energyBlast_writingB` | 2275 | 75×15 | [37,7] |
| `walkSpeed_writing` | `walkSpeed_writingC` | 4299 | 61×13 | [30,6] |
| `medikit_writing` | `medikit_writingC9D_L` | 4472 | 64×33 | [30,20] |
| `armySummon_writing` | `armySummon_writingC` | 21461 | 90×15 | [45,7] |
| `energyPulseSpell_writing` | `energyPulseSpell_writingD` | 80528 | 78×15 | [39,7] |
| `energyMines_writing` | `energyMines_writingD` | 80727 | 82×15 | [40,7] |
| `cBlast_writing` | `cBlast_writingB` | 348318 | 87×15 | [37,7] |
| `energyPunch_writing` | `energyPunch_writingH` | 348320 | 83×15 | [41,7] |
| `merlinSword_writing` | `merlinSword_writingH` | 348322 | 41×12 | [20,6] |
| `healBlast_writing` | `healBlast_writingK` | 404873 | 60×12 | [29,6] |
| `maxikit_writing` | `maxikit_writingK` | 406793 | 44×12 | [22,6] |
| `monsterSummon_writing` | `monsterSummon_writingK` | 407212 | 106×12 | [53,7] |
| `arcticBlast_writing` | `arcticBlast_writingL` | 430874 | 76×12 | [38,6] |
| `morph_writing` | `morph_writingL` | 434719 | 37×15 | [18,7] |
| `gmg_writing` | `gmg_writingL` | 434723 | 116×11 | [58,5] |
| `energyBeamSpell_writing` | `energyBeamSpell_writingD` | 436048 | 79×15 | [39,7] |

That is exactly **19** sprites. Note the registration point is the horizontal **centre** of the
caption (`reg.x ≈ w/2`, `reg.y ≈ h/2`) — the original draws it centred on the powerup's location.

Two pickup effects have **no own `_writing`** and inherit (matching how their *scroll* art is
shared in `PICKUP_MEMBER`, `main.ts:509-516`):
- `darkBlast` → use `energyBlast_writing` (act_darkBlast shares energyBlast art).
- `energyBeam` → use `energyBeamSpell_writing`; `energyPulse` → `energyPulseSpell_writing`.
There is no `gmg`-pickup writing distinct from `gmg_writingL`; `morph_writing` exists but the port
has no morph pickup effect (bundle it anyway — harmless, completes the family).

### 1.2 Original draw routine — it is a **WORLD-SPACE in-place fade**, NOT a HUD overlay

`casts/script_objects/objPowerUpWriting.txt` (the powerup IS a `objPowerUp` sprite that, on
collection, swaps its own member to `<character>_writing` and fades out in place):

- `collected` (`:37-43`): sets `pCollected`, calls `me.displayWriting()`, **does NOT pass to
  ancestor** (so the powerup does not vanish immediately — the comment at `:38` is explicit),
  `setRecordInRoomState(false)`, plays `pCollectSound`.
- `displayWriting` (`:45-49`):
  ```
  me.setMember(pWritingMember)   -- swap the sprite's bitmap to <character>_writing
  me.goMode(#writing)
  me.startFade()                 -- modFader
  ```
- `setWritingMember` (`:68-75`): `memName = me.getCharacter() & "_writing"` →
  `member(memName,"gfx")`. So the caption member is keyed off the powerup's character, i.e. the
  effect name (`manaBurst` → `manaBurst_writing`, etc.).
- `faderFin` (`:51-53`): `me.setDead(true)` — the writing self-destructs when the fade completes.

**Fade timing (exact):** `modFader.startFade` (`casts/script_objects/modFader.txt:85-87`) →
`startTransBlend(2, #out)` → `objTransBlend`/`objTransformer` step the sprite `blend` property from
100 → 0 via `VarToward(pCurr, pTarget, pSpeed)` with `speed = 2`
(`objTransformer.txt:123`). That is **50 update ticks** of linear alpha fade (100/2), ≈ **1.6 s at
30 fps**, drawn at the powerup's **world location** (the sprite never moves).

So the original behaviour is: collect a powerup → its on-ground art is replaced by the name caption
centred on the same spot → caption fades from opaque to invisible over ~50 frames → entity dies.

### 1.3 Port gap

- `port/src/components/pickup.ts:46-58` — on overlap the pickup `apply()`s the effect, sets
  `this.collected = true`, plays `collect_powerup_01`. **No member swap, no caption, no fade.**
- `port/src/main.ts:335` — the collected pickup is removed on **the very same frame**:
  `if ((e.type === "pickup" && e.send("isFinished")) || …) game.entities.splice(i, 1);`
  and `Pickup.isFinished()` returns `this.collected` (`pickup.ts:43`). So even if a caption sprite
  were drawn, the entity would be gone before it could render. **This instant-removal is the core
  gap** — the original keeps the powerup alive through the fade.
- `port/src/main.ts:504-527` (`PICKUP_MEMBER` / `pickupSprite`) bundles `*_potion` / `*_scroll`
  art but has **no `*_writing` map** and no writing-phase render.
- `port/tools/build_assets.ts:309-322` (`MEMBER_NAMES`) bundles potions, scrolls, minimap tiles,
  stars, `health_bar_surround`, `medikit_on/off` — **no `*_writing` entries**.

### 1.4 Fix

**(a) Bundle — `tools/build_assets.ts`, append to the `MEMBER_NAMES` array (`:309`).** No PIL;
these are plain PNGs copied via the existing `copy()` helper, prefix-matched by the existing loop.

```ts
  // SS-hud F1: powerup-collect NAME captions (objPowerUpWriting; swapped in-place + faded on pickup).
  // reg.x ≈ w/2 → the caption is centred on the powerup's world loc.
  "manaBurst_writing", "manaFlow_writing", "manaCapacity_writing", "energyBlast_writing",
  "walkSpeed_writing", "medikit_writing", "armySummon_writing", "energyPulseSpell_writing",
  "energyMines_writing", "cBlast_writing", "energyPunch_writing", "merlinSword_writing",
  "healBlast_writing", "maxikit_writing", "monsterSummon_writing", "arcticBlast_writing",
  "morph_writing", "gmg_writing", "energyBeamSpell_writing",
```

These then ride the existing `members` block → `assets.json.members` → loaded up front and
white-matte keyed (`assets.ts:117-119`, `loadFile(..., "flood")`), reachable via `assets.member()`.

**(b) Effect → writing member map — `main.ts`, alongside `PICKUP_MEMBER` (`:509`).**

```ts
// SS-hud F1: pickup effect -> its name-caption member (objPowerUpWriting <character>_writing).
// darkBlast shares energyBlast's caption; beams use their *Spell caption (mirrors PICKUP_MEMBER).
const PICKUP_WRITING: Record<string, string> = {
  heal: "medikit_writing", maxikit: "maxikit_writing", speed: "walkSpeed_writing",
  manaCapacity: "manaCapacity_writing", manaFlow: "manaFlow_writing", manaBurst: "manaBurst_writing",
  sword: "merlinSword_writing", spell: "energyBlast_writing", energyPunch: "energyPunch_writing",
  cBlast: "cBlast_writing", darkBlast: "energyBlast_writing", arcticBlast: "arcticBlast_writing",
  healBlast: "healBlast_writing", armySummon: "armySummon_writing", monsterSummon: "monsterSummon_writing",
  energyMines: "energyMines_writing", gmg: "gmg_writing",
  energyBeam: "energyBeamSpell_writing", energyPulse: "energyPulseSpell_writing",
};
```

**(c) Keep the pickup alive through the fade — `components/pickup.ts`.** Add a writing phase so
`isFinished()` does not fire until the fade ends (mirrors `collected` not passing to ancestor +
`faderFin → setDead`):

```ts
private writingTicks = -1;           // -1 = not collected; counts UP 0..WRITE_FADE
private static readonly WRITE_FADE = 50;  // startTransBlend(2,#out): blend 100→0 at speed 2 = 50 ticks

// in update(), when overlap detected — replace `this.collected = true` with:
this.apply(p);
game.audio?.play("collect_powerup_01");
this.writingTicks = 0;               // enter the writing phase instead of dying

// then advance the fade each tick:
if (this.writingTicks >= 0 && this.writingTicks < Pickup.WRITE_FADE) this.writingTicks++;

isFinished(): boolean { return this.writingTicks >= Pickup.WRITE_FADE; }   // dies only after fade
// expose for the renderer:
writingPhase(): { effect: PickupEffect; alpha: number } | null {
  if (this.writingTicks < 0) return null;
  return { effect: this.effect, alpha: 1 - this.writingTicks / Pickup.WRITE_FADE };
}
```

(The `apply()`/effect grant still happens exactly once, on the collect frame — unchanged. Only the
entity's *lifetime* and *visual* change.)

**(d) Draw the caption in-world — `main.ts`, in `pickupSprite()` (`:521`)** (it already runs in the
z-sorted world pass at `:391-394`, so the caption is correctly world-anchored, not HUD-pinned).
Once collected, return the writing sprite instead of the potion/scroll, faded via the entity's alpha.

```ts
function pickupSprite(e, assets): Sprite | null {
  const ph = e.send("writingPhase") as { effect: string; alpha: number } | null;
  const name = ph ? PICKUP_WRITING[ph.effect] : PICKUP_MEMBER[e.send("getEffect") as string];
  const mem = assets.member(name ?? "");
  if (!mem) return null;
  const m = e.get(Movement);
  return { img: mem.img, x: m.x, y: m.y, regX: mem.reg[0], regY: mem.reg[1], z: m.y,
           alpha: ph ? ph.alpha : undefined };  // Sprite needs an optional `alpha` honoured by drawSprites
}
```

If `Sprite`/`drawSprites` (`render/renderer.ts`) has no per-sprite alpha, add one
(`ctx.globalAlpha = sp.alpha ?? 1` around the blit) — a one-line addition. The reg point already
centres the caption on the pickup's location, matching the original.

---

## FAMILY 2 — `gmg_off` / `gmg_on` (god-mode/GMG toggle HUD icon)

### 2.1 Exact extracted sprites

| clean | extracted name | id | w×h | reg |
|---|---|---|---|---|
| `gmg_off` | `gmg_offL` | 429729 | 53×16 | [26,8] |
| `gmg_on` | `gmg_onL` | 429740 | 53×16 | [26,8] |

(Also present but already separately handled: `gmg_scroll` = pickup art, bundled at
`build_assets.ts:314`; `gmg_writing` = the caption from Family 1.)

### 2.2 Original draw routine

`casts/master_objects/gmgMaster.txt` passes state from `modGoldenMachineGun` to the displayer:
- `start` (`:24-32`): builds `objGmgDisplayer` with `offMember = member("gmg_off","gfx")`,
  `onMember = member("gmg_on","gfx")`, `displayLoc = theLoc`.
- `updateDisplay` (`:47-49`): `pGmgDisplayer.updateActive(theState)`.

`casts/script_objects/objGmgDisplayer.txt`:
- `updateActive` (`:43-51`):
  ```
  if active then currentMember = pOnMember else currentMember = pOffMember
  me.displayImageAtLoc(currentMember.image, pDisplayLoc)
  ```
  → a single icon at `pDisplayLoc`, swapping `gmg_on` ⇄ `gmg_off` with the live toggle.

Driver: `modGoldenMachineGun.setGmg` (`:35-51`) flips `pGmgOn` and calls
`g.gmgMaster.updateDisplay(pGmgOn)` — i.e. the icon updates exactly when the player presses the
toggle, inert until collected (`pGmgCollected`).

### 2.3 Port gap

- State exists & is faithful: `components/control.ts:73-97` — `gmgCollected_`, `gmgOn`,
  `getGmgOn()` (`:96`), `getGmgCollected()` (`:97`); the `G` key toggles at `control.ts:186-189`.
- **No draw:** `drawHud` (`main.ts:464-502`) never reads `getGmgOn`/`getGmgCollected` and never
  blits `gmg_on`/`gmg_off`. The icon members are not in `MEMBER_NAMES`
  (`build_assets.ts:309-322`).

### 2.4 Fix

**(a) Bundle — `MEMBER_NAMES` (`build_assets.ts:309`):**

```ts
  // SS-hud F2: GMG toggle HUD icon (objGmgDisplayer on/off member).
  "gmg_off", "gmg_on",
```

**(b) Draw — `drawHud` (`main.ts`, after the medikit row, ~`:496`):** only when collected; swap on
the live state. The port HUD stack runs top-left (bar y=6, xp y=22, medikit row y=30, lives y=50),
so place the 53×16 icon to the right of the medikit row at a free slot (e.g. x=70,y=30) or below it.

```ts
// SS-hud F2: GMG toggle icon — drawn only once collected; on/off mirrors getGmgOn (gmgMaster.updateActive).
if (player.send("getGmgCollected") as boolean) {
  const gimg = assets.member((player.send("getGmgOn") as boolean) ? "gmg_on" : "gmg_off");
  if (gimg) ctx.drawImage(gimg.img, 70, 30);   // right of the medikit kit row
  else { ctx.fillStyle = (player.send("getGmgOn") as boolean) ? "#ff4" : "#666";
         drawText(ctx, assets, "small", "GMG", 70, 38, { fallbackFont: "8px monospace" }); }
}
```

(`displayImageAtLoc(member.image, loc)` blits the member with its registration applied; the original
`displayLoc` is the engine-chosen HUD anchor. The port HUD has its own layout, so a fixed HUD slot is
the faithful substitute — the *behaviour* "icon present once collected, lit on/off with the toggle"
is what matters.)

---

## FAMILY 3 — Wizard summon portrait bar

### 3.1 Exact extracted sprites

The HUD marker the displayer hard-codes:

| clean | extracted name | id | w×h | reg |
|---|---|---|---|---|
| `wizard_on` | `wizard_onLq` | 429286 | 16×16 | [8,8] |

Per-found-wizard **portrait** (`#bar`) + **selector** (`#ws`) members
(`wizardMaster.newWizardFound` builds `<name>_off` and `<name>_ws`). Present in the manifest:

| wizard | `_off` (bar portrait) | `_ws` (selector) |
|---|---|---|
| amotonlin | `amotonlin_offL` 16×16 reg[8,8] | `amotonlin_wsL` 18×16 reg[9,8] |
| flaetorlin | `flaetorlin_offL` 16×16 | `flaetorlin_wsL` 18×16 |
| foelin | `foelin_offL` 16×16 | `foelin_wsL` 18×16 |
| garonlin | `garonlin_offL` 16×16 | `garonlin_wsL` 18×16 |
| verdanlin | `verdanlin_offL` 16×16 | `verdanlin_wsL` 18×16 |

**There is NO per-wizard `_on` member.** In the original, `_off` is the *bar portrait* and
`wizard_on` (`wizard_onLq`) is the **yellow selection/active outline** drawn over the selected slot
via an `objBox` — not a per-wizard "lit" portrait. Verified:
`wizardMaster.newWizardFound` (`:34-44`) → `#bar = member(name & "_off")`,
`#selector = member(name & "_ws")`; `objWizardDisplayer.init` (`:91`) →
`boxParams.member = member("wizard_on","gfx")`, `boxParams.color = rgb(255,255,0)`.

### 3.2 Original draw routine

`casts/master_objects/wizardMaster.txt`:
- `newWizardFound` (`:34-44`): registers a found wizard, stores `#bar`(`_off`) + `#selector`(`_ws`);
  auto-selects + `wizardOn()` for the first one found.
- `setWizard` (`:55-58`): `updateDisplay(pWizardsFound[sel].bar)` → shows the selected wizard's bar
  portrait.
- `wizardOn`/`wizardOff` (`:74-80`): forward to displayer `setWizardOn`/`setWizardOff`.

`casts/script_objects/objWizardDisplayer.txt`:
- `init` (`:69-99`): `pDisplayLoc = params.displayLoc`; builds a yellow `objBox` outline
  (`member("wizard_on")`, `gGridSelectorLayer`), starts off-screen.
- `updateDisplayFromObj` (`:211-247`): `me.displayImageAtLoc(theImage.image, pDisplayLoc)` — blits
  the selected wizard's bar portrait at `pDisplayLoc`.
- `setWizardOn` (`:191-197`): positions the yellow outline box over the slot
  `rect(loc.h, loc.v, loc.h+16, loc.v+16)` (a 16×16 highlight around the portrait → that is where
  `wizard_on`'s 16×16 art is used).
- `setWizardOff` (`:201-207`): `pOutline.offscreen()` — hides the highlight.

So the original HUD is: a **single 16×16 portrait slot** showing the *currently selected* found
wizard's `_off` bar art, with a yellow 16×16 outline box overlaid when a wizard is currently
summoned on the field. (The energy-bar code is all commented out — `initEnergyBar` `:103-137` is
dead; no per-wizard health bar ships in Merlin's Revenge.)

### 3.3 Port gap

- `port/src/systems/wizardMaster.ts` tracks `found[]` (`:23`), `selected` (`:24`), `activeId`
  (`:25`) and exposes `foundList` (`:35`), `current()` (`:39`), `selectNext()` (`:44`),
  `activeWizardId` (`:46`). State is complete. **No draw method, no portrait, no outline.**
- `drawHud` (`main.ts:464-502`) never references `game.wizardMaster` — the only HUD references to it
  are `reset()` (`main.ts:181`) and summon logic in `control.ts:113`.
- None of `wizard_on` / `<name>_off` / `<name>_ws` are in `MEMBER_NAMES`
  (`build_assets.ts:309-322`).

### 3.4 Fix

**(a) Bundle — `MEMBER_NAMES` (`build_assets.ts:309`).** Bundle the selection marker + all five
found-wizard bar portraits (and optionally `_ws` selector icons if a selector palette is later
drawn):

```ts
  // SS-hud F3: wizard summon portrait bar — selection marker + per-wizard bar portraits (objWizardDisplayer).
  "wizard_on",
  "amotonlin_off", "flaetorlin_off", "foelin_off", "garonlin_off", "verdanlin_off",
  // (optional, for a future selector palette — objWizardDisplayer #selector members)
  "amotonlin_ws", "flaetorlin_ws", "foelin_ws", "garonlin_ws", "verdanlin_ws",
```

(Prefix-matcher resolves `amotonlin_off` → `amotonlin_offL`, etc.; `wizard_on` → `wizard_onLq`.)

**(b) Expose the selected-wizard sym for the HUD — `systems/wizardMaster.ts`** (`current()` already
returns the base sym; add an "is a wizard summoned" flag the HUD can read):

```ts
get isSummoned(): boolean { return this.activeId >= 0; }   // pWizardOn equivalent
```

**(c) Draw the portrait row — `drawHud` (`main.ts`, ~`:496`):** show the selected found wizard's
`<sym>_off` portrait; overlay the yellow `wizard_on` 16×16 marker when one is summoned. Place at a
free HUD slot (e.g. x=8,y=42, below the medikit row, above lives — adjust to the layout budget).

```ts
// SS-hud F3: wizard summon portrait — selected found wizard's bar portrait + active-summon marker.
const wm = game.wizardMaster;
const sym = wm.current();                       // selected found wizard base sym, or null
if (sym) {
  const portrait = assets.member(sym + "_off");
  if (portrait) ctx.drawImage(portrait.img, 8, 42);
  else { ctx.fillStyle = "#8cf"; drawText(ctx, assets, "small", sym, 8, 50, { fallbackFont: "8px monospace" }); }
  if (wm.isSummoned) {                          // setWizardOn: yellow 16×16 outline over the slot
    const mark = assets.member("wizard_on");
    if (mark) ctx.drawImage(mark.img, 8, 42);
    else { ctx.strokeStyle = "#ff0"; ctx.strokeRect(8, 42, 16, 16); }
  }
}
```

(A multi-portrait *row* — one slot per found wizard with the selected one outlined — is a faithful
extension since `foundList` is exposed; the original only ever blits the **selected** portrait at one
`pDisplayLoc`, so a single slot is the minimal faithful draw. The `wizard_on` art is the yellow
selection box, so it is overlaid on the active slot, not used as a separate "on" portrait.)

---

## Cross-cutting notes

- All bundling above is **copy-only via the existing `copy()` helper** (`build_assets.ts:28-33`) and
  the existing `members` loop (`:323-328`) — **no PIL / no .tif conversion** (these are committed
  PNGs in `extracted/engine/bitmaps`). Each new name flows into `assets.json.members` and is loaded
  up front with the white-matte "flood" key (`assets.ts:117-119`), reachable via `assets.member()`.
- Family 1 is the only one needing a **lifetime change** (keep the pickup entity alive through the
  ~50-frame fade); 2 and 3 are pure additive HUD draws over already-tracked state.
- Family 1's caption is **world-space** (centred on the powerup loc, z-sorted with actors via the
  existing `pickupSprite` path) — NOT a HUD-pinned element. Families 2 and 3 are HUD-pinned (drawn in
  `drawHud`). The original GMG/wizard `displayLoc` is an engine HUD anchor; the port supplies its own
  HUD slot coordinates (its HUD layout already diverges — `health_bar_surround` at 8,6 etc.).

---

SS-hud | ITEMS=3
1) `*_writing` (19 sprites: manaBurst…energyBeamSpell) — in-place faded powerup-name caption; bundle in build_assets, keep pickup alive ~50f + draw via pickupSprite. 2) `gmg_off`/`gmg_on` (gmg_offL/gmg_onL) — GMG toggle HUD icon; bundle + draw in drawHud off getGmgOn/getGmgCollected. 3) Wizard portrait bar (`wizard_on`=wizard_onLq + `<name>_off`/`_ws` for amotonlin/flaetorlin/foelin/garonlin/verdanlin) — bundle + draw selected portrait + summon marker in drawHud.
