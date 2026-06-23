# RESWEEP — Intermittent room re-entry FREEZE (root cause found)

**Date:** 2026-06-23
**Scope:** intermittent hard freeze on re-entering a beaten/cleared room. The game loop was made
crash-resilient (`src/engine/loop.ts` catches a thrown tick/render) and a grave-flicker was fixed
(`anim.ts syncAnimAfterRestore`), but the underlying throw was not yet identified. This sweep
identifies it by REPRODUCING against the real bundle.

---

## VERDICT

**ROOT CAUSE FOUND.** A live `objSpell` actor in flight at room-leave is frozen into the per-room
`pState` snapshot, and on re-entry is **respawned as a `pickup`-archetype entity that carries
`type === "spell"` but has NO `SpellActor` component**. The next render frame's `drawSpells`
(`src/main.ts:618`) filters `e.type === "spell"` and calls `e.get(SpellActor)`, which throws
`entity pickup has no component SpellActor`. Pre-resilience-net this killed the rAF loop → hard
freeze. Post-net it is caught every frame in `onRender` (one dropped frame per tick, forever), so the
game limps but the spell layer never draws and the console floods.

It is **intermittent / composition-dependent** because it only triggers when a spell actor is *live*
(charging or flying, not yet finished) at the instant the room is left — i.e. rooms with CPU
spellcasters (`goblinMage`/`goblinMageHut`, casters that grow a windup orb) or when the player leaves
mid-cast. A room with no live spell at leave-time never records one, so it never reproduces.

---

## EXACT REPRODUCTION

### A. Real bundle (Playwright, real CutscenePlayer + render + AI), `tools/_audit_freeze_pw2.ts`

- Map `new_mr4Demo`, drove the RoomManager directly into **room 36** (`loc {x:6,y:3}` — golems +
  `boulderCave`/`darkCave` spawners + `stones5`) and **room 197** (`loc {x:2,y:14}` — 3× `goblinHut`,
  2× `garTower`, `goblinMageHut`, `goblinBuilder`, `stones1` chatter).
- Per cycle: force-clear the room (drives the reincarnate cascade), fire the **real** in-game chatter
  cutscene (`scene.playInGameCutScene("stones1")` → real `CutscenePlayer.withBound` + `loadCutscene`),
  then `enter(neighbour)` → `enter(room)` (leave + RE-ENTER, restoring from pState).
- **Room 36, cycle 2** the resilience net began catching, every frame:

```
[GameLoop] onRender threw (frame kept alive): Error: entity pickup has no component SpellActor
    at Entity.get (.../src/engine/dispatch.ts:63:19)
    at drawSpells (.../src/main.ts:651)        // e.get(SpellActor) on a type="spell" pickup
    at renderScene (.../src/main.ts:424)
    at GameLoop.onRender (.../src/main.ts:374)
    at GameLoop.guard (.../src/engine/loop.ts:24)
```

(Room 197 ran 22 clean cycles in that session because no spell happened to be live at its
leave-frames — confirming the composition/timing dependence. Room 36's golem/cave fight left a spell
mid-flight at the leave instant.)

### B. Deterministic minimal repro through the REAL `RoomManager`, `tools/_audit_spell_pstate.ts`

```
live spell in entities: type=spell archetype=spell isFinished=false
entities before leave: player,spell
rm.enter({x:1,y:2})   // LEAVE  -> room1 snapshotted into pState (INCLUDING the live spell)
rm.enter({x:1,y:1})   // RE-ENTER -> restore from pState
AFTER RE-ENTER: entities= player/player, spell/pickup
  drawSpells -> e.get(SpellActor) on type=spell archetype=pickup hasSpellActor=false
    -> THROWS: entity pickup has no component SpellActor   <<<<< THE FREEZE
```

This needs only: spawn one live spell (`spawnSpell`), leave, re-enter. 100% deterministic.

---

## ROOT-CAUSE ANALYSIS — the data chain

1. **`act_spell` opts INTO the snapshot.** In `data.json`, `act_spell` carries
   `"recordInRoomState": true` (inherited/explicit), `objType: "#objSpell"`, `name: "spell"`,
   `character: "#spell"`.

2. **`isRecordableActor` does not exclude spells.** `src/entities/actorSerial.ts:62`:
   ```ts
   export function isRecordableActor(e: Entity): boolean {
     if (e.type === "bullet") return false;     // <-- ONLY bullets excluded
     const typ = bare((e.send("getActorType") as string) || "");
     const rec = typ ? registry.resolveActor(typ) : undefined;
     return rec?.["recordInRoomState"] !== false;
   }
   ```
   A live spell has `type === "spell"` (not `"bullet"`), `getActorType()` returns `"spell"` (a default
   on `SpellArchetype`, `src/entities/spell.ts:10`), and `resolveActor("spell").recordInRoomState`
   is `true`. So `true !== false` → **recordable → frozen into pState** at room-leave
   (`rooms.ts:93`).

3. **Restore round-trips it as the wrong archetype.** `serializeActor` writes `typ="spell"`,
   `type="spell"`. `respawnActor(snap)` → `spawnFromSymbol("spell", x, y)`. `"spell"` is in the
   `PICKUP_EFFECTS` set (`actorSerial.ts:78`), so `isPickupEffect("spell")` is true →
   `spawnPickup("spell")` returns a **`pickup`-archetype** entity (no `SpellActor`/no `Movement`-spell
   lifecycle). `respawnActor` then overwrites `e.type = snap.type = "spell"`
   (`actorSerial.ts:109`). Result: a `pickup` entity masquerading as a spell.

4. **The render path trusts `e.type`.** `drawSpells` (`main.ts:618`) does
   `if (e.type !== "spell") continue;` then `const sa = e.get(SpellActor);` — which throws on the
   mismatched entity. The same mismatch would also mis-route `sweepSpells` (`spells.ts:35` filters on
   `type === "spell"` and would `pool.release(e)` a non-spell entity into the SPELL pool — a second,
   latent corruption: a `pickup` pushed onto the spell free-list, later `acquire()`d and built as a
   spell).

### Why the other suspects came back clean

The headless sweep (`tools/_audit_freeze_repro.ts`, 25 leave/re-enter cycles with skelitonLord chains,
hydra3, doubleDarkGolem, garTower, a goblinHut dwelling, summoned allies, a stones1 chatter) showed:
no throw, no entity runaway (flat at 40), flat per-tick wall-clock. Specifically cleared:
- **reincarnate cascade** terminates (depth guard fine; 35 graves restore stably each cycle).
- **`teamMaster.restoreTarget`** on restored dead units — no loop/throw (dead targets yield null `rel`).
- **`armyMaster.refieldAll`** — terminates every enter (consumes the reserve; 3 allies stable).
- **chatter re-trigger** — `performed` is correctly NOT persisted, so the cutscene re-fires on every
  cleared re-entry; the real `CutscenePlayer.withBound({m:player})` + ulin spawn did **not** throw
  (30/30 real cutscenes ran clean in the Playwright sweep).
- **player edge ping-pong** — not observed.

The freeze is **not** in any of those; it is the spell-in-pState round-trip above.

---

## FIX SKETCH

Primary fix — exclude transient spell actors from the snapshot exactly as bullets are excluded. In
`src/entities/actorSerial.ts isRecordableActor`:

```ts
export function isRecordableActor(e: Entity): boolean {
  // transient combat objects (pooled, no actor-type identity) re-spawn fresh; never frozen into pState.
  if (e.type === "bullet" || e.type === "spell" || e.type === "marker" || e.type === "mine") return false;
  ...
}
```

`bullet` was already excluded; `spell` is the same class of transient (the K13 header already says
"in-flight bullets ... are NOT recorded; they re-spawn fresh"). `marker`/`mine` are belt-and-braces:
they are placed/region/transient objects that should likewise never be frozen-then-respawned through
the generic actor path (markers re-apply on tile-spawn; mines are explicitly `recordInRoomState:false`
in data and already excluded by the flag, but pinning them by `type` removes any future
`getActorType`-default footgun). The minimum correct change is adding `e.type === "spell"`.

Defense-in-depth (independent of the data fix, recommended):
- `respawnActor` (`actorSerial.ts:104`): if `spawnFromSymbol` returns an entity whose archetype does
  not match `snap.type`'s expected component shape, drop it (return null) rather than blindly
  `e.type = snap.type`. A restored entity's `type` should never contradict its archetype.
- `spawnFromSymbol` should not silently route a `#objSpell`/`name:"spell"` actor-type to the `"spell"`
  **pickup** effect. The `PICKUP_EFFECTS` key `"spell"` collides with the spell-actor name; the
  pickup is `#spell` (a magic scroll) while the actor is the live `objSpell`. Disambiguate (e.g. only
  treat `"spell"` as a pickup when there is no recordable `act_spell` actor-type match, or rename the
  internal spell actor-type so it can't be mistaken for the pickup effect).

A regression test belongs alongside `test/rooms_h3.test.ts` / `test/room_reentry_grave.test.ts`:
spawn a live spell, leave + re-enter via `RoomManager`, assert no `type==="spell"` entity lacks a
`SpellActor` component (and that `drawSpells`' filter+get does not throw).

---

## ARTIFACTS (throwaway, gitignored `_audit_*`)
- `tools/_audit_freeze_repro.ts` — headless real-data 25-cycle sweep (other suspects: all clean).
- `tools/_audit_freeze_pw.ts` / `tools/_audit_freeze_pw2.ts` — Playwright real-bundle sweeps; pw2
  (rooms 36/197) reproduced the resilience-net catch.
- `tools/_audit_spell_route.ts` — proves `serialize→respawn("spell")` yields `pickup`+`type="spell"`.
- `tools/_audit_spell_pstate.ts` — deterministic end-to-end repro through `RoomManager` leave/re-enter.
- `tools/_audit_findrooms.ts` / `tools/_audit_roominfo.ts` — located the heavy rooms.

---

ROOM-FREEZE | FOUND=yes | A live objSpell in flight at room-leave is frozen into pState (act_spell.recordInRoomState=true; isRecordableActor only excludes type==="bullet"), then on re-entry respawnActor("spell")→spawnFromSymbol routes "spell" to the #spell PICKUP and overwrites type="spell", producing a pickup-archetype entity with no SpellActor; drawSpells (main.ts:618) does e.get(SpellActor) on it and throws → hard freeze (now caught by the loop net every frame). Fix: exclude type==="spell" (and marker/mine) in isRecordableActor.
