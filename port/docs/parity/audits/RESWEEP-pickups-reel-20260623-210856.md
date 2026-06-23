# RESWEEP — Pickups/Powerups + Knockback/Reel (2026-06-23)

Reproduction audit (drove every pickup + a hit end-to-end against the REAL bundle via the test
harness; derived "correct" from `casts/`). Two systems prior agents never reproduced.

Probes (gitignored, left in place): `tools/_audit_resweep_pickups.ts`, `_audit_resweep_reel.ts`,
`_audit_resweep_tally.ts`.

---

## SUBSYSTEM A — PICKUPS / POWERUPS

### Cast magnitude table (verified, the "faithful" numbers)

| Pickup | objType | effect (cast) | cast file:line | collectSound |
|---|---|---|---|---|
| medikit | objMedikit | bank 1 gradual kit (+1/5f, refills to maxEnergy) **+** flat +25 | objPlayerMerlinCharacter:152-160 | collect_powerup_01 (act_medikit:6) |
| maxikit | objMedikit | INSTANT full heal `increaseEnergy(max-energy)`, NO bank, NO +25 | objPlayerMerlinCharacter:152-159 | collect_powerup_01 (act_maxikit:6) |
| walkSpeed | objPotion | `incWalkAcceleration(#potion)` accel += **0.3** (base 2 → +15%) | modNavMode:58-66, modNavMode:21 | **collect_powerup_02** (act_powerUp:6) |
| manaCapacity | objPotion | capacity += **0.75** | modCharacterAttackProperties:42,178 | **collect_powerup_02** |
| manaFlow | objPotion | flow += **0.5** | modCharacterAttackProperties:43,194 | **collect_powerup_02** |
| manaBurst | objPotion | burst += **0.75** | modCharacterAttackProperties:41,164 | **collect_powerup_02** |
| scroll/sword | objScroll | addWeapon + flat +25 | objPlayerMerlinCharacter:163-172 | collect_powerup_01 (act_*Scroll/sword:*) |
| any pickup | — | `startTempInvince` = **200f** invince | modInvince:34, objPlayerMerlinCharacter:153/170/199 | — |
| any potion/scroll/medikit (not maxikit/gmg) | — | flat **+25** `increaseEnergy(pBonusEnergy)` | objPlayerMerlinCharacter:54,156,166,200 | — |

Sound rule (cast): **only the 4 potions (objType objPotion) play `collect_powerup_02`** (inherited
from act_powerUp:6 via objPowerUpWriting.collected → `me.pCollectSound`, objPowerUpWriting:42).
Everything else (medikit/maxikit + all scrolls/sword/gmg/summons) overrides to `collect_powerup_01`.

Tally rule (cast): the "POTIONS DRUNK" counter (`g.potionMaster.potionCollected`) is bumped **only by
objPotion** (objPotion:28 → player.potionCollected → objPlayerMerlinCharacter:202). objMedikit
(objMedikit:12 → medikitCollected) and objScroll (objScroll:35 → newScrollCollected) do **not** touch
the potion tally.

### CLEAN (verified end-to-end, with numbers)

- Heal/maxikit/mana magnitudes all correct: medikit banks 1 kit + +25 (20→45); maxikit full top-up
  (10→200, no bank, no gold glow); manaCapacity +0.75, manaFlow +0.5, manaBurst +0.75; walkSpeed
  maxSpeed 4→4.6 (=+15%, faithful to the port's documented maxSpeed-cap model of the cast's
  accel 2→2.3). +25 energy + 200f invince on every collect. (probe `_audit_resweep_pickups.ts`.)
- Temp-invince = exactly 200 frames; white pulse on, stops at expiry (test/pickup.test.ts green).
- "extra-life pickup": correctly ABSENT. modExtraLives is NOT in the player's module list
  (objPlayerMerlinCharacter:35-44) and `hairGem`/`lifePowerUpCollected` is dead Merlin-hair-game code
  in objPowerUp (never spawned in Merlin's Revenge). Not a gap.
- "maxikit bigger stockpile": NOT a cast behavior — maxikit's branch is instant-heal only, banks
  nothing. Port matches (no medikitCollected call). Not a gap.

### GAP A1 — 4 potions play the WRONG collect sound (collect_powerup_01 instead of 02)

- **Mechanic:** pickup collect sound.
- **Cast:** act_powerUp.txt:6 `#collectSound: "collect_powerup_02"` → inherited by walkSpeed/
  manaCapacity/manaFlow/manaBurst (objType objPotion); played at objPowerUpWriting.txt:42.
- **Port:** `src/components/pickup.ts:65` hardcodes `game.audio?.play("collect_powerup_01")` for ALL
  pickups.
- **REAL gap:** the 4 potion pickups (speed/manaCapacity/manaFlow/manaBurst) play
  collect_powerup_01; cast plays collect_powerup_02. (`collect_powerup_02` IS bundled —
  generated/assets.json:32898 — just never requested.) Confirmed by probe: all 4 show
  `*** MISMATCH ***`. Scrolls/medikits already correctly want 01.
- **FIX SKETCH:** in `pickup.ts` `apply()`, choose the sound by type. Replace line 65 with:
  ```ts
  const sound = (this.effect === "speed" || this.effect === "manaCapacity"
    || this.effect === "manaFlow" || this.effect === "manaBurst")
    ? "collect_powerup_02" : "collect_powerup_01";
  game.audio?.play(sound);
  ```

### GAP A2 — "POTIONS DRUNK" tally over-counts (medikits/scrolls/sword/gmg wrongly counted)

- **Mechanic:** potionMaster "POTIONS DRUNK" per-type tally.
- **Cast:** only objPotion bumps it (objPotion.txt:28 → objPlayerMerlinCharacter.txt:202
  `g.potionMaster.potionCollected`). objMedikit (objMedikit.txt:12) and objScroll (objScroll.txt:35)
  call medikitCollected / newScrollCollected and NEVER `potionCollected`.
- **Port:** `src/components/pickup.ts:75` calls `game.potionMaster?.potionCollected(this.effect)`
  unconditionally for EVERY effect.
- **REAL gap:** probe `_audit_resweep_tally.ts` shows `heal`, `spell`, `sword`, `gmg` each create a
  potion record — the tally (persisted in the save, addSaveData) is polluted; when the "POTIONS DRUNK"
  HUD row is rendered it will show medikits/scrolls as potions drunk, with wrong icon rows. (Currently
  latent because the display widget is render-only / not yet drawn, but the saved count is already
  wrong and survives reload.)
- **FIX SKETCH:** gate the call to the 4 real potions only. Replace line 75 with:
  ```ts
  if (this.effect === "speed" || this.effect === "manaCapacity"
    || this.effect === "manaFlow" || this.effect === "manaBurst")
    game.potionMaster?.potionCollected(this.effect);
  ```
  (Keying by the port effect-name "speed" mirrors the cast key "walkSpeed"; the display icon lookup is
  per-type so the key string just needs to be consistent.)

---

## SUBSYSTEM B — KNOCKBACK / REEL — CLEAN

Knockback model is a *documented px-scale divergence* (KNOCK_SCALE 0.4 / KNOCK_MAX 5 /
KNOCK_FRICTION 0.78, movement.ts:14-18) — re-examined as a suspect per the charter; it preserves the
cast's vector/direction/inertia-proportionality (objGameObject.takeHit:781-785 `vect·(100-inertia)/100`
then vectAdd; objMoveXY friction-decays per frame). Faithful adaptation, not a magnitude bug.

Verified end-to-end (probe `_audit_resweep_reel.ts`, REAL data):

- **Reel anim on hit:** swordOrc hit → `animAction` returns `"reel"`, `isHurt=true`. ✓
- **reelProof (skelitonHead, act_skelitonHead:28):** with its real inertia (95), a hit gives
  `isHurt=false` (NO reel stagger anim) but `kvx=1.2` → still shoved 4.7px. Matches cast: modReel.takeHit
  gates only `goDamageMode()` (the reel), NOT the knockback (objGameObject applies the shove to every
  unit). ✓  [A first probe that forced `inertia=0` showed a false "reel-on-reelProof": REJECTED — the
  K1 inertia/damage coupling then deals the full 60 to skelitonHead's 10 HP, KILLING it, and a lethal
  hit legitimately enters #die (the `|| dead` branch). Probe artifact, not a bug.]
- **Knockback respects walls:** a 200-magnitude shove into a wall column stops the unit at the wall
  edge (x→249 against a wall at x=256, half-box 7) — no pass-through. ✓
- **Post-hit i-frames:** the player takes a 2nd immediate hit for full damage (170→140). This is
  FAITHFUL — modInvince has no hit-triggered invince; `startTempInvince` fires ONLY on pickup collect
  (the port documents this at archetypes.ts:187-189). Not a gap.

Minor note (NOT filed as a gap): the reel ANIM is a fixed 6 frames (Hurt.flashT=6) whereas the cast's
reel MODE lasts until the unit stalls (knockback velocity < stallSpeed 0.2, objMoveXY:177/187). The
knockback MOTION in the port still decays independently over ~8-10 ticks, so the visible slide length is
right; only the reel-strip playback span is a fixed approximation. Low-priority duration cosmetics.

---

## Summary

GAPS=2 (both in `src/components/pickup.ts`, subsystem A). Knockback/reel CLEAN.
