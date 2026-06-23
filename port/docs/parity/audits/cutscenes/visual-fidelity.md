# Cutscene Visual-Fidelity Audit + Fix Spec

Read-only investigation. Compares the port's cutscene rendering
(`port/src/scenes/cutscenePlayer.ts`, `port/src/scenes/thespian.ts`) against the
original Director engine (`casts/master_objects/cutSceneMaster.txt`,
`casts/script_objects/objCutSceneBackGround.txt`, `objCutSceneTitle.txt`,
`objSpriteMember.txt`, `modColourTransform.txt`, `modThespian.txt`,
`objScriptPerformer.txt`).

Scope: the four areas requested — backdrop, title, speech/captions, actor
scale/floor geometry. Each item gives original behaviour (file:line) vs the port
(file:line) and a concrete fix.

---

## 0. CRITICAL CORRECTION — there is NO pictorial `cutSceneStage` backdrop

The audit brief assumed the original draws a "real backdrop image
`cutSceneStage`". **The extracted evidence contradicts this.** The fix for item 1
as briefed (bundle a PNG, blit it under the actors) would import a 1×1 transparent
pixel and change nothing — or, if mis-handled, stretch a junk pixel over the stage.

Evidence:

- `extracted/manifest.json:1866-1876` — `cutSceneStage` is `"w": 1, "h": 1,
  "depth": 32, "reg": [0,0]`. The file `extracted/engine/bitmaps/05433_cutSceneStage.png`
  is **70 bytes, a 1×1 8-bit RGBA PNG** (`file` + PIL both confirm `1 x 1`).
- `cutSceneMaster.txt:40` — `pBackgroundMember = member("cutSceneStage", "gfx")`.
  This member is a sprite *placeholder*, not artwork.
- The background object (`objCutSceneBackGround.txt:4-10`) is just
  `objSpriteMember` + `modColourTransform` — i.e. a sprite whose only behaviours
  are *position/size* (`objSpriteMember`) and *colour tweening* (`modColourTransform`).
  There is no image-draw path; the member's pixels are never composited as art.
- `cutSceneMaster.txt:102-126` (`acquireBackground`) takes the background
  sprite's `.rect` as `pStageRect` and colours it. The background "image" is the
  flat colour of a 1×1 sprite stretched to the stage rect.
- All bg verbs operate on **colour only**: `backgroundColour`
  (`cutSceneMaster.txt:148`), `backgroundColourTo` (`:172`, speed 2),
  `backgroundColourRandomFlash` (`:157`), via
  `modColourTransform.colourTransform` (`modColourTransform.txt:69`).
- No `cutScene`/`cut_scene`-named bitmap art exists anywhere under
  `gfx/` or `casts/` (searched). The only matches are the scripts themselves.

**Conclusion:** the original cutscene "backdrop" *is* a solid colour fill that
colour-tweens (and can random-flash). The port's flat colour fill
(`cutscenePlayer.ts:80-81`) is therefore **already faithful**, and the bg-colour
tween / random-flash are already modelled in `thespian.ts`
(`bg`/`bgTarget`/`bgFlash`, `:101-104`, `:459-469`).

**Item 1 is NOT a fixable cosmetic gap.** Do not bundle `cutSceneStage`. The
remaining items below ARE real divergences worth fixing.

---

## 1. Backdrop — NO FIX (faithful)

**Original** `cutSceneMaster.txt:40,102-126,148-196`; `objCutSceneBackGround.txt:4-10`:
1×1 placeholder sprite stretched to `pStageRect`, coloured + colour-tweened. Solid
colour fill, no art.

**Port** `cutscenePlayer.ts:80-81`: `ctx.fillRect` of `t.bg` (the tweened colour).
Tween + random-flash in `thespian.ts:251,263,459-469`.

**Verdict:** matches. No change. (If desired, a single one-line note in
`cutscenePlayer.ts` could record that the flat fill IS the cutSceneStage, to
pre-empt the same mistaken "missing backdrop" report.) Not counted as a fixable item.

---

## 2. Title — colour/timing semantics diverge (the port pops/holds; original fades)

**Original** `objCutSceneTitle.txt`:
- The title is a **text-field member** `cutSceneTitle` (`cutSceneMaster.txt:53`),
  coloured via `modColourTransform`, on layer `gCutSceneSpeechLayer`
  (`cutSceneMaster.txt:140`).
- `init` (`:21-33`): bg colour `rgb(0,0,0)`, title colour `pTitleColour =
  rgb(204,204,0)` (gold), `pDisplayTime = 150` frames. The member starts coloured
  to the background (invisible: `pTitleMember.color = pBackgroundColour`).
- `showTitle` (`:92-100`): fade the CURRENT title colour DOWN to bg (black) first
  (`startColourChange(pBackgroundColour)`, speed 4), mode `#fadeDown`.
- On that fade finishing (`colourTransformFin`, `:55-65`): `setTitle(newText)`,
  start the 150-frame display timer, then `revealTitle` → fade UP to gold
  (`:80-85`).
- After 150 frames (`displayTimerFinished`/`hideTitle`, `:67-78`): fade back to bg
  (black) — the title fades OUT.
- So the title **cross-fades in (gold) and out**, holds 150 frames, position is the
  fixed score sprite (centred text field). Colour is `rgb(204,204,0)`.

**Port** `cutscenePlayer.ts:106-111`; `thespian.ts:254`:
- `showTitle` sets `this.title = text` immediately (`thespian.ts:254`); it stays
  set forever (never cleared, no display timer). It is drawn every frame at
  `viewW/2, viewH/2` in the `#menu` bitmap face ×2, colour `#fc4` (≈ gold).
- Divergences: (a) **no fade in/out** — the title pops on and never leaves;
  (b) **no 150-frame auto-hide** — it persists for the rest of the scene (and any
  later `showTitle ""` is the only way it clears); (c) colour `#fc4` =
  `rgb(255,204,68)` vs the original `rgb(204,204,0)`.

**Fix** (cosmetic; bitmap-font face is fine — `#menu` is the closest large face):

1. Model the title lifecycle in `thespian.ts` like the bg tween. Add a title
   alpha + a frame timer:
   ```ts
   // thespian.ts — stage state
   title = "";
   private titleAlpha = 0;            // 0 hidden, 1 fully gold
   private titleTimer = 0;            // frames remaining at full reveal (pDisplayTime=150)
   private static TITLE_HOLD = 150;   // objCutSceneTitle.pDisplayTime
   private static TITLE_FADE = 0x33;  // colourTransform speed 4 over 0..204 ≈ ~50 frames; use a fade rate

   // showTitle verb (replace :254):
   case "showTitle":
     this.title = step.arg.kind === "text" ? step.arg.text : step.args.join(" ");
     this.titleAlpha = 0; this.titleTimer = Thespian.TITLE_HOLD; break;

   // in tweenStage(): fade in until titleTimer counts down, then fade out
   if (this.title) {
     if (this.titleTimer > 0) { this.titleAlpha = Math.min(1, this.titleAlpha + 1/24); this.titleTimer--; }
     else { this.titleAlpha = Math.max(0, this.titleAlpha - 1/24); if (this.titleAlpha === 0) this.title = ""; }
   }
   ```
   Expose `titleAlpha` via a getter (`titleFade(): number`).
2. Draw with the alpha + the original gold (`cutscenePlayer.ts:106-111`):
   ```ts
   if (t.title) {
     ctx.save(); ctx.globalAlpha = t.titleFade();
     ctx.textAlign = "center"; ctx.fillStyle = "rgb(204,204,0)"; // pTitleColour
     drawText(ctx, this.assets, "menu", t.title, viewW/2, viewH/2,
       { align: "center", scale: 2, fallbackFont: "bold 20px serif" });
     ctx.textAlign = "left"; ctx.restore();
   }
   ```

(Note: `showTitle` is async in the original — `cutSceneMaster.txt:347-350` calls
`pTitle.showTitle` then `lineFinished()` immediately, so the SCRIPT does not block
on the fade. The port's `showTitle` is already a sync fall-through verb, which
matches; only the *visual* fade/hold/colour need adding. No line-gate change.)

---

## 3. Speech / captions — port draws a bottom caption BAR; original floats text above the speaker

**Original cutscene-mode speech** `modThespian.txt:199-238` (`displaySpeechCutScene`):
- The speech is a **Verdana 10pt** system text member (`modThespian.txt:116-124`:
  `font "Verdana"`, `fontSize 10`, `fontStyle pSpeechStyle`, `color pSpeechColor`).
- Positioned **above the speaking actor's head**: `yLoc = speechFloor -
  textBoxHeight` where `speechFloor = pStageRect.top - pSpeechGap`
  (`cutSceneMaster.txt:271-273`, `pSpeechGap = 4`); centred on the speaker's locH
  (`xLoc = bigMe.getLoc().locH - textHalfWidth`), then clamped to the stage L/R
  edges (`:228-234`).
- **No background box** is drawn in cutscene mode. `pSpeechBackgroundSprite` IS
  created (`acquireTextMember`, `:101-104`) but `displaySpeechCutScene` never sets
  its `.rect` — only `displaySpeechInGame` does (`:247-259`). So cutscene speech is
  **bare coloured text floating above the speaker**, no caption bar, no border.

**Original in-game speech** `modThespian.txt:240-262` (`displaySpeechInGame`):
- Text above the actor (`speechLoc = getLoc() + pSpeechOffset; locv -=
  textHeight`) PLUS a coloured/blended background sprite rect sized to the text
  (`backRect ... + pSpeechBackgroundBorder`). This IS the bubble.

**Port** `cutscenePlayer.ts:113-123` (full-stage `render`):
- Draws a **fixed bottom caption bar**: `boxH=56` at `viewH-62`, full-width black
  `rgba(0,0,0,0.78)` rect + `#577` border, a `speaker:` label in gold (`#small`
  face), wrapped body in white. This is a *VN-style caption bar* — it does NOT
  exist in the original cutscene path, which floats text above the speaker's head
  with no box.
- Port in-game (`cutscenePlayer.ts:67-72`, `drawBubble` `:145-165`): a bubble above
  the speaker's head — this **matches `displaySpeechInGame`** (a box above the
  head). Keep it.

**Divergence:** the full-stage cutscene caption bar is a port invention. The
original floats bare text above the speaking actor. This is the largest visual
mismatch.

**Fix** (cosmetic — make full-stage cutscene speech float above the speaker, no bar):

1. `thespian.ts` already exposes `speakerPos(alias)` (`:175-178`) — usable in
   full-stage mode too. Add the stage top / speech-floor (`pStageRect.top`):
   the port's `floor` is `viewH*0.6` (`thespian.ts:121`); the original's
   `pStageRect.top` is the top of the stage rect (≈ the actors' headroom). For the
   port, anchor above the speaker's sprite head: `y = speakerY - spriteHeight`
   (the actor sprite is drawn anchored at `m.y` = the feet, `cutscenePlayer.ts:91`,
   scaled ×2). Draw the caption at `speakerX, headY - pSpeechGap`.
2. Replace the bottom-bar block (`cutscenePlayer.ts:114-123`) with a head-anchored
   text draw, no box, clamped to stage L/R:
   ```ts
   const speech = t.getSpeech();
   if (speech) {
     const sp = t.speakerSprite(speech.alias);          // {x, y, h} of the speaker (feet y, sprite h*2)
     const cx = sp?.x ?? viewW/2;
     const headY = (sp ? sp.y - sp.h : t.stageFloor() - 80) - 4 /*pSpeechGap*/;
     // wrap to speechWidthCutScene; draw centred coloured text, no box, clamped to [stageLeft,stageRight]
     drawSpeechAbove(ctx, this.assets, speech.text, cx, headY, viewW);
   }
   ```
   where `drawSpeechAbove` measures via the `#small` face, centres each wrapped
   line on `cx`, clamps the block within `[24, viewW-24]`, and draws text only
   (white/`pSpeechColor`), no fill/stroke rect.
3. Drop the `speaker + ":"` label OR keep it small — the original member shows only
   the speech string (`pTextMember.text = theSpeech`, `:200`), no name prefix. To
   match, **omit the speaker prefix** in cutscene mode.

Font note (SS-1): the original speech is Verdana 10pt **system** text, not a bitmap
font. The port's `#small` bitmap face is an acceptable substitute (already used);
no original bitmap-font face exists for speech. Keep `#small`.

(In-game bubble `cutscenePlayer.ts:67-72,145-165` is faithful — no change.)

---

## 4. Actor scale / positions / floor — geometry diverges from the stage rect

**Original floor** `cutSceneMaster.txt:48-54,124`: `pStageFloorHeight = 16`;
`pStageFloor = pStageRect.bottom - 16`. The stage rect is the background sprite's
rect (`acquireBackground`, `:114`) — i.e. the full cutscene stage. Floor = 16px up
from the stage bottom.

**Port floor** `thespian.ts:121`: `floor = round(viewH * 0.6)` — 60% down the view,
i.e. ~40% of the view height is empty below the actors' feet. The original floor is
**16px from the bottom** of the stage rect, so actors stand near the bottom edge,
not at 60%.

**Original scale:** actors are the SAME sprites as gameplay, drawn at native size
into the stage rect (the stage rect = the gameplay sprite rect when in-game, or the
background sprite rect for a full cutscene — `acquireBackground` `:114-120`). There
is **no 2× upscale** in the original cutscene path.

**Port scale** `cutscenePlayer.ts:83-99`: full-stage actors are drawn at **`scale =
2`** (`:84`). In-game actors are drawn at native size (`renderInGame`, `:53-64`) —
which matches gameplay. The 2× in full-stage mode is a port choice (actors are tiny
~16px sprites; ×2 fills the stage). This is defensible *if* the floor is also stage-
appropriate, but combined with `floor = viewH*0.6` the actors sit high with a large
empty band below.

**Wings/stage edges** `thespian.ts:122`: `stageLeft=24`, `stageRight=viewW-24` —
a reasonable analogue of `pStageRect.left/right`.

**Divergences (cosmetic):**
- (4a) Floor at `viewH*0.6` vs original `bottom - 16`. Fix: set
  `floor = Math.round(host.viewH - 16 - GROUND_PAD)` (e.g.
  `floor = host.viewH - 16` to match `pStageFloorHeight=16`, leaving room for the
  speech band you removed in item 3). At ×2 scale a ~16px sprite is 32px tall, so
  feet at `viewH-16` puts heads at `viewH-48` — fits. Pick a floor that places the
  ×2 actors fully on-screen; `Math.round(host.viewH * 0.78)` is a pragmatic value
  that mirrors "near the bottom" without clipping ×2 sprites. Document the chosen
  constant.
  ```ts
  // thespian.ts:121 — getStageFloor: 16px up from the stage bottom (pStageFloorHeight=16),
  // adjusted for the ×2 cutscene actor upscale so feet sit near the bottom edge.
  this.floor = Math.round(host.viewH - 16 * 2); // ~bottom - 32 (×2 sprite headroom)
  ```
- (4b) The 2× upscale itself is NOT in the original. If exact-scale parity is
  wanted, draw full-stage actors at native size like `renderInGame`
  (`cutscenePlayer.ts:84` → `scale = 1`). BUT native 16px sprites on a full
  stage look minuscule; the ×2 is a deliberate readability choice. **Recommend
  keeping ×2** and recording it as an intentional, documented divergence (not a
  bug). Only the floor (4a) is worth changing.

So actor-geometry yields **one** worth-fixing cosmetic item (the floor line);
the ×2 scale is a documented intentional divergence.

---

## Summary of fixable cosmetic items

| # | Item | Original (file:line) | Port (file:line) | Fix |
|---|------|----------------------|------------------|-----|
| 1 | Backdrop | `cutSceneMaster.txt:40,102-126` (1×1 coloured sprite) | `cutscenePlayer.ts:80-81` (flat fill) | **NONE — already faithful**; do NOT bundle `cutSceneStage` (1×1 placeholder) |
| 2 | Title fade/hold/colour | `objCutSceneTitle.txt:24-100` (gold `rgb(204,204,0)`, fade in/out, 150f hold) | `cutscenePlayer.ts:106-111`, `thespian.ts:254` (pops, never hides, `#fc4`) | add titleAlpha+timer in `thespian.ts`; fade-draw with `rgb(204,204,0)` |
| 3 | Speech bar vs floating text | `modThespian.txt:199-238` (bare text above speaker, no box) | `cutscenePlayer.ts:113-123` (bottom caption bar) | float text above speaker head, drop the bar + speaker prefix |
| 4 | Stage floor line | `cutSceneMaster.txt:48-54,124` (`bottom - 16`) | `thespian.ts:121` (`viewH*0.6`) | lower the floor toward the bottom edge |

**Non-fixes / intentional divergences (documented, not counted):**
- Backdrop (item 1) — port's flat fill IS the faithful `cutSceneStage`.
- Full-stage actor ×2 upscale (`cutscenePlayer.ts:84`) — readability choice, not in
  original; keep.
- Speech font is `#small` bitmap face vs original Verdana 10pt system text — no
  original bitmap-font face for speech exists; substitute is acceptable.
- In-game speech bubble (`cutscenePlayer.ts:67-72,145-165`) — faithful to
  `displaySpeechInGame`; no change.

3 fixable cosmetic items (title lifecycle, cutscene speech placement, stage floor);
the briefed "bundle cutSceneStage backdrop" is a non-issue (1×1 placeholder).

cutscene-visual | ITEMS=3
- title fade-in/hold-150/fade-out + gold rgb(204,204,0) (objCutSceneTitle vs cutscenePlayer.ts:106-111)
- cutscene speech: float bare text above the speaker's head, drop the bottom caption bar (modThespian.displaySpeechCutScene vs cutscenePlayer.ts:113-123)
- stage floor at bottom-16 (×2-adjusted) instead of viewH*0.6 (cutSceneMaster pStageFloorHeight vs thespian.ts:121)
