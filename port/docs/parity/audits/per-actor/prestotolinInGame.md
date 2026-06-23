# Parity Audit: prestotolinInGame

## Summary

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **AiType** | #objAiCPUSpellCaster | configured via dodgesBullets flag | ✓ |
| **wizard** | true | true | ✓ |
| **team** | #aldevar | #aldevar | ✓ |
| **startingLevel** | 5 | 5 (pre-levelled via forceLevelUp) | ✓ |
| **weapon** | #energyPulseSpell | #energyPulseSpell | ✓ |
| **leaveWhenFinished** | true | true (retires on LEAVE_GRACE w/ no targets) | ✓ |
| **Spellcaster AI** | dodgesBullets + runReload | dodgesBullets=true, runReload=true (K4+I9) | ✓ |
| **Melee attack** | #punch (naturalMelee) | Primary attack is magic spell (energyPulseSpell) | ✓ |
| **Mana regeneration** | 5 (cooldown divisor) | 5 (WeaponManager counter inc) | ✓ |
| **Mana capacity** | 15 | 15 | ✓ |
| **Mana regenerationIncLevel** | 1 | 1 | ✓ |
| **Spell release on death** | spell drops when caster dies | SpellActor.discard() on isDead | ✓ |
| **Spell fly/explode lifecycle** | release → fly to target → explode radially | SpellActor.release → fly-mode → explode-mode | ✓ |
| **Energy** | 200 | 200 | ✓ |
| **Strength** | 1 | 1 | ✓ |

## Behavior Verification

### 1. Spellcaster AI Configuration (K4)
**Original:** objAiCPUSpellCaster drives optimumPosition FSM—kites away from bullets and enemies while reloading.
**Port:** 
- Line 214 in archetypes.ts: `const dodgesBullets = aiType === "#objAiCPUSpellCaster";`
- Line 211-212: `const runReload = !ghost && ranged && (...aiType === "#objAiCPUSpellCaster" || animType === "#magic"...)`
- Control.ts line 524: `if (this.dodgesBullets) this.goMode("optimumPosition", m);`
**Result:** ✓ CORRECT — spellcaster is configured with both dodgesBullets and runReload flags.

### 2. Spell Weapon Resolution (I9 Fix)
**Original:** prestotolinInGame carries both #punch (melee backup) and #weapon:#energyPulseSpell (primary). The AI fires the spell.
**Port:**
- archetypes.ts lines 154-161: Detects spellcaster via `AiType === "#objAiCPUSpellCaster"` + magic weapon
- Resolves the weapon's attack when the actor is a spellcaster (lines 159-160)
- energyPulseSpell is a #magic attack with reach 9999, forcing ranged AI mode
**Result:** ✓ CORRECT — the spell attack (not melee punch) is primary.

### 3. Mana Scaling & Level-Up Growth
**Original:** mana_capacity=15, mana_regeneration=5, mana_regenerationIncLevel=1 seed the charge ceiling and cooldown.
**Port:**
- archetypes.ts line 288: `mana_capacity: num("mana_capacity", 10)` → 15 read from data
- archetypes.ts line 286: `mana_regeneration: manaRegen` → 5 from data
- Mana.ts lines 17-27: `mana_regenerationIncLevel` → 1 per level-up growth
- Line 37 (Mana levelUp): `this.regeneration += this.regenInc` (faster recast on level-up)
**Result:** ✓ CORRECT — mana scales faithfully.

### 4. Starting Level Pre-Levelling
**Original:** startingLevel=5 means the actor spawns pre-levelled (repeat 1 to 5: levelUp).
**Port:**
- archetypes.ts line 317-318: `const startLevel = num("startingLevel", 0); for (let i = 0; i < startLevel; i++) e.send("forceLevelUp");`
- Called AFTER build so all levelUp handlers exist
**Result:** ✓ CORRECT — pre-levelling applied.

### 5. leaveWhenFinished Retire Behavior
**Original:** objAiCPU #noTargetFound — a #leaveWhenFinished ally retires (armyTeleportOut) when no targets remain for 60 frames.
**Port:**
- archetypes.ts line 278: `leaveWhenFinished: d["leaveWhenFinished"] === true`
- control.ts line 335: `private static readonly LEAVE_GRACE = 60;`
- control.ts lines 440-443: On findTarget with no target, increment noTargetCtr; retire at LEAVE_GRACE
- control.ts lines 462-466: `leaveGame()` calls `armyMaster.teleportOut()` and flags "left"
**Result:** ✓ CORRECT — retirement on room clear.

### 6. Spell Discard on Death
**Original:** When a caster dies, its charging spell is cancelled (objSpell.cancel).
**Port:**
- control.ts lines 114-120: On isDead, discard the live spell: `if (this.spell) { this.spell.get(SpellActor).discard(); this.spell = null; }`
- spellActor.ts line 83: `discard(): void { this.done = true; }` — marks finished so swept back to pool
**Result:** ✓ CORRECT — spell dropped on death.

### 7. Spell Lifecycle (Charge → Fly → Explode)
**Original:** objSpell charges over the caster's head, releases to fly, arrives to explode radially.
**Port:**
- PlayerControl lines 161, 243-245: ensureSpell for charge-mode, setCharge updates position, release sends to fly
- spellActor.ts lines 70-77: setCharge positions the orb over caster's head (half = size/2)
- spellActor.ts lines 88-97: release() starts fly-mode with direction/TTL
- spellActor.ts lines 100-112: fly-mode ticks toward target, checks arrival
- spellActor.ts lines 114-144: explode() grows charge, resolves radial splash hit, runs summon payload
**Result:** ✓ CORRECT — faithful charge/fly/explode lifecycle.

### 8. Team Allegiance & Targeting
**Original:** #aldevar team, #friendlyCharacter, hunts #aldevar.hates (enemies).
**Port:**
- archetypes.ts line 270: `team: str("team", "#monsters")` → resolves to "#aldevar"
- archetypes.ts line 44: spawnAlly sets `e.get(Team).team = "#aldevar"`
- control.ts line 134: `game.teamMaster.findTarget(this.entity)` uses data-driven Targeting
- Data-driven allegiance via targetAllegiance="#enemy" (archetypes line 294)
**Result:** ✓ CORRECT — team and allegiance correct.

## Conclusion

**prestotolinInGame** exhibits full behavioral parity across all axes: spellcaster AI configuration, spell weapon resolution (I9 fix), mana scaling, pre-levelling, leaveWhenFinished retirement, spell discard on death, and spell lifecycle (charge/fly/explode). No behavioral divergences detected.

**Status:** CLEAN

---

## RE-VERIFY BY REPRODUCTION (2026-06-23)

Real assets/data; `prestotolinInGame` as `#aldevar` ally vs PINNED `darkGolem`; substrate rebuilt per tick;
260 frames. Confirms the streaming `#fireBullets` path (shared with the now-fixed `ochreInGame`) is correct
for prestotolin too. Harness gitignored/deleted.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Sprite char | `presto` (not blackOrc) | `spriteCharOr("presto")→presto`; full charge/release/grave strips bundled | ✓ |
| Weapon | `#energyPulseSpell` (`#releaseFunction #fireBullets`, `#fireDelay 5`, `#bullet #energyPulse`) | `getCurrentAttack name:#energyPulse releaseFunction:#fireBullets fireDelay:5 type:magic` | ✓ |
| Stream cadence | one bullet every `fireDelay`=5 ticks (NOT one orb per cooldown) | bullets at t=14,19,24,29,34,… → clean **5-tick spacing**, **58 bullets** over 260t (the I8 stream, not under-firing) | ✓ |
| Stream lands | bullets damage an in-range hostile | with the pin at 200px the `#energyPulse` (friction 6, ~116px lob range) falls SHORT (probe artifact, see note); re-run with the pin at **80px** → **23 damage ticks**, energyFrac dropping → hits land | ✓ |
| AI mode | spellcaster | `optimumPosition`(238t)+`moveToAttack`(22t) | ✓ |
| startingLevel 5 | pre-levelled | spawns at level 5 | ✓ |

**Probe note (NOT a port bug):** `energyPulse` is a `#type:#explode` short-range lob (`#friction point(6,6)`)
that decelerates and only reaches ~116px from the muzzle. A pin at 200px is out of that range, so the stream
visibly missed; moving the pin in-range (80px) lands the stream cleanly. The pin distance, not the port, was
the cause — confirmed by re-pinning.

**CLEAN — reproduced faithfully.** The `#fireBullets` stream emits at the correct `fireDelay` cadence and
lands on an in-range target.
