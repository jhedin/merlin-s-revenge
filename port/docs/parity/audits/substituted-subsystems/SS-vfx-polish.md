# SS-vfx-polish — Combat VFX render-gap audit + PLAN (read-only investigation)

Scope: the four cosmetic VFX subsystems named in the spec — (1) caster charge orb, (2) explosion/
splash bursts, (3) freeze/glow overlays, (4) reel strips. Each item is traced in both trees. Only
the **real** gaps get a fix sketch; the already-faithful ones are called out and left alone.

Asset facts below are from the port's bundled anim index `port/src/generated/assets.json` (verified
present/absent per strip).

---

## ITEM 1 — Charge orb over CPU/ENEMY caster heads — **REAL GAP**

### Original
Every magic caster — player OR CPU — runs the SAME `objAiAttack` charge lifecycle. There is no
player-only branch:

- `objAiCPU.attack` (`casts/script_objects/objAiCPU.txt:33-40`): a `#magic` attack falls straight
  through to `ancestor.attack()`.
- `objAiAttack.attack` → `attackMagic` → `chargeMagic` (`casts/script_objects/objAiAttack.txt:37-54,
  61-63, 126-130`):
  ```
  on chargeMagic me
    me.pCharacterPrg.ensureMode(#charge)   -- play the #charge wind-up strip
    me.ensureSpell()                       -- SPAWN the objSpell over the head (if none yet)
    me.chargeSpell()                       -- grow it this tick
  ```
- `ensureSpell` (`objAiAttack.txt:157-188`) spawns the `#spell` actor at `calcChargeLoc()` (over the
  head) the moment the magic attack begins, and `chargeSpell` (`:132-142`) calls
  `currentSpell.charge(chargeAmount, calcChargeLoc())` **every charge tick** — the orb grows over the
  head until `pChargeCounter.fin`, which fires `#spellCharged` and only THEN releases it
  (`objAiCPU.txt:245-252` → `releaseMagic`).
- `objSpell.charge/align/calcSize` (`casts/script_objects/objSpell.txt:110-121, 75-80, 90-108`): the
  orb's size = `pCurrentCharge·chargeSize` and it sits at `point(0,-size/2)` over the head (`#top`).
- Inheritance confirmed: `objAiCPUSpellCaster.new` → `new(script "objAiCPU")` → `new(script
  "objAiAttack")`. CPU casters inherit the orb path unchanged.

So in the original, mageOrc / darkMage / necromancer / greyGhost all show a **growing charge orb over
their head during the entire wind-up**, released to fly only when fully charged.

### Port
The player path is faithful: `PlayerControl.update` calls `ensureSpell(...).setCharge(...)` **every
tick while charging** (`port/src/components/control.ts:246-248`, `ensureSpell` at `:303-312`), so the
orb spawns and grows over Merlin's head.

The CPU path is NOT. `CpuAI` has no charge-time spell spawn at all. A caster's wind-up only drives the
`#charge` ANIM strip (`CpuAI.attackAction` `port/src/components/control.ts:562-577`) — there is no
`spawnSpell` during the wind-up. The spell actor is created only inside `performAttack`, at the
charge→release transition, and is `setCharge`+`release`d in the SAME call (the damage/summon casters
at `control.ts:855-858` and `:876-879`). i.e. the orb springs into existence already flying; it never
grows over the head.

`grep spawnSpell` confirms: the only CPU `spawnSpell` sites are inside `performAttack`
(`control.ts:855`, `:876`); none in the charge/wind-up path.

### Fix sketch
Mirror the player's `ensureSpell`/`setCharge` in `CpuAI` during the `#charge` wind-up (the
`attackT > 0`, pre-release window for a `magic` weapon whose char has a `_charge` strip), and RELEASE
that same actor on the charge→release transition instead of spawning a fresh one:

1. Add a `private spell: Entity | null = null` to `CpuAI` (+ clear it in `init`/`reset`).
2. In `CpuAI.attack` (when `getCurrentAttack().type === "magic"` and not streaming), spawn the orb
   over the head and stash it in `this.spell` (team/allegiance/hits exactly as `performAttack`'s
   spawn-spell branches build them today — factor that into a small `private ensureCpuSpell(ca)` like
   the player's `ensureSpell`).
3. In `updateAttack`, while `releasePhase === false` and the `#charge` strip is playing, each tick
   call `this.spell.get(SpellActor).setCharge(growingCharge, mz.x, mz.y)` so it grows over the head.
   The "growingCharge" can ramp `chargeStartOf → chargeMaxOf` across the strip's frames (cosmetic only
   — the released magnitude still uses the final `chargeMaxOf` as today).
4. In the existing release branches (`control.ts:855-858`, `:876-879`), REPLACE the
   `spawnSpell(...); sa.setCharge(...); sa.release(...)` with: if `this.spell` exists, just
   `sa.setCharge(final); sa.release(...); this.spell = null;`. Keep the `spawnSpell` as a fallback for
   the no-charge-strip path (so a caster whose char ships no `_charge` strip still fires).
5. Discard `this.spell` on death/daze/target-loss (`characterModeChanged` → `#dazed`, `isDead`) via
   `SpellActor.discard()`, exactly like `PlayerControl.update`'s death branch
   (`control.ts:170-171`), so an interrupted wind-up doesn't strand a frozen orb (it never
   releases/finishes, so `sweepSpells` would never reap it).

Art is bundled for all four casters (`_charge` strips present): `darkMage_charge`, `mageOrc_charge`,
`necromancer_charge`, `greyGhost_charge`. The orb itself is the shared `spell_charge` art already
rendered by `drawSpells` (`port/src/main.ts:573-623`), so no new asset work — purely spawning + growing
the existing actor during the CPU wind-up.

---

## ITEM 2 — Explosion / splash bursts

### 2a — Splash bullets — FAITHFUL (the just-landed fix)
`Projectile.detonate` (`port/src/components/projectile.ts:79-92`) resolves the splash, then if a
`<char>_explode` strip exists sets `exploding=true` and plays the burst in place (`update` `:131-136`,
drawn by `drawBullets`→`drawBulletSprite(..., "_explode", false)` in `port/src/main.ts:650-651`). A
char with no explode strip retires immediately. Correct.

### 2b — Mine detonations (pitMonster / fire / auras) — FAITHFUL
`Mine.detonate` (`port/src/components/mine.ts:111-120`) resolves the splash, sets `mode="explode"`, and
holds for `explodeTicks()` (the `<char>_explode` strip length); `Mine.animAction` (`:65`) returns
`"explode"` so `Anim` plays the `<char>_explode` strip. All re-arming mines have the strip bundled:
`pitMonster_explode`, `fire_explode`, `iceAura_explode`, `orcAura_explode`, `snowAura_explode`,
`quadAura_explode`, `undeadAura_explode`, plus single-shot `energyMine_explode`. Correct — the Mine
now plays `#explode` with a real burst.

### 2c — Beam impacts — **REAL GAP**
The original energyBeam is `#type:#explode` and runs an explode at impact: `act_energyBeam`
(`casts/data/act_energyBeam.txt`) sets `#type:#explode`, `#explodeEvents:[#bulletArrivedAtTargetLoc,
#bulletLanded]`, `#explodeSound:"spell_release"`; modExploder `goMode(#explode)` resets the `#explode`
strip at impact. The bundled `energyBeam_explode` strip EXISTS in the port's index.

The port's beam path resolves damage but plays NO burst sprite. `Projectile.update`'s beam branch
(`port/src/components/projectile.ts:121-128`) calls `resolveSplash` on the first frame and then just
lingers `beamLife` frames rendering the stretched line (`beamSprite` in `port/src/main.ts:688-708`).
It never sets `exploding`/plays `energyBeam_explode` at the impact end. So a beam hit shows the
stretched beam line but no detonation burst at the target.

#### Fix sketch
At the beam's impact frame (`projectile.ts:122` first-frame block, after `resolveSplash`), if a
`<this.char>_explode` strip exists (char is `"energyBeam"` for the beam), spawn/flag a one-shot burst
at the target `(m.x,m.y)`. Two equivalent options:
- Reuse the existing splash-burst machinery: keep the beam bullet alive in an `exploding` state at the
  target loc for the `energyBeam_explode` strip length and let `drawBullets`'s `exploding` branch draw
  it (`main.ts:650-651`). The line is already drawn separately by `beamSprite`; gate the line on the
  pre-impact frames and the burst on the post-impact frames.
- Or emit a tiny dedicated burst entity at the target. The first option reuses `drawBulletSprite(...,
  "_explode", false)` with no new plumbing.

energyPulse (the other streaming spell) fires `fireSplashBullet` per shot (`control.ts:297`) and
those are ordinary splash bullets — they already go through 2a, and `energyPulse_explode` is bundled,
so energyPulse impacts already burst. Only the BEAM is missing the burst.

### 2d — Spell explodes (grow-fly-explode objSpell) — MINOR GAP (note only)
This is NOT a missing `<char>_explode` strip: in the original the spell's explode REUSES the orb.
`objSpell.goMode(#explode)` (`casts/script_objects/objSpell.txt:145-161`) grows `pCurrentCharge ×=
chargeExplodeFactor` and `startQuickFade`s, and `getAnimSym` maps `#explode → #charge`
(`objSpell.txt:167-176`) — so the visible explode is the SAME orb sprite, grown to the explode radius
and quick-fading out at the landing loc (a brief expanding flash), not a separate burst sheet.

The port collapses this: `SpellActor.explode` (`port/src/components/spellActor.ts:117-147`) resolves
the radial hit and sets `this.done = true` immediately (`:146`, "collapses startQuickFade to an
immediate finish"). The orb therefore VANISHES on arrival instead of showing the grown quick-fade
flash. This is a small cosmetic deviation (a missing landing flash), not a missing-art bug.

Optional fix (low priority): give `SpellActor` a short post-explode fade state instead of
`done=true` — on `explode()`, set `charge ×= chargeExplodeFactor`, switch to a `fade` mode for ~N
frames, and have `drawSpells` (`main.ts:573-623`, which already scales the orb by `size()` and tints
it) render the grown orb with a falling alpha before `isFinished()` returns true. `drawSpells` would
need an alpha from the fade progress; the size already comes from `sa.size()`.

---

## ITEM 3 — Freeze / glow overlays — FAITHFUL (verified, no re-spec)

Confirmed the freeze tint and low-health red glow both route through the real `setSpriteColour`
equivalent (`ColourTransform`), not a bespoke overlay box:

- Freeze: `Freeze.takeFreeze` (`port/src/components/freeze.ts:30-40`) calls
  `ColourTransform.glowTeal()`; `colourTransformFin` (`:45-48`) re-arms it each tick so the teal HOLDS
  for the whole freeze (modFreeze's non-pingpong glowTeal finishes in ~1 tick otherwise); `update`
  (`:54-63`) calls `stopGlowTeal()` on defrost. Matches modFreeze `glowTeal`/`stopGlowTeal`.
- Low-health red: `Energy.glowRedOnLowHealth` (`port/src/components/combat.ts:57-61`) arms
  `glowRed()` below 50% (`GLOW_RED_PCT`), re-armed on `colourTransformFin`, stopped by
  `increaseEnergy`/`takeHeal` once back above threshold. Matches modEnergy glowRedOnLowHealth.
- The combined low-health-while-frozen case demotes to `glowRedAndTeal` (`colourTransform.ts:133-159`).
- The tint reaches the renderer through `Anim.sprite()`'s `getColourTransform()` read
  (`port/src/components/anim.ts:208-212`), applied as the sprite tint. `main.ts:404-406` explicitly
  notes there is NO separate freeze overlay box — the entity's own tinted sprite IS the freeze visual,
  faithful to the original (no freeze-overlay object exists).

No fix needed.

---

## ITEM 4 — Reel strips on non-lethal hits — FAITHFUL (mechanism), data-gated per actor

The reel mechanism is correctly wired for EVERY actor: `Hurt.takeHit` sets `flashT = 6` on a
non-lethal hit (`port/src/components/hurt.ts:43-63`) and `Hurt.animAction` returns `"reel"` while
`flashT > 0` (`:80`). `Anim.pickAction` consults `animAction` (`port/src/components/anim.ts:127-129`),
and `animFor` falls back to `_stand` when a `_reel` strip isn't bundled (`:184-187`). So an actor with
a `_reel` strip plays it on every non-lethal hit; one without simply holds stand (faithful — a char
with no reel strip never reeled in the original either).

Spot-check against bundled `_reel` strips (46 total in the index):
- `warrior_reel` — present → warrior reels. Verified the strip exists.
- `archer_reel` — present → archer reels. Verified.
- `skelitonFootSoldier_reel`, `ninja_reel`, `darkMage_reel`, `greyGhost_reel` — present.
- `blackOrc_reel`, `swordOrc_reel`, `mageOrc_reel`, `mer_reel` — ABSENT → these correctly fall back to
  stand (no reel art was dumped for them; matches the original having no such strip). This is NOT a
  port gap — it is faithful absence of art.

No fix needed. (`reelProof` actors like skelitonHead correctly suppress the strip via
`Hurt.takeHit`'s `reelProof` guard, `hurt.ts:49`.)

---

## SUMMARY OF REAL GAPS

| # | Gap | Original (file:line) | Port (file:line) | Fix |
|---|-----|----------------------|------------------|-----|
| 1 | CPU/enemy casters show NO growing charge orb during wind-up | `objAiAttack.txt:126-130, 157-188` (ensureSpell/chargeSpell, inherited by objAiCPU) | `control.ts` CpuAI: no charge-time `spawnSpell`; spell only created+released in `performAttack` `:855, :876` | spawn the orb in `CpuAI.attack`, grow with `setCharge` each wind-up tick, release the same actor; discard on daze/death |
| 2c | Beam impacts show no detonation burst | `act_energyBeam.txt` (#type:#explode, #explodeEvents) + modExploder goMode(#explode) | `projectile.ts:121-128` beam branch resolves damage, never plays `energyBeam_explode` (strip IS bundled) | flag `exploding` at impact and draw `energyBeam_explode` via the existing burst path |
| 2d | Spell (grow-fly-explode) landing flash missing | `objSpell.txt:145-161` (grow ×chargeExplodeFactor + startQuickFade, getAnimSym explode→charge) | `spellActor.ts:117-147` sets `done=true` immediately — orb vanishes, no quick-fade flash | (optional/low) add a short post-explode grown-orb fade state rendered by `drawSpells` |

Faithful (no change): splash-bullet bursts (2a), mine detonations (2b), freeze tint + low-health red
glow (3), reel strips (4).

SS-vfx | GAPS=3
1) CPU casters spawn/grow no charge orb during the #charge wind-up; 2c) beam impacts play no
energyBeam_explode burst; 2d) grow-fly-explode spells skip the grown-orb quick-fade landing flash.
