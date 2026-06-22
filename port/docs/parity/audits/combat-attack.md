# Combat / Attack Fidelity Audit — ATTACK + GETTING-HIT pipeline

Scope: the player + CPU melee/ranged attack cadence and the getting-hit (damage application +
invincibility) path. Compares the TypeScript port (`port/src/`) against the original Lingo
(`casts/`). **No source files were edited.** Citations are `file:line`.

## Pipeline map

| Stage | Port | Original |
| --- | --- | --- |
| Player attack trigger | `control.ts` `PlayerControl.update` (244-246) → `tryMelee` (324-346) / `castMagic` | `objAiPlayer.playerAttackCharge` (265-289) → `objAiAttack.attack` (37-54) → `attackMelee` (65-68) |
| CPU attack trigger | `control.ts` `CpuAI.updateMoveToAttack` (553-570) → `attack` (617-727) | `objAiCPU` mode FSM (proximity-gated) |
| Cooldown gate | `weapon.ts` `WeaponManager` counters (272-355), `Counter` (`counter.ts`) | `modWeaponManager` `pCooldownCounters` + `Counter()` |
| Melee area resolution | `teams.ts` `impactMeleeAttack`/`impactAreaAttack` (262-294) + `meleeHitFn` (298-305) | `teamMaster.impactMeleeAttack` (1041-1123) |
| Bullet hit | `projectile.ts` `Projectile.update` (97-133) | `objBullet.updateFly` + `modExploder` `#bulletCollidedWithTarget` |
| Damage application | `combat.ts` `Energy.takeHit` (33-53) / `loseEnergy` (85-100) | `modEnergy.takeHit` (267-282) / `loseEnergy` (187-209) |
| Hit feedback / i-frames | `hurt.ts` `Hurt.takeHit` (38-54) | `modReel.takeHit` (108-114), `modInvince` (pickups only) |

---

## BUG 1 — Player melee will not swing unless a target is in reach (SHOULD swing into empty air)

**Report:** "Melee swings even when nothing is in reach." The user actually has the OPPOSITE
symptom of what the title implies — the port currently *refuses* to swing into empty air; the
report is about the reach-gate being wrong vs the original.

**Port behavior** — `port/src/components/control.ts:324-329`:
```ts
private tryMelee(attack: AttackData, m: Movement, wm: WeaponManager): void {
  if (!wm.cooldownFinFor(attack.name)) return;                 // per-weapon cooldown gate (OK)
  const target = game.teamMaster.findTarget(this.entity).obj;
  if (!target) return;                                         // <-- DIVERGENCE: no target -> no swing
  const p = target.send("getPos") as { x: number; y: number };
  if (Math.hypot(p.x - m.x, p.y - m.y) > attack.reach) return; // <-- DIVERGENCE: out of reach -> no swing
  ...
```
So the player's animated swing only ever plays when a hostile already sits inside `reach`
(≈12 px for `#punch`). With nothing nearby, holding fire produces NO swing animation at all.

**Original behavior** — the player swing is gated ONLY by input + cooldown; there is no
target/reach precondition anywhere in the player trigger path:
- `casts/script_objects/objAiPlayer.txt:265-289` `playerAttackCharge` — "#melee and #ranged will
  autofire", calls `me.attack()` unconditionally.
- `casts/script_objects/objAiAttack.txt:37-54` `attack` — first line is `if
  me.pCharacterPrg.getCooldownFin() = false then return`, then `case ...#melee: me.attackMelee()`.
  No reach test.
- `casts/script_objects/objAiAttack.txt:65-68` `attackMelee` — just plays the swing anim
  (`ensureMode(animType)` + `ensureMode(#attack)`); never consults a target.
- The player has no target concept: `objAiPlayer.txt:49-51` `getTarget` returns
  `#notApplicableToPlayer`, and the only target-died guard `performAttack` (objAiAttack.txt:297-301)
  checks `getTarget() = #none`, which is never true for the player.

The hit RESOLUTION (`teamMaster.impactMeleeAttack`) is itself area-based: a swing with nothing in
range simply hits nobody. So the original swings the animation on every cooldown-ready frame fire
is held, landing damage only on whatever overlaps the strike rect.

> Note the inverse asymmetry: the **CPU is correctly proximity-gated** in the port
> (`control.ts:568` `if (this.targetInReach(d)) ... this.attack(...)`), matching `objAiCPU`. So the
> port has the gate on the wrong actor: enemies gate (correct), the player gates (wrong).

**Severity:** Medium. Cosmetic/feel divergence (no missing/extra damage), but it changes the
swing-animation cadence the player sees and breaks "swinging into empty air" — a visible parity gap.

**Fix sketch:** In `tryMelee`, drop the `findTarget`/reach early-returns. Keep only the cooldown
gate, then unconditionally play the swing + run `impactMeleeAttack` (which no-ops on an empty area)
+ `resetCooldown` + `meleeT = MELEE_FRAMES`. Facing should come from the cursor/auto-aim `aimLeft`
already computed in `update` (line 198), not from a (possibly null) target. i.e.:
```ts
private tryMelee(attack, m, wm) {
  if (!wm.cooldownFinFor(attack.name)) return;
  m.facingLeft = this.aimLeft;
  const base = meleeBasePower(attack, effStrength);
  game.teamMaster.impactMeleeAttack(this.entity, meleeHitFn(...));   // hits whoever overlaps, or nobody
  wm.resetCooldownFor(attack.name);
  this.meleeT = MELEE_FRAMES;
  ...play sound...
}
```

---

## BUG 2 — Melee swing cadence: is multi-hit possible per swing?

**Report:** "Melee hits more than once / on too many frames. A single swing should connect ONCE."

**Port behavior:** A swing fires `impactMeleeAttack` exactly ONCE per `tryMelee` call
(`control.ts:341`), and re-fire is gated by the per-weapon cooldown counter:
- The re-swing gate is `wm.cooldownFinFor(attack.name)` (`control.ts:325`) + `resetCooldownFor`
  on fire (`control.ts:342`).
- `Counter` math (`weapon.ts:272-278`, `counter.ts:25-42`): counter built with
  `hi = attack.cooldown`, `inc = agility (1 for player)`, starts `fin = true`. On fire,
  `reset()` → `count = 1, fin = false`; each tick `once()` adds 1 until `count >= hi` → `fin`.
  So recovery ≈ `hi - 1` frames.
- `#punch` `cooldown = 20` (confirmed `casts/data/act_player.txt:14`, present in
  `port/src/generated/data.json`) ⇒ **~19-20 frames between swings**. `#merlinSword`/`#warriorSword`
  `cooldown = 0` ⇒ `Counter(hi=0, inc=1)`; `reset()` sets `count = 1` then `step()` immediately
  latches `fin` on the next tick (and `lo==hi` path in `counter.ts:33` short-circuits when
  `hi <= lo`), so the sword re-fires as fast as the swing anim allows — **gated only by
  MELEE_FRAMES = 6** (`control.ts:31,343`).

**Original behavior:** Identical cadence model. `modWeaponManager` `pCooldownCounters[weapon]`,
`c.tim[2] = cooldown`, `c.inc = agility`, `fin = true`, advanced once/frame by `updateCooldowns`
(`CounterOnce`); reset on fire in `objAiAttack.performAttack`. Punch=20, swords=0. The original's
swing damage actually fires inside `objAiAttack.updateAttack` (389-414) **on each attack-FRAME**
(`isOnAttackFrame`, modAttack.txt:577-621, deduped only by `getAnimFrameFresh`) — but the basic
weapons each declare a SINGLE `#animFrame` (punch `3`), so in practice it lands **once per swing**,
same as the port.

**Verdict: NO BUG in the port for the basic weapons.** The port's once-per-call + cooldown gate is
faithful and is actually *more* robust than the original (the original would multi-hit if a weapon's
`#animFrame` were a list; the port can't, because it fires once per `tryMelee`). The swing interval
matches: punch ~20 frames, sword bounded by the 6-frame anim.

**Caveat / latent divergence (severity Low):** Because the port resolves the swing as a single
instantaneous area query at the moment `tryMelee` fires (rather than on the anim's attack-frame),
the strike lands on the FIRST cooldown-ready frame rather than mid-animation. Visually the damage
can precede the visible swing apex by a few frames. Not a multi-hit, just a timing-phase offset; fix
only if frame-accurate swing timing is required (would need to gate `impactMeleeAttack` on
`meleeT == MELEE_FRAMES - <animFrame offset>`).

The likely SOURCE of the user's "hits too many times" perception is **BUG 3** (the getting-hit side)
and/or the multi-target area sweep being read as multi-hit — see below.

---

## BUG 3 — Player has post-hit invincibility frames the original does NOT have

**Report:** "Getting-hit bugs / multi-frame hits — can a unit take damage repeatedly from one
attack across frames?"

### 3a. Player i-frames are a port INVENTION (the original has none) — severity High

**Port behavior:** The player is spawned with `invince: 18` (`port/src/entities/archetypes.ts:139`,
`spawnPlayer`):
```ts
invince: 18, // brief i-frames so overlapping enemies can't chain-kill
```
`Hurt.takeHit` arms these on every damaging hit (`hurt.ts:46`): `if (this.invinceFrames > 0)
this.invinceT = this.invinceFrames;`, and `Energy.takeHit` early-returns while invincible
(`combat.ts:34`: `if (this.dead || this.entity.send("isInvince")) return;`). So after ANY hit the
player is damage-immune for 18 frames.

**Original behavior:** **There is no post-hit invincibility in the original.** A full grep of
`casts/` shows `modInvince.startTempInvince` is called ONLY from pickups
(`objPlayerMerlinCharacter.txt:153,170,199` — medikit/scroll/potion), granting a 200-frame window
(`modInvince.txt:30`). No `takeHit`/`loseEnergy`/`takeDamage` path ever starts invincibility.
The original's only post-hit damage gate is `#recoil` mode (`modEnergy.takeHit:272` early-returns
while `getMode() = #recoil`), and recoil is config-driven (`modReel` `pRecoil`/`recoilDuration`) —
**Merlin is never put into recoil OR reel**: `objPlayerMerlinCharacter.goMode:130` refuses `#reel`,
and its `takeHit` override (233-236) forces `goMode(#walk)` after the ancestor call. So in the
original the **player has zero i-frames and zero reel/recoil immunity** — overlapping enemies CAN
damage Merlin every frame they connect (each enemy gated only by its own weapon cooldown).

**Consequence:** The port makes Merlin substantially tankier than the original. With 18-frame
i-frames, a swarm can land at most ~1 hit / 18 frames on the player; the original allows each
enemy's cooldown-gated swing to land in full. This is a balance/fidelity divergence in the player's
favor.

**Severity:** High (changes effective player survivability / incoming DPS vs the original).

**Fix sketch:** Remove `invince: 18` from `spawnPlayer` (`archetypes.ts:139`) → player
`invinceFrames = 0`, so `Hurt.takeHit` never arms `invinceT` and `Energy.takeHit`'s invince gate is
never set by a hit (pickups still grant the real 200-frame `grantInvince`). To stay faithful to the
"never chain-locked" intent WITHOUT i-frames, rely on the original's actual mechanism: the per-hit
knockback (Movement) separating overlapping bodies, and each attacker's own cooldown. If a
recoil/reel-immunity is wanted for the player, model the original's `goMode(#walk)`-override
(player simply never enters dazed), which the port already does via `isHurt`/`flashT` — but note
`flashT = 6` (`hurt.ts:45`) currently freezes player input for 6 frames on every hit (the "reel
window" at `control.ts:160-164`); the original player is NOT input-locked on hit (it forces
`#walk`), so this 6-frame input-lock is a SECONDARY divergence (see 3c).

### 3b. Bullet "already hit" guard — CORRECT (no bug) — severity None

**Port:** A plain bullet calls `this.finish(...)` immediately after applying `takeHit`
(`projectile.ts:128`) and `break`s the loop; `finish` latches `done` idempotently
(`projectile.ts:79-88`). A splash bullet `detonate`s once then finishes (`projectile.ts:70-75,117`).
So one bullet cannot re-hit across frames.

**Original:** Matches — `objBullet` dies on first contact via `#bulletCollidedWithTarget` →
`modExploder` `die()`; splash bullets detonate once on land. No per-bullet hit-set, none needed.

### 3c. Player input-lock on hit (`flashT = 6`) — minor divergence — severity Low

`Hurt.takeHit` sets `flashT = 6` (`hurt.ts:45`) and `PlayerControl.update` freezes intent + skips
input while `isHurt()` (`control.ts:160-164`). The original player is NOT staggered/locked on hit
(`objPlayerMerlinCharacter` forces `#walk` and refuses `#reel`). So the port briefly removes player
control on each hit where the original keeps it. Minor feel divergence; couple the fix with 3a.

---

## ADDITIONAL divergences found

### A. Melee reach: port uses a Euclidean radius; original uses point-in-rect — severity Low/Med

The original melee hit test is point-in-rect: `calcAttackHitMelee` (modAttack.txt:287-303) tests
`calcAttackLoc().inside(targetRect)` — the strike point against each candidate's bounding rect,
where `#reach` is a `point(x,y)` rect inflation (punch `point(7,10)`). The port collapses the point
reach to a scalar radius via `Math.hypot` (`weapon.ts:171`, `archetypes.ts:143` `targetReach: 18`)
and does a circular disc test (`teams.ts:283` `(p.x-cx)^2 + (p.y-cy)^2 <= radius2`). Result: the
port's melee reach is a symmetric circle of radius ≈ `hypot(7,10) = 12.2` (or the configured 18),
whereas the original is an asymmetric rect centered on the offset `collisionLoc` (`point(9,-1)` for
punch). Targets directly above/below vs left/right are reached differently in the original. Minor
geometry divergence; can matter at the edge of range and against tall/wide actors.

### B. Melee strike is centered on the attacker, not on the offset attack-loc — severity Low

The original strikes at `calcAttackLoc()` = attacker pos + `#collisionLoc` offset (punch
`point(9,-1)`), shifted by facing — i.e. the swing reaches OUT in the facing direction. The port
centers the disc on the attacker's own position (`teams.ts:292-293` `impactMeleeAttack` uses
`attacker.getPos()` as center, no facing offset). So the port's swing is symmetric around the body
instead of projected forward. Combined with (A), the port's melee is a body-centered circle vs the
original's forward-projected rect. Low severity (reach is small), but it means the port can hit
something slightly behind the player that the original would miss, and may under-reach directly
ahead.

### C. `#magicMelee` mana-scaled strength applied on the player only — verify parity — severity Info

`control.ts:337-339` scales effective strength for `#magicMelee` by
`(strength + 1.5·manaCapacity)/1.5` (energyPunch). The enemy melee path (`control.ts:718`) uses
plain strength with no `#magicMelee` branch. If any ENEMY carries a `#magicMelee` attack this would
under-scale it vs the original's `calcCollisionVectMelee`. Confirm no enemy uses `#magicMelee`
(player-only in this game) — if confirmed, this is fine; flagged for completeness.

---

## Summary table

| # | Title | Severity | Port locus | Original locus |
| --- | --- | --- | --- | --- |
| 1 | Player melee won't swing into empty air (reach-gated) | Med | control.ts:327-329 | objAiAttack.txt:37-68 |
| 2 | Melee per-swing cadence (punch ~20f / sword 6f) | None (faithful) | control.ts:325,341-343 | modWeaponManager + Counter |
| 3a | Player has 18f post-hit i-frames the original lacks | High | archetypes.ts:139, hurt.ts:46, combat.ts:34 | modInvince (pickups only); modEnergy.txt:272 |
| 3b | Bullet single-hit guard | None (faithful) | projectile.ts:128,79 | objBullet/modExploder |
| 3c | Player input-locked 6f on hit | Low | hurt.ts:45, control.ts:160-164 | objPlayerMerlinCharacter goMode#walk |
| A | Melee reach: disc radius vs point-in-rect | Low/Med | teams.ts:283, weapon.ts:171 | modAttack.txt:287-303 |
| B | Melee centered on body, not forward attack-loc | Low | teams.ts:292-293 | modAttack.txt:185,calcAttackLoc |
| C | `#magicMelee` mana-scale player-only (verify) | Info | control.ts:337-339,718 | calcCollisionVectMelee |
