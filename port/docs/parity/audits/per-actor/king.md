# Parity Audit: king (+ kingInGame / kingStones / armySummon)

**Actors:** `king`, `kingInGame`, `kingStones`, `armySummon` (context: `kingSword`)
**Method:** reproduce in the port harness (`tools/_audit_king.ts`, deleted) vs. derive from `casts/`.
**Audit Date:** 2026-06-23

---

## What "king" actually is (three distinct entities)

There is no single "king boss". The data splits into three:

| Actor | Role | objType / AiType | inherit | team | sprite #name |
|-------|------|------------------|---------|------|--------------|
| `king` | Cutscene prop (the rescued king walking in scenes) | `#objActorPlayer` / `#objAiAttack` | `#actorPlayer` | `#chatters` (inherited) | `king` |
| `kingInGame` | The **combat unit** — a summonable melee ALLY (top army tier) | `#objCPUCharacter` / `#objAiCPU` | `#CPUCharacter` | `#aldevar` | `kingInGame` |
| `kingStones` | The quest "rescue the king" talking-stone (a Chatter) | `#objChatter` / `#objAiChatter` | `#chatter` | `#collectables` | (renders via explicit `#member`) |

`kingInGame` is summoned by the `armySummon` scroll (`#multistage` tier `#kingInGame: 32`, the highest), team `#aldevar` (player side), melee weapon `kingSword`. It is an ally, not a hostile boss.

---

## Derived behavior (from casts/)

### kingInGame (`casts/data/act_kingInGame.txt`)
- `#energy:300`, `#strength:15` (+1/level), `#dexterity:3`, `#walkSpeed:4.5`, `#damageSpeed:2.5`, `#inertia:60`, `#stallSpeed:1`.
- `#team:#aldevar`, `#leaveWhenFinished:true`, `#AiType:#objAiCPU` → plain committed-target **melee** FSM.
- `#weapon:#kingSword` → `act_kingSword`: `#animType:#weaponMelee`, `#animframe:7` (strike frame), `#cooldown:5`, `#damageMultiplier:3`, `#power:point(0.5,0)`, `#collisionLoc:point(12,0)`, `#sound:"skeleton_fire"`, hits `[#teamMembers,#teamBuildings]`.
- `#character:#friendlyCharacter`, but `#name:"kingInGame"` → modAnimSet keys strips off `#name` → `kingInGame_*` strips.
- `#objCPUCharacter` adds modGrave (`objCPUCharacter.txt:34`); no `#reincarnateAs` → dies to a grave, no split.

### king (`casts/data/act_king.txt`)
- Cutscene-only prop: `#character:#king` → `king_*` strips (only `king_stand`, `king_play`, `king_grave` — **no walk/melee**). No `#energy`/`#weapon`/`#attack`. Inherits `#team:#chatters`.

### kingStones (`casts/data/act_kingStones.txt`)
- `#inherit:#chatter`, `#scriptToPerform:#rescueKing`, `#collisionRect:rect(-100,-50,100,50)`.
- Renders via **explicit `#member: member("anm_kingStones_stand_03_01")`** — `objChatter.txt:34` `pWaitingMember = params.member`; `setMember(pWaitingMember)`. It does NOT use a `#name`-keyed anim strip.

### armySummon (`casts/data/act_armySummon.txt`)
- `#explodeFunction:#summonUnit`, `#payloadFunction:#armyTeleportOut`, `#residentTeamCategory:#aldevar`, `#bullet:#energyBlastBullet`, `#chargeMax:38`.
- `#multistage:[#warrior:10, #archer:15, #monk:20, #dwarf:25, #kingInGame:32]`. Highest tier = `kingInGame` at charge ≥32.
- `#armySummon` REQUIRES a banked reserve record (K9 reservation rule) — without one the cast fizzles to just its bolt.

---

## Observed in the port (reproduced)

| Probe | Result | Verdict |
|-------|--------|---------|
| `kingInGame` char resolves | `kingInGame` (NOT blackOrc); strips stand/walk/weaponMelee/grave/reel all present | FAITHFUL |
| `kingInGame` routing | `spawnFromSymbol`/`spawnUnit` → type=`ally`, team `#aldevar`, role `#teamMembers` | FAITHFUL |
| `kingInGame` attack | `#kingSword` melee, reach 25, cooldown 12 (calibrated), sound `skeleton_fire` | FAITHFUL |
| `kingInGame` combat | closes on a hostile orc, swings `weaponMelee` (~26 swing-entries / 300 ticks), chips target energy | FAITHFUL |
| `kingInGame` death | `loseEnergy 99999` → dead, `graveOn=true`, action → `grave`, no reincarnation | FAITHFUL |
| `armySummon` tiers | charge 9→fizzle, 14→warrior, 19→archer, 24→monk, 31→dwarf, 38→**kingInGame** | FAITHFUL |
| `armySummon` reservation | charge 38, empty reserve → fizzle (null); after banking a kingInGame → fields `kingInGame` ally @ saved level | FAITHFUL |
| `king` prop char | `spawnFromSymbol("king")` → char `king` (correct strips), team `#chatters` | FAITHFUL (char) |
| `kingStones` char | `spawnFromSymbol("kingStones")` → type `chatter`, char **`blackOrc`** | **PORT-BUG** (see D1) |

---

## DIVERGENCES

### D1 — kingStones renders as `blackOrc`, not its king-on-stones art  (PORT-BUG)

**Original (derive):**
```
act_kingStones: #inherit #chatter, #character #king,
                #member: member("anm_kingStones_stand_03_01", "gfx")
objChatter.init: pWaitingMember = params.member   (casts/script_objects/objChatter.txt:34)
objChatter.goMode: me.setMember(pWaitingMember)    (:84)
  -> the stone is drawn from its EXPLICIT #member (the king-on-the-stones graphic).
```

**Port (reproduce):**
```
spawnChatter() (src/entities/objTypes.ts):
    animChar: spriteCharOr(actorName, "blackOrc")
spriteCharOr("kingStones"): #name="kingStones" -> no anims["kingStones_stand"];
    no "king"/alias match -> returns fallback "blackOrc".
  -> The Chatter component renders nothing itself; the Anim char is "blackOrc".
Observed: spawnFromSymbol("kingStones") -> char "blackOrc".
```

**Root cause:** the port ignores the `#member` property entirely (Anim keys strips only by `#name`/`#character`), AND `tools/build_assets.ts` does not bundle an `anm_kingStones_stand` strip (no `kingStones_*` anim key exists in `assets.json`). So every member-only chatter falls through to the `blackOrc` fallback.

**Scope:** shared by the sibling member-only stones — `armySummonStones` (`#member anm_armySummonStones_stand`) and `berlinTV` also lack bundled strips and fall back to `blackOrc`. Named `stonesN` chatters are unaffected (`stones1_stand`..`stones10_stand` ARE bundled).

**Impact:** cosmetic only. kingStones is an inert quest trigger (correct team `#collectables`, correct `#rescueKing` script, correct `rect(-100,-50,100,50)` trigger box — all verified). The trigger FSM works; only the on-screen sprite is wrong (a black orc where the king-on-stones graphic should be). No combat/gameplay effect.

**Faithful vs. bug:** PORT-BUG (wrong sprite). Fix = bundle the `anm_kingStones_stand` (and `armySummonStones`, `berlinTV`) members in `build_assets.ts` and resolve the chatter char to them, or honor the actor's `#member` directly.

---

## Non-divergences explicitly checked (FAITHFUL quirks)

- **`kingInGame` is an ally, not an enemy boss.** `#team:#aldevar` → the port routes it to `type=ally`. This is correct; "king boss" is a misnomer — it is the player's top summonable battalion unit.
- **`king` prop routes to `type=enemy` via spawnFromSymbol** (objType `#objActorPlayer` is not dispatched in `actorSerial`, so it falls to `spawnUnit` with the inherited team `#chatters` → non-player-side → enemy type). Cosmetically irrelevant: the char resolves to `king` correctly, and `king` is a cutscene-only actor never placed as a map combatant. Not counted as a divergence (no observable in-game effect).
- **No reincarnation / grave on death** — matches data (`kingInGame` has no `#reincarnateAs`; modGrave default leaves a grave). Verified.
- **armySummon reservation requirement (K9)** — an empty reserve fizzles the kingInGame summon; banking then re-fields it at saved level. Verified, matches `createUnit`/`lookupArmyDetails`.
- **kingSword cooldown** — raw `#cooldown:5` calibrated to an effective per-weapon counter; observed cadence (~26 swings/300 ticks) is steady melee. Calibration is the port's documented B2 cooldown model, not a divergence.

---

## Summary

`kingInGame` (the only combat king) reproduces faithfully — correct sprite, team/ally routing, kingSword melee, grave death, and armySummon tier-32 reservation summon. The cutscene `king` prop resolves its `king` sprite correctly. The one real divergence is **D1**: `kingStones` renders as `blackOrc` because the port neither bundles nor honors its explicit `#member` art.
