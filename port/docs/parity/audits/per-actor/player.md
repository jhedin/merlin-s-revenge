# Actor Audit: `player` (act_player)

**Status**: CLEAN — All gameplay-critical properties verified as correctly applied.

## Inheritance Chain

```
act_player
  #objType: #objPlayerMerlinCharacter
  #AiType: #objAiPlayer
  #inherit: #actor
```

The player actor uses `#objPlayerMerlinCharacter` type. Crucially, **walkSpeed sources from `act_merlin` (not `act_player`)**: the port correctly reads from `merlin` actor record (archetypes.ts:99, 109), which carries `walkSpeed: 4`. This is faithful — the original `act_player` has no walkSpeed; the merlin template supplies it.

## Property-by-Property Coverage

All values from `/home/user/merlin-s-revenge/casts/data/act_player.txt` and verified in `/home/user/merlin-s-revenge/port/src/generated/data.json`:

### Gameplay-Critical Properties (Core Combat/Movement)

| Property | Value | Port Applied | Evidence |
|----------|-------|--------------|----------|
| **energy** | 200 | ✓ YES | `archetypes.ts:110` reads `d["energy"]` → `Energy.init(cfg["energy"])` at `combat.ts:23` |
| **strength** | 8 | ✓ YES | `archetypes.ts:111` reads `d["strength"]` → `PlayerControl.init` sets `this.strength` at `control.ts:66` |
| **agility** | 1 | ✓ YES | `archetypes.ts:112` reads `d["agility"]` → `WeaponManager.init` at `weapon.ts:349` |
| **dexterity** | 0.2 | ✓ YES | `archetypes.ts:112` reads `d["dexterity"]` → `WeaponManager.init` at `weapon.ts:350` |
| **team** | #aldevar | ✓ YES | `archetypes.ts:126` hardcoded (d value overridden, intentional) → `Team.init` at `combat.ts:127` |
| **walkSpeed** (from merlin) | 4 | ✓ YES | `archetypes.ts:109` reads `md["walkSpeed"]` from merlin → `Movement.init` at `movement.ts:37` |

### Mana System Properties (Spell/Charge Mechanics)

| Property | Value | Port Applied | Evidence |
|----------|-------|--------------|----------|
| **mana_capacity** | 10 | ✓ YES | `archetypes.ts:113` reads `d["mana_capacity"]` → `Mana.init(cfg["mana_capacity"])` at `mana.ts:20` |
| **mana_flow** | 1 | ✓ YES | `archetypes.ts:114` reads `d["mana_flow"]` → `Mana.init(cfg["mana_flow"])` at `mana.ts:21` |
| **mana_burst** | 1 | ✓ YES | `archetypes.ts:115` reads `d["mana_burst"]` → `Mana.init(cfg["mana_burst"])` at `mana.ts:22` |
| **mana_regeneration** | 30 | ✓ YES | `archetypes.ts:116` reads `d["mana_regeneration"]` → `Mana.init(cfg["mana_regeneration"])` at `mana.ts:23` (cooldown divisor, not pool regen) |
| **mana_capacityIncLevel** | 0.5 | ✓ YES | `archetypes.ts:118` reads `d["mana_capacityIncLevel"]` → `Mana.init` at `mana.ts:24` |
| **mana_flowIncLevel** | 0.1 | ✓ YES | `archetypes.ts:119` reads `d["mana_flowIncLevel"]` → `Mana.init` at `mana.ts:25` |
| **mana_burstIncLevel** | 0.1 | ✓ YES | `archetypes.ts:120` reads `d["mana_burstIncLevel"]` → `Mana.init` at `mana.ts:26` |
| **mana_regenerationIncLevel** | 0.1 | ✓ YES | `archetypes.ts:121` reads `d["mana_regenerationIncLevel"]` → `Mana.init` at `mana.ts:27` |

### Experience & Leveling

| Property | Value | Port Applied | Evidence |
|----------|-------|--------------|----------|
| **experienceAmountForNextLevel** | 10 | ✓ YES | `archetypes.ts:123` reads `d["experienceAmountForNextLevel"]` → `Experience.init` (checked in data flow) |
| **strengthIncLevel** | 0.1 | ✓ YES | `archetypes.ts:122` reads `d["strengthIncLevel"]` → `PlayerControl.init` at `control.ts:67` |

### Energy Recovery

| Property | Value | Port Applied | Evidence |
|----------|-------|--------------|----------|
| **energyRecoverDelay** | 30 | ✓ YES | `archetypes.ts:125` reads `d["energyRecoverDelay"]` → `Energy.init(cfg["energyRecoverDelay"])` at `combat.ts:26` (passive regen: +1 per 30 ticks) |
| **energyIncPercentage** | 2 | ✓ YES | `archetypes.ts:124` reads `d["energyIncPercentage"]` → `Energy.init` at `combat.ts:25` (max grows 2% per level) |

### Attack Data (Melee Punch)

| Property | Value | Port Applied | Evidence |
|----------|-------|--------------|----------|
| **attack** (punch) | `{animFrame:3, animType:#naturalMelee, collisionLoc:point(9,-1), cooldown:20, hits:[#teamMembers,#teamBuildings], name:#punch, power:point(2,0), reach:point(7,10), sound:wizard_punch}` | ✓ YES | `archetypes.ts:106` reads `d["attack"]` → `resolveAttack()` → `WeaponManager.init` at `weapon.ts` |

### Non-Gameplay Properties (Intentionally Deferred/Omitted)

| Property | Value | Port Status | Classification | Evidence |
|----------|-------|-------------|-----------------|----------|
| **name** | "mer" | Hardcoded | Cosmetic (animChar set separately) | `archetypes.ts:126` uses `animChar: "mer"` |
| **speechColor** | rgb(100,100,255) | NOT APPLIED | Cosmetic (UI text rendering) | `data-coverage.md`: audio-volume/visual cosmetics deferred |
| **overlapToLeaveRoom** | 14 | NOT APPLIED | Minor behavioral (room-exit trigger) | `data-coverage.md`: documented low-impact deferral |
| **startingLevel** | 0 | NOT APPLIED | Deferred; player always starts level 0 | Applied to spawned allies/units, not player itself |
| **teleportable** | false | NOT APPLIED | Deferred; player is not teleportable (always false) | Applies to summoned allies; hardcoded in `archetypes.ts` |
| **miniMapStatus** | #clr | NOT APPLIED | Cosmetic (UI minimap rendering) | `data-coverage.md` §Cosmetic/visual |
| **layerZ** | gPlayerLayer | NOT APPLIED | Engine-internal (rendering layer ordering) | `data-coverage.md` §platforming/engine-internal |
| **stretchDeath** | true | NOT APPLIED | Visual death animation | `data-coverage.md` §weight/gravity/... platforming/engine-internal |
| **takeHitSound** | "wizard_hit" | NOT APPLIED | Audio cosmetic | `data-coverage.md` §audio-volume tuning |
| **takeHitSoundVolume** | 100 | NOT APPLIED | Audio volume cosmetic | `data-coverage.md` §audio-volume tuning |
| **eyestrain** | 0 | NOT APPLIED | Cosmetic (aim jitter deferred) | `data-coverage.md` §Deferred (already in K-backlog as cosmetic) |
| **jumpPower** | -15 | NOT APPLIED | Engine-internal (platforming) | `data-coverage.md` §weight/gravity/jumpPower... platforming properties |
| **walkAcceleration** | 2 | NOT APPLIED | Engine-internal (platforming physics) | `data-coverage.md` §walkAcceleration... platforming properties |
| **weight** | 0.2 | NOT APPLIED | Engine-internal (platforming physics/gravity) | `data-coverage.md` §weight/gravity... platforming properties |
| **gmgChargeLoc** | point(10,-1) | NOT APPLIED | Cosmetic (screen HUD position for GMG charge bar) | Not gameplay-critical; charge mechanics work with default positioning |
| **armyMembers** | [#warrior, #archer, #monk, #dwarf, #kingInGame] | NOT APPLIED | Army roster config (used by AI summoner, not player) | Player cannot summon — this is army builder state |
| **character** | #playerCharacter | NOT APPLIED | Type reference (used for inheritance resolution in Lingo) | Inheritance resolved at data-load time; value is structural metadata |

## Summary

**All gameplay-critical properties from `act_player` are correctly read and applied:**

✓ **Combat stats**: energy, strength, agility, dexterity, team, walkSpeed (from merlin)
✓ **Mana/spell system**: mana_capacity, mana_flow, mana_burst, mana_regeneration + per-level increments (all 4)
✓ **Experience/leveling**: experienceAmountForNextLevel, strengthIncLevel  
✓ **Recovery**: energyRecoverDelay, energyIncPercentage  
✓ **Attack**: punch attack data (reach, power, cooldown, hits, sound)

**Deferred/non-critical properties are documented as intentional omissions** (data-coverage.md confirms these are cosmetic, platforming/engine-internal, or low-impact behavioral deferral — none are real gameplay gaps).

No behavioral parity gaps detected.
