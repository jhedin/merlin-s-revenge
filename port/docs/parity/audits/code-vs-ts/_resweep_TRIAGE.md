# Re-Sweep + Coupling Triage Summary

The second audit pass (six-lens prompt) over the highest-value files first audited with the weaker
(translation-only) prompt, plus the dedicated coupling-smell audit. This file tracks the resolution of
every finding. Detail lives in the per-cluster `_resweep_*.md` and `coupling-smells.md`.

## Fixed (each with a test, committed per-fix on `claude/lingo-audit-resweep`)

| Finding | Source | Resolution |
|---|---|---|
| Exit-arrow colour keyed off `cleared` set, not the neighbour's hostiles | roomRender A | `roomHasHostiles` (objRoom.getHostile): cleared / pState enemies / unvisited objects-layer `#inf` scan |
| Exit-arrow geometry unilateral | roomRender B | bilateral AND with the neighbour's facing edge (ListCombineExitTiles) |
| Minimap always-on | roomRender C | gated on `game.navMode` (modMiniMap off until goNavMode) |
| Exit-arrow z-order (over actors) | roomRender F | drawn after the active layer, before sprites (baked-into-backgroundActive) |
| Reel-proof units took no knockback | coreEntity GAP-1 | `objGameObject.takeHit` shoves every unit; `#reelProof` gates only the reel stagger |
| Freeze teal glow vanished after ~2 frames | visualFx | Freeze handles `#colourTransformFin`, re-arms glowTeal while frozen (held) |
| Spurious gold glow on every item pickup | damageAttack GAP-3 | the +25 bonus + maxikit route through `increaseEnergy` (no glow), not `takeHeal` |
| Enemy mana-capacity grew at half rate | damageAttack GAP-4 | Mana `capInc` default 1.0 (modCharacterAttackProperties), not 0.5; player still 0.5 via act_player |
| Mute lost on load | gameFlow GAP-6 / coupling #4 | save/restore the sound state (`sound.muted` + `Audio.setMuted`) |
| "Load game" selectable with no save | gameFlow GAP-5 | shadowed when `!hasSave()` |
| Room-clear transition scattered across 2-call sites | coupling #1 | single `RoomManager.onRoomCleared()` choke-point (markCleared + setExits) |
| Player-death dual timer (33 vs 36) | coupling #2 | death resolves on `Anim.stretchDeathDone()` (#stretchDeathFin), not a separate clock |
| Snapshot double-bank ordering invariant | coupling #3 | the leave/current snapshots also filter the `left` flag |

## Deferred (documented, not yet built)

- **Wall-collision damage (damageAttack GAP-1 / coreEntity GAP-2) — REAL gameplay gap.**
  `objCPUCharacter.collisionWall`/`collisionVertical` (objCPUCharacter.txt:103-127): a CPU unit IN REEL mode
  that slams into a wall/ceiling takes `takeDamage(|impactSpeed|)` → `modEnergy.takeDamage` loses
  `(impactSpeed - pDamageSpeed)` energy when `impactSpeed > pDamageSpeed`. So knocking an enemy into a wall
  deals bonus damage. The port's Movement detects the wall contact (`hitX`/`hitY`) and zeroes the knockback
  channel (`kvx`/`kvy`) but applies no damage.
  *Why deferred:* a faithful build needs a damage-ONLY path (`modEnergy.loseEnergy` — energy loss + flickWhite
  + death check, NO knockback/reel re-trigger) AND correct death finalization (grave / `#leaveGame` / XP to the
  knocker via the recorded `lastAttacker`), since the port awards XP in the `takeHit` chain, not on a generic
  dead-detection. Implementing it hastily risks a broken death/XP path. Flagged for a focused follow-up:
  add `Energy.loseEnergy(amount)`, route a death through the same finalization the combat tick uses, and gate
  the wall hit on an active knockback impulse (the port's reel-being-shoved state).

## Minor / cosmetic (noted, not changed)

- regen period off-by-one tick (`recoverDelay` vs `recoverDelay-1`) — ~0.3%, imperceptible (damageAttack GAP-2).
- minimap `#spe` vs `#inf` for a room holding BOTH enemies and a special actor (roomRender D) — edge case.
- minimap `pScale=2` sizing (roomRender E) — the port's `cell=5` is a calibrated substitute.
- `finishGame()` teardown not called before the wasted/complete cutscene (gameFlow GAP-1) — stale entities
  don't tick (guarded by `isCutscene()`); the reload clears them.
- `screenMaster.backTo` dead field (gameFlow GAP-8); screen-transition fade direction (gameFlow GAP-9) — cosmetic.
- coupling #5 (room-enter navMode reset) — now subsumed: `onRoomCleared`/`setExits(false)` own navMode on both edges.

## Verified NON-issues (re-confirmed)

- gNavMode guard not ported — always 1 for Merlin's Revenge (no-op).
- takeHit component chain + level-up `send("levelUp")` broadcast — correctly coupled, not smells (coupling audit).
- modFlasher — dead code in both trees (zero callers).
