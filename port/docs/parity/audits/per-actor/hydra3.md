# Actor Parity Audit: hydra3

**Date:** 2026-06-21  
**Scope:** Behavioral parity between Lingo original (casts/data/act_hydra3.txt) and TypeScript port (port/src/).

## Summary

hydra3 is the largest in the hydra3→hydra2→hydra1 cascade. On death (lethal damage), it reincarnates into a **single #hydra2** (bare symbol). All properties and behaviors are correctly implemented.

---

## Property Coverage

| Property | Original | Port | Status | Evidence |
|----------|----------|------|--------|----------|
| **Type & AI** | | | | |
| #objType | #objCPUCharacter | #objCPUCharacter | ✓ | data.json `"objType": "#objCPUCharacter"` |
| #AiType | #objAiCPU | #objAiCPU | ✓ | data.json `"AiType": "#objAiCPU"` |
| #inherit | #CPUCharacter | #CPUCharacter | ✓ | data.json resolves CPUCharacter base |
| **Combat** | | | | |
| #energy | 1500 | 1500 | ✓ | data.json line 23 |
| #maxEnergy | 1500 | 1500 | ✓ | data.json line 28 |
| #minEnergy | 1000 | 1000 | ✓ | data.json (catalogs minEnergy as multi-stage gate) |
| #strength | 10 | 10 | ✓ | data.json line 32 |
| #dexterity | 10 | 10 | ✓ | data.json line 21 |
| **Attack** | | | | |
| #attack.animType | #naturalMelee | #naturalMelee | ✓ | data.json attack.animType |
| #attack.damageMultiplier | 1.2 | 1.2 | ✓ | data.json attack.damageMultiplier |
| #attack.hits | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ✓ | data.json attack.hits; passed to Targeting.init() (combat.ts:150) |
| #attack.power | point(0.5, 0) | {x: 0.5, y: 0} | ✓ | data.json attack.power |
| #attack.name | #bite | "#bite" | ✓ | data.json attack.name |
| #attack.cooldown | 0 | 0 | ✓ | data.json attack.cooldown |
| **Team** | | | | |
| #team | #swamp | "#swamp" | ✓ | data.json line 33 |
| **Movement** | | | | |
| #walkSpeed | 6 | 3.6 (6 × 0.6 px scale) | ✓ | data.json line 35; archetypes.ts line 263 applies port scale |
| #inertia | 50 | 50 | ✓ | data.json (inertia impacts knockback damping) |
| #frictionReel | point(30, 30) | {x: 30, y: 30} | ✓ | data.json line 26 |
| **Reincarnation** | | | | |
| #reincarnateAs | #hydra2 (bare symbol) | "#hydra2" | ✓ | data.json line 30; parseReincarnate() normalizes bare → ["hydra2"] |
| Reincarnate behavior | Spawns ONE #hydra2 on lethal death | Spawns ONE #hydra2 on lethal death | ✓ | reincarnate.ts lines 40–46, 82–98; test: reincarnate.test.ts:100–107 |
| #reincarnateRadius | (not set → 0) | 0 | ✓ | archetypes.ts:303; defaults to 0 |
| **Sound** | | | | |
| #dieSound | #none | "#none" | ✓ | data.json line 22 (catalogued) |
| #attack.sound | "hydra2_fire" | "hydra2_fire" | ✓ | data.json attack.sound |
| **Experience** | | | | |
| #experienceImWorth | 60 | 60 | ✓ | data.json line 24 (catalogued) |
| **Starting** | | | | |
| #startingLevel | 0 | 0 | ✓ | data.json line 31 (catalogued) |

---

## Behavioral Tests

### 1. Reincarnation on Lethal Death
**Original:** On #killedInAction (lethal damage only), spawn ONE #hydra2 at the corpse location.  
**Port:** Energy.takeHit() sets killedInAction=true (line 42), Reincarnate checks both isDead AND getKilledInAction (line 67), parseReincarnate() normalizes bare symbol to single-element array (line 43).  
**Verification:** reincarnate.test.ts:100–107 confirms bare symbol `#skelitonSword` spawns exactly ONE child. ✓

### 2. Non-Combat Removal Does NOT Reincarnate
**Original:** Only real combat deaths (killedInAction) trigger reincarnate; retiring/culling does not.  
**Port:** reincarnate.ts line 67 gates on `getKilledInAction()`, which is ONLY set by lethal takeHit (combat.ts:42), never by retire/cull.  
**Verification:** reincarnate.test.ts:109–119 confirms non-combat removal skips reincarnation. ✓

### 3. Attack Hits Both Units and Buildings
**Original:** #attack.hits: [#teamMembers, #teamBuildings] — melee strikes target both.  
**Port:** Attack is resolved to AttackData.hits array (weapon.ts:176), passed to Targeting.init() (combat.ts:150), used by impactMeleeAttack (teams.ts:281 reads tg.hits).  
**Verification:** Data flows: archetypes.ts:293 → entity.build(hits:...) → Targeting.init() → impactMeleeAttack(). No gaps. ✓

### 4. Melee AI FSM
**Original:** #objAiCPU: committed-target findTarget → moveToAttack → attack FSM.  
**Port:** CpuAI in control.ts implements the FSM (lines 420–434); melee checks reach at line 248, fires via impactMeleeAttack (line 260).  
**Verification:** AI tests pass; no divergence in mode logic. ✓

### 5. Natural Melee Attack Type
**Original:** #naturalMelee attack animation.  
**Port:** typeFromAnimType("#naturalMelee") returns "melee" (weapon.ts:97); attack fires as melee contact.  
**Verification:** Animation type is preserved and routed correctly. ✓

---

## Conclusion

**CLEAN**

All properties are correctly read from data, all behavioral paths (reincarnation on lethal death, hits config, melee FSM, team) are faithfully implemented. No gaps or divergences detected.

---

## Files Audited

- **Original:** casts/data/act_hydra3.txt
- **Port Data:** port/src/generated/data.json (act_hydra3 entry)
- **Port Logic:**
  - port/src/components/reincarnate.ts (reincarnation cascade)
  - port/src/components/combat.ts (Energy killedInAction gate, Targeting hits)
  - port/src/components/control.ts (CpuAI FSM, melee fire)
  - port/src/entities/archetypes.ts (spawnEnemy data flow)
  - port/src/systems/teams.ts (impactMeleeAttack targeting)
- **Port Tests:**
  - port/test/reincarnate.test.ts (cascade, bare-symbol, killedInAction gate)

---

## RE-VERIFY (2026-06-23) — fresh reproduction (`tools/_audit_combat.ts hydra3`)
- **Strips:** `stand`✓ `walk`✓ `grave`✓ `naturalMelee`✓ (animChar=hydra3, team #swamp).
- **MULTI-HIT melee (#naturalMelee #bite, animFrame[5,8,11] = 3 hits/cycle, reach 25, mult 1.2):** observed damage cadence `[3,3,6, 3,3,6, ...]` — exactly **3 hits 3 ticks apart per bite, then a 6-tick gap** to the next cycle. 27 hits over 120 ticks. The 3-frame multi-hit fires faithfully. ✓
- **Reincarnation:** kill → `[hydra2]` (bare symbol `#hydra2` normalized to one child). ✓
- **Verdict: CLEAN.**
