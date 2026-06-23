# Per-Actor Parity Audit: `monk`

**Method:** Behavior derived from `casts/data/act_monk.txt` + inherit chain (`#CPUCharacter` → `#character` → `#actor`) + the weapon `casts/data/act_healBlast.txt`, the AI `casts/script_objects/objAiCPUSpellCaster.txt`, and `casts/script_objects/objCPUCharacter.txt`. Reproduced by **RUNNING** `tools/_audit_monk.ts` — real `src/generated/assets.json` bundle, a monk + an injured `#aldevar` ally on an 80×80 grid, 250 ticks; sprite/attack/charge-release/heal/target observed; a second run drove a lethal hit to verify reincarnation. Probe deleted after the audit.

`monk` is an **aldevar (friendly) HEALER spellcaster** (`#objAiCPUSpellCaster`, `#weapon: #healBlast`). Its job is to fire `#takeHeal` bolts at the lowest-health friendly teammate (`targetAllegiance #friendly`, `targetCriteria #lowestHealth`, `reach 9999`). It carries a vestigial `#stretchyPunch` melee `#attack`, but as a spellcaster the magic weapon is primary (its `#attack.targetAllegiance #enemy` melee is never used — the monk targets only friendlies). On a combat death it reincarnates into `monkGhost`; when a room has no targets left it teleports out (`#leaveWhenFinished`).

---

## 1. Identity & Data — RUN-confirmed

| Property | Original (`act_monk.txt`) | Port (observed) | Match |
|---|---|---|---|
| `#objType` | `#objCPUCharacter` | `EnemyArchetype` (ally-typed at spawn) | ✓ |
| `#AiType` | `#objAiCPUSpellCaster` | `dodgesBullets`+`runReload` on, magic-reach-9999 optimumPosition | ✓ |
| `#character` | `#friendlyCharacter` | n/a (cosmetic; targeting is data-driven) | n/a |
| `#name` (sprite char) | `"monk"` | resolves to **`monk`** (NOT blackOrc) | ✓ |
| `#team` | `#aldevar` | `#aldevar` | ✓ |
| `#weapon` | `#healBlast` | `#healBlast` (magic, reach 9999, payload `takeHeal`) | ✓ |
| `#energy` | `50` | 50 (energyFrac 1 at spawn) | ✓ |
| `#walkSpeed` | `3.5` | 3.5 (×0.6 px slice) | ✓ |
| `#strength` | `1` | 1 | ✓ |
| `#dexterity` | `3` | 3 (ranged/magic counter inc) | ✓ |
| `#damageSpeed` | `4` | 4 | ✓ |
| `#inertia` | `60` | 60 | ✓ |
| `#mana_capacityIncLevel` | `0.5` | 0.5 (forwarded) | ✓ |
| `#mana_regenerationIncLevel` | `1` | 1 | ✓ |
| `#experienceAmountForNextLevel` | `50` | 50 | ✓ |
| `#reincarnateAs` | `[#monkGhost]` | `["monkGhost"]` → spawns `monkGhost` (`#ghosts`) on combat death | ✓ |
| `#leaveWhenFinished` | `true` | true → retires/teleports out on no-targets (`control.ts:639`) | ✓ |
| `#stallSpeed` | `0.5` | reel-recovery rate — not modeled | WONTFIX |
| `#miniMapStatus` | `#fre` | no minimap interaction in port | WONTFIX |

---

## 2. Animation strips & sprite resolution — FAITHFUL (no divergence)

Original keys strips by the actor's `#name` (`monk`). The bundle ships a full **lowercase-keyed** strip set, so the port's `spriteCharOr`/`_stand` gate resolves it cleanly (contrast with the sibling `scMonk`, whose stand strip was capital-`S` `scMonk_Stand` and tripped the case-sensitive gate — fixed in commit 3f46a16; here monk was never affected):

| Strip key in `assets.json` | frames | role |
|---|---|---|
| `monk_stand` | 1 | idle (the `_stand` gate) |
| `monk_walk` | 8 | walk |
| `monk_charge` / `monk_chargeWalk` | 4 / 4 | spell wind-up |
| `monk_release` / `monk_releaseWalk` | 4 / 4 | cast fire |
| `monk_reel` | 1 | hit |
| `monk_grave` | 2 | corpse |

**Observed:** `monk animChar : monk` (NOT blackOrc); `monk_stand bundled: true`. Anim actions across the run: `stand, charge, release` — i.e. it plays the **charge wind-up THEN the release fire strip** (`control.ts:783-792`), matching a `#animframe:#none` magic weapon (cast fires at the charge→release transition / on strip-complete, not per frame).

---

## 3. Weapon / spell (`#healBlast`) — FAITHFUL

| Property | Original (`act_healBlast.txt`) | Port (observed) |
|---|---|---|
| `#animType` | `#magic` | `magic`, type magic ✓ |
| `#animframe` | `#none` (the actor's own override) | empty list → cast on strip-complete (charge→release) ✓ |
| `#bullet` | `#energyBlastBullet` | `#energyBlastBullet` ✓ |
| `#reach` | `9999` | 9999 (the spellcaster's "spell loaded" signal) ✓ |
| `#cooldown` | `50` | 50 → calibrated cadence ✓ |
| `#payloadFunction` | `#takeHeal` | `["takeHeal"]` ✓ |
| `#targetAllegiance` | `#friendly` | `#friendly` ✓ |
| `#targetCriteria` | `#lowestHealth` | `#lowestHealth` (skips 100%-health, `teams.ts:138-148`) ✓ |
| `#targetRoles` | `[[#teamMembers]]` | `[[#teamMembers]]` ✓ |
| `#hits` | `[#teamMembers]` | `["#teamMembers"]` ✓ |
| `#spellSpeed` | `30` | 30 → bolt fly speed ✓ |
| `#power` | `1` | heal magnitude (charge-scaled) ✓ |

**RUN evidence (heal pathway):** an injured `#aldevar` ally at energyFrac **0.200** was healed back to **1.000** over the 250-tick run (1 heal-rise event = the bolt landed and `takeHeal` restored it). All bolts the monk fired carried team `#aldevar` and were routed through the **friendly** heal branch (`control.ts:863-867`, `fireBulletPayload(... "#friendly")`). No enemy-damage bolts, no spell-actors (heals go through the bullet-payload path, not the grow-fly objSpell path) — `bullets observed: 14, all friendly-team; spells: 0`. This is the faithful healer behavior: heal the weakest friendly, skip full-health teammates.

**AI (`objAiCPUSpellCaster`) — FAITHFUL:** `runReload`+`dodgesBullets` set (`archetypes.ts:285-288`); the reach-9999 optimumPosition kite chain (run-from-bullets/enemies, run-toward target) is active. The monk stays put when its (friendly) target is in range and there are no incoming hostiles.

---

## 4. Melee `#attack` (`#stretchyPunch`) — vestigial, FAITHFUL

`act_monk.txt` defines a `#naturalMelee` `#stretchyPunch` (`#animFrame:14`, `#reach point(25,10)`, `#power point(30,0)`, `#collisionLoc (35,-1)`, `#cooldown 10`, sound `wizard_punch`, `targetAllegiance #enemy`). As a `#objAiCPUSpellCaster`, the port (`archetypes.ts:211-218`) correctly selects the **magic weapon** (`healBlast`) as the primary firing attack, not this melee. Since the monk's effective targeting is `#friendly`/`#lowestHealth` (from the healBlast weapon, not the punch), it never melee-attacks anyone — it is a pure support healer. This matches the original (the spellcaster fires its `#weapon`; the natural melee is a backup the healer never engages). No divergence.

---

## 5. Death / grave / reincarnate — FAITHFUL

- `graveOn` defaults true → leaves a `monk_grave` corpse (bundled, resolves correctly via the `monk` char).
- `#reincarnateAs:[#monkGhost]` forwarded (`archetypes.ts:428`). **RUN-confirmed:** a lethal `takeHit` set `killedInAction: true` and spawned a live `monkGhost` (`team #ghosts`) at the corpse loc. A non-combat retire (`#leaveWhenFinished` teleport-out) does NOT split — only `getKilledInAction()` deaths reincarnate (`reincarnate.ts:11`), matching `objCharacter`/`modReincarnate`.

---

## Divergence Summary

**No divergences.** Every derived behavior reproduced faithfully:
- sprite resolves to the real `monk` strip set (charge→release played);
- the `#healBlast` magic weapon is primary (spellcaster override), reach 9999, payload `takeHeal`;
- targeting is `#friendly`/`#lowestHealth` and an injured ally was healed 0.20→1.00;
- friendly-only heal bolts (no enemy bolts / no melee on a pure healer);
- `#leaveWhenFinished` retire and `#monkGhost` combat-death reincarnation both wired and observed.

`monk | DIVERGENCES=0`
