# Parity Audit: scWarrior

**Actor:** `scWarrior` (Scarlet Warrior)
**Audit date:** 2026-06-22
**Method:** REPRODUCED — wrote `port/tools/_audit_scWarrior.ts`, loaded the REAL `src/generated/assets.json`
bundle, spawned scWarrior vs an `#aldevar` target, ticked 200 frames, then killed it to observe
reincarnation. All "observed" rows below are runtime measurements, not code-reading. Probe deleted after run.

---

## 1. Identity / Inherit chain

| Layer | File |
|-------|------|
| `act_scWarrior` | `casts/data/act_scWarrior.txt` |
| `#inherit: #CPUCharacter` | `casts/data/act_CPUCharacter.txt` |
| `#inherit: #character` | `casts/data/act_character.txt` |
| `#inherit: #actor` | `casts/data/act_actor.txt` |
| Object type | `#objCPUCharacter` (`casts/data/act_scWarrior.txt:3`) |
| AI type | `#objAiCPU` (`casts/data/act_scWarrior.txt:4`) → `objAiCPU.txt` → `objAiAttack.txt` |
| Weapon | `act_scWarriorSword` (`casts/data/act_scWarriorSword.txt`) |
| Team | `tem_scarlet` (`casts/data/tem_scarlet.txt`) |

Scarlet-family context: `scMonk` (`#objAiCPUSpellCaster`, mana caster), `scArcher` (`#objAiCPU` + bow,
ranged), `scWarrior` (`#objAiCPU` + sword, **melee**), `scSummon` (`#objScroll`/`#objAiPowerUp` summon
scroll). scWarrior is the plain melee bruiser of the set.

**Sprite char:** `scWarrior` (`#name: "scWarrior"`, `act_scWarrior.txt:16`). All strips bundled:
`scWarrior_stand` (1f), `scWarrior_walk` (8f), `scWarrior_weaponMelee` (20f), `scWarrior_reel` (1f),
`scWarrior_grave` (2f).

---

## 2. Derived properties (from ORIGINAL data)

### Actor stats (`act_scWarrior.txt`)

| Property | Original line | Value | Meaning |
|----------|---------------|-------|---------|
| `#team` | :15 | `#scarlet` | hostile; `tem_scarlet` hates `[#aldevar, #village, #monsterSummon, #goblins, #ninja, #magicalAlliance, #orcs, #monsters]` |
| `#energy` | :8 | 250 | HP pool |
| `#strength` | :13 | 12 | melee power source |
| `#strengthIncLevel` | :14 | 0.5 | per-level strength growth |
| `#dexterity` | :7 | 3 | ranged stat — **unused for melee** (agility=1 gates cooldown) |
| `#inertia` | :9 | 50 | knockback resistance |
| `#damageSpeed` | :6 | 4 | wall-slam damage threshold |
| `#walkSpeed` | :17 | 7 | → 4.2 px/tick (× 0.6 port conversion) |
| `#stallSpeed` | :10 | 1 | hit-recovery damping (`pMoveXY`, out of port scope) |
| `#stallSpeedIncLevel` | :11 | 1 | per-level growth of stall speed |
| `#reincarnateAs` | :12 | `[#fire]` | spawns a `fire` actor on killed-in-action death |
| `#weaponTechniqueInc` | :19 | 3 | **dead data field** — see §4 |
| `#weapon` | :18 | `#scWarriorSword` | resolves the attack |

No `#character:` key (unlike `scMonk`'s `#enemyCharacter`) — falls back to the default character module.
No `#dieSound` → silent death. No `#weaponTechnique:` key → starting technique = 0 (attack-speedup inert).

### Weapon (`act_scWarriorSword.txt`)

| Property | Line | Value |
|----------|------|-------|
| `#animType` | :8 | `#weaponMelee` |
| `#animframe` | :7 | 9 (1-based; the hit fires on frame 9 of the 20-frame `weaponMelee` strip) |
| `#collisionLoc` | :9 | `point(12, 0)` → strike-point offset (the melee reach source) |
| `#idealAttackLoc` | :13 | `point(12, 0)` → approach standoff |
| `#cooldown` | :10 | 1 |
| `#damageMultiplier` | :11 | 5 |
| `#power` | :15 | `point(0.5, 0)` |
| `#hits` | :12 | `[#teamMembers, #teamBuildings]` |
| `#targetRoles` | :17 | `[[#teamMembers, #teamBuildings]]` |
| `#sound` | :16 | `"skeleton_fire"` |

**Derived melee reach:** `collisionLoc.x = 12`. The original `targetInReachMelee` uses the strike point,
not `#reach`. With the port's clamp `max(16, min(90, 12)) = 16`px — collisionLoc 12 is BELOW the floor, so
the standard 16px minimum applies (no long-reach divergence here — contrast blackOrc's collisionLoc 70).

---

## 3. Derived-correct vs REPRODUCED (observed in port)

| Check | Derived (original) | Observed (port runtime) | Status |
|-------|--------------------|-------------------------|--------|
| Sprite char resolves to real strip | `scWarrior` | `scWarrior` (NOT blackOrc fallback) | PASS |
| All 5 strips bundled | stand/walk/weaponMelee/reel/grave | all present (1/8/20/1/2 frames) | PASS |
| Team | `#scarlet` | `#scarlet` | PASS |
| Energy | 250 | 250 / 250 | PASS |
| WalkSpeed → px/tick | 4.2 | 4.2 | PASS |
| Inertia | 50 | 50 | PASS |
| Attack type | melee (`#weaponMelee`) | `type=melee` | PASS |
| Attack fire frame | 9 (`#animframe:9`) | hit fired ONLY on frame 9 (9/9 hits) | PASS |
| damageMultiplier | 5 | 5 | PASS |
| Attack sound | `"skeleton_fire"` | `"skeleton_fire"` | PASS |
| hits roles | `[#teamMembers,#teamBuildings]` | `["#teamMembers","#teamBuildings"]` | PASS |
| Melee reach (gate) | 16 (clamp of collisionLoc 12) | targeting reach 16; attacked at 14.5px | PASS |
| AI mode | `#objAiCPU` committed hunt | `moveToAttack` all 200 ticks (acquired target tick 0) | PASS |
| Faces target | yes | `facingLeft=false` (target to the right) | PASS |
| First attack | within 200f | tick 22 (after closing ~46→14.5px) | PASS |
| Attack cadence | ~20f (weaponMelee strip length) | 9 hits / 200f ≈ 19.8 ticks/hit | PASS |
| weaponTechnique start | 0 | 0 (speedup inert) | PASS (FAITHFUL) |
| weaponTechniqueInc honored? | NO (engine hardcodes 2) | NO (`INC=2` static) | PASS (FAITHFUL) |
| Grave on death | yes | `getGraveOn=true` | PASS |
| killedInAction | yes (lethal) | true | PASS |
| Reincarnate → `fire` | 1× | 1 `fire` actor spawned at corpse | PASS |

**Result: 21/21 PASS — DIVERGENCES = 0 (no PORT bug).**

Independent reproduction confirms the prior audit's 0-divergence finding. The runtime hit-count (9 hits,
all on frame 9), reach (16px), cadence (~20f), face, and reincarnation all match the derived behavior.

---

## 4. Faithful original-game quirks (document, do NOT "fix")

### FAITHFUL: `#weaponTechniqueInc: 3` is dead data (WONTFIX)

`act_scWarrior.txt:19` sets `#weaponTechniqueInc: 3`. In the **original engine**
(`casts/script_objects/modWeaponTechnique.txt`): `addModParams` (lines 14–19) registers ONLY
`i[#weaponTechnique] = 0` — it never registers `#weaponTechniqueInc`. `on init` (line 30) sets
`pWeaponTechniqueInc = 2` **unconditionally**, ignoring data. So the per-level increment is always 2; the
data value 3 has no effect.

The port matches: `port/src/components/weaponTechnique.ts:25` `private static readonly INC = 2`, applied in
`levelUp` (`weaponTechnique.ts:37`). `spawnEnemy` forwards `weaponTechnique: num("weaponTechnique", 0)` (=0,
the starting rating) but not the inc — exactly the original's surface.

**Evidence:** original `modWeaponTechnique.txt:14-19,30` vs port `weaponTechnique.ts:25,37`.
**Fix sketch:** none — faithful. (Honoring the field would be a behavior CHANGE from the original.)

### FAITHFUL: `#stallSpeed: 1` / `#stallSpeedIncLevel: 1` not modeled (WONTFIX)

`#stallSpeed` (`act_scWarrior.txt:10`) is a property of `pMoveXY` (the `objMoveXY` per-frame
velocity-damping loop) controlling how fast reel velocity decays. The port does not model `objMoveXY`
separately; knockback resistance is approximated via `inertia` (50, forwarded correctly). The observable
outcome (a moderately knockback-resistant warrior) is preserved. Out-of-scope deliberate abstraction.

**Evidence:** `act_scWarrior.txt:10-11` (data) — no `pMoveXY` port; `inertia=50` observed in probe.
**Fix sketch:** none unless a dedicated stall-speed feel audit detects divergence.

---

## 5. Latent / non-impacting note (NOT a divergence)

### Dual `animframe`/`animFrame` key after structAttack merge

The resolved attack record carries BOTH `animframe: 9` (from `act_scWarriorSword.txt:7`, lowercase `f`,
the real data) AND `animFrame: 2` (the `structAttack` camelCase default injected during merge). The probe
dumped both keys present in the resolved record.

`resolveAttack` (`port/src/components/weapon.ts:181`) reads `r["animframe"] ?? r["animFrame"]` — the
lowercase data key wins → `[9]`. The probe confirmed the hit fires on frame 9 (all 9 hits), so this is
currently CORRECT and non-impacting. It is the same fragile dual-key smell flagged as blackOrc DIV-2: if
the resolution order were ever reversed (or the parser normalised to camelCase), the wrong value `2` would
be used. Logged here for cross-actor consistency; not counted as a divergence because the live behavior is
faithful.

**Reference:** `port/src/components/weapon.ts:181`, `port/src/data/registry.ts` (structAttack merge).

---

## 6. Summary

`scWarrior` is a straight melee CPU on `#scarlet`. Reproduced live: it acquires its `#aldevar` target on
tick 0, closes to ~14.5px (reach 16 from collisionLoc 12), and swings its `#scWarriorSword`
(`#weaponMelee`, fires on frame 9, mult 5, power 0.5, sound `skeleton_fire`) at ~20-tick cadence — the hit
lands exclusively on frame 9, exactly as `#animframe:9` dictates. Energy 250, walkSpeed 4.2 px/tick,
inertia 50, all faithful. On a lethal death it reincarnates into one `#fire` actor (observed). The sprite
char resolves to the real bundled `scWarrior` strip — no blackOrc fallback. The two data anomalies
(`#weaponTechniqueInc: 3`, `#stallSpeed: 1`) are faithfully-reproduced original quirks. The dual
`animframe`/`animFrame` key is latent but currently correct.

**No port divergences.**

---

scWarrior | DIVERGENCES=0
