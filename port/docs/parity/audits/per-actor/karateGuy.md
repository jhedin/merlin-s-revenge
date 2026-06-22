# Behavioral Audit: act_karateGuy

**Actor:** karateGuy | **Type:** #objCPUCharacter | **AiType:** #objAiCPU | **Team:** #karate (enemy)

**Method:** Derived correct behavior from `casts/data/act_karateGuy.txt` (+ inherited
`act_CPUCharacter` → `act_character` → `act_actor`, and `objCPUCharacter` / `modAnimSet` / `objAnimSet` /
`modAttack` / `objAiCPU` / `modWeaponTechnique` / `modGrave`), then **REPRODUCED** in the port via a node
harness (`tools/_audit_karateGuy.ts`, since deleted) loading the REAL `src/generated/assets.json` bundle.
Harness: `assets = {index, images:Map, img:()=>null, ensureChar:async()=>{}}`,
`grid = CollisionGrid(80,80,32)`, `teamMaster.unitMap.configure(32,0,0)`, `spawnEnemy` wired, spawned
karateGuy + a hated `monk` (#aldevar) sandbag adjacent, pushed both to `game.entities`, ticked 220 frames
calling `rebuildCombatSubstrate()` each tick. Instrumented `teamMaster.impactMeleeAttack` to COUNT hits per
swing; then a separate lethal-hit probe verified death/grave.

## DIVERGENCES = 0

karateGuy reproduces faithfully on every derived property. No port bug and no documentable original-game
quirk surfaced for this actor. (The two known port abstractions it touches — the unified A1/K1 melee damage
scale and the `reach:25` structAttack default sitting unused on a melee `#attack` — are project-wide,
intentional, and not karateGuy-specific divergences; see notes below.)

---

## Derived-correct behavior (from the ORIGINAL)

Source: `casts/data/act_karateGuy.txt`. Inherits `#CPUCharacter` (`act_CPUCharacter.txt`:
`#walkType:#anyDirSpeed`, `#pathfinding:true`, `#frictionReel:point(10,10)`) → `#character` → `#actor`.
Family template `tem_karate.txt`.

| Property | Original (file:line) | Meaning |
|----------|----------------------|---------|
| team / allegiance | `#team:#karate` (`act_karateGuy.txt:26`) | enemy; karate.hates = `[#aldevar,#cave,#monsterSummon,#goblins,#magicalAlliance,#ninja,#undead,#orcs,#village]` (`tem_karate.txt:7`); `#friends:[]` |
| energy / health | `#energy:200` (`:21`) | 200 HP |
| movement | `#walkSpeed:4` (`:28`); `#anyDirSpeed`,`#pathfinding` (CPUCharacter) | omnidirectional pathfinding walker, speed 4 |
| `#inertia` | `50` (`:16`) | knockback resistance |
| `#damageSpeed` | `3` (`:14`) | wall-slam bonus threshold |
| attack type | `#attack.animType:#naturalMelee` | natural (unarmed) MELEE, AREA-resolved (`#hits` role filter) |
| weapon | none (no `#weapon`/`#bullet`) | pure melee brawler — the `#punchKick` natural attack only |
| **#animframe (hit frames)** | `[5, 8, 12]` | a **3-hit** punch-kick combo: damage lands on strip frames 5, 8 and 12 (`modAttack.txt:597-611` — `attackFrame.getPos(currentFrame)>0` on a fresh frame) |
| damageMultiplier | `100` | melee damage multiplier |
| power | `point(0.01,0)` | tiny scalar 0.01 (×strength×mult in the K1 model) |
| collisionLoc | `point(4,0)` | strike point offset; for melee this seeds the approach/area reach (objAiCPU.targetInReachMelee uses calcStrikePoint = loc + collisionLoc), NOT `#reach` |
| reach (`#reach`) | absent → structAttack default `25` | UNUSED for melee (gates ranged only) |
| cooldown | `0` | no per-weapon cooldown → cadence is purely strip-bound |
| #hits | `[#teamMembers,#teamBuildings]` | hits enemy units + buildings |
| #name (attack) | `#punchKick` | attack identity |
| sound | `"wizard_punch"` | played at swing entry |
| **#name (sprite char)** | `"karateGuy"` (`:27`) | modAnimSet keys strips by `#name` → strips `karateGuy_{stand,walk,naturalMelee,grave,reel}` (`modAnimSet.txt:22`, `objAnimSet.txt:11-13`) |
| weaponTechnique | `0` (`:29`) | NO attack-anim speedup (`modWeaponTechnique`: technique 0 → loop never triggers) |
| dexterity / strength | `10 / 10` (`:13,25`) | melee cooldown-counter inc uses agility(=1), not dexterity |
| eyestrain | `25` (`:15`) | ranged aim scatter — irrelevant (melee) |
| dieSound | `#none` (`:18`) | silent death |
| experienceImWorth | `10` (`:23`) | XP granted on death |
| startingLevel | `0` (`:24`) | no forced level-ups at spawn |
| grave | inherits `#graveOn` default true (not set false) | leaves a 2-frame grave on death (`modGrave`, `objCPUCharacter.updateDead`) |

Family context: `kongFuChicken` (`#animframe:[5,14,18]`, mult 120, walkSpeed 6, 28-frame melee strip) and
`sumo` (`#naturalRanged`, `#bullet:#cracks`, weaponTechnique 200) — different actors, audited separately.
The `dojo` dwelling (`act_dojo.txt`) produces karateGuy / kongFuChicken / SpeedyGuy residents.

---

## Reproduced (port runtime) — derived vs observed

| Property | Derived | Observed in port harness | Status |
|----------|---------|--------------------------|--------|
| **anim char (sprite strip)** | `karateGuy` (real bundled strips) | `Anim.char = "karateGuy"`; all 5 strips present (`karateGuy_stand/walk/naturalMelee/grave/reel`) — **NOT** the blackOrc fallback | OK |
| team / target acquisition | enemy #karate; hates #aldevar | spawned `type=enemy`; `findTarget` acquired the #aldevar monk sandbag (`ai.target` set) | OK |
| energy | 200 / max 200 | `energy=200, max=200` | OK |
| attack type | `#naturalMelee` → melee | `currentAttack.type="melee", animType="#naturalMelee"`; `AI.ranged=false` | OK |
| **#animframe → hit count** | `[5,8,12]` → **3 hits per swing** | `currentAttack.animFrame=[5,8,12]`; **every completed swing fired exactly 3 hits** (`[3,3,3,3,3,3,3,3]` across 8 swings); fires on FRESH crossings of strip frames 5/8/12 (`control.ts:752`, `anim.ts:96` `attackFrame=frame+1`) | OK |
| damageMultiplier | 100 | `currentAttack.damageMultiplier=100` | OK |
| collisionLoc → melee reach | `point(4,0)` → reach = max(16, min(90, \|4\|)) = 16 | `AI.reachMelee=16`, `collisionLoc={x:4,y:0}` (`archetypes.ts:329`) | OK |
| `#reach` (unused for melee) | structAttack 25, ignored | `currentAttack.reach=25` present but melee uses reachMelee=16; ranged path never taken | OK |
| cooldown / cadence | cooldown 0, weaponTechnique 0 → strip-bound | `effectiveCooldown=17` recovers DURING the 26-tick swing → cadence = max(strip 26, 17) = **26 ticks/swing** (observed swing starts at t=1,27,53,79,…, exactly 26 apart) | OK |
| naturalMelee strip | one-shot, 17 frames, hits at f5/f8/f12 | `loop=false`, 17 frames, total 26 ticks (delays …f5=1,f6=4,…f8=1,f9=4,…f12=1,f13=4…); hits land at f5/f8/f12 | OK |
| weaponTechnique | 0 → no speedup | `WeaponTechnique` component present, `technique=0`; cadence unaffected (full 26-tick strip every swing) | OK |
| #hits | `[#teamMembers,#teamBuildings]` | `currentAttack.hits=["#teamMembers","#teamBuildings"]` | OK |
| sound | `"wizard_punch"` | `currentAttack.sound="wizard_punch"`, played at swing entry | OK |
| facing | faces target | target placed to the RIGHT → `Movement.facingLeft=false`, locked through the swing | OK |
| movement | walkSpeed 4 → 2.4 px/tick; inertia 50; damageSpeed 3 | `maxSpeed=2.4, inertia=50, damageSpeed=3` | OK |
| power / damage | scalar 0.01 ×str 10 ×mult 100 (K1 scale) | sandbag energy 50 → 31.28 over 24 hits (~0.78/hit), consistent | OK (K1 abstraction) |
| AI.power scalar | derived ≈ 4 | `ai.power=4` (CpuAI fallback scalar, used only for record-less bullets) | OK |
| eyestrain | 25 (irrelevant, melee) | `ai.eyestrain=25, ranged=false` | OK |
| startingLevel | 0 | no `forceLevelUp` at spawn | OK |
| death / grave | leaves a grave (graveOn true); dieSound #none | lethal hit → `isDead=true`, `getGraveOn()=true`, `Anim.action="grave"`, `karateGuy_grave` (2 frames) present; no die sound | OK |

---

## Notes (project-wide abstractions, NOT karateGuy divergences)

- **Melee damage model (K1/A1).** Per-hit damage is `powerScalar·strength·ENEMY_DAMAGE_SCALE·mult`
  (`weapon.ts:155`, `enemyMeleeBasePower`), a unified tuned abstraction the whole enemy roster shares.
  karateGuy's tiny `power 0.01` × strength 10 × mult 100 produces ~0.78/hit here — consistent and not a
  per-actor bug.
- **`reach:25` on a melee `#attack`.** The structAttack default `#reach` rides along on the resolved
  attack object but the melee FSM ignores it (uses `collisionLoc.x`-derived `reachMelee=16`). Faithful to
  the original (`objAiCPU.targetInReachMelee` uses the strike point, not `#reach`).
- **`effectiveCooldown` back-solve (B2 §f.3).** The port re-derives cooldown=0 → an effective counter `17`
  so the WeaponManager recovers in step with the original. Since 17 < the 26-tick strip, the strip is the
  binding clock — exactly the original's cooldown-0 strip-bound cadence. No observable divergence.

## Probe-API caveats (verified, NOT port divergences)

- An initial death probe reported `action="stand"` because it passed `takeHit` an OBJECT; the real
  signature is positional `takeHit(vx, vy, attackerId, mult)` (`combat.ts:33`). Re-run with the correct
  signature: clean kill, `action="grave"`. Not a port bug.
- `weaponTechnique` is a dedicated `WeaponTechnique` component (`weaponTechnique.ts`), not a field on
  WeaponManager — the initial `undefined` read was a wrong-probe-target, confirmed `technique=0` on the
  real component.
