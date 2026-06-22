# Behavioral Audit: act_sumo

**Actor:** sumo | **Type:** #objCPUCharacter | **AiType:** #objAiCPU | **Team:** #karate (enemy)

Method: derived behavior from `casts/data/act_sumo.txt` (+ inherited `act_CPUCharacter` / `objCPUCharacter`,
`modWeaponTechnique`, `modGrave`, `objAiCPU`, `act_cracks`), then REPRODUCED in the port via a node harness
(`tools/_audit_sumo.ts`, deleted) loading the real `src/generated/assets.json`, spawning sumo + an inert
#aldevar sandbag, and ticking ~200 frames with `rebuildCombatSubstrate()` each tick.

## DIVERGENCES = 2

---

### DIVERGENCE 1 — `#graveOn:false` is DROPPED (PORT BUG)

**Derived-correct (original).** sumo data sets `#graveOn: false` (`casts/data/act_sumo.txt:12`). In
`modGrave.init` the flag is read straight from the data: `pGraveOn = params.graveOn`
(`casts/script_objects/modGrave.txt:25`), then forced false only for ghosts. On death,
`objCPUCharacter.updateDead` (`casts/script_objects/objCPUCharacter.txt:238-246`) branches:
`if getGraveOn()=true … fin = getAnimLooped()  else  fin = true`, and `modGrave.drawGrave`
(`modGrave.txt:31-34`) returns early when `pGraveOn=false`. So sumo leaves **NO grave** — its corpse simply
finishes/vanishes (consistent with the bundle shipping no `sumo_grave` strip).

**Observed (port).** The `Grave` component reads ONLY the ghost flag, never the data `#graveOn`:
`this.graveOn = cfg["ghost"] !== true` (`port/src/components/grave.ts:19`), and `spawnEnemy` never forwards
`graveOn` from data (`port/src/entities/archetypes.ts:151-398` — no `graveOn` key in the `build({…})` call).
Probe result after a lethal hit: `isDead=true getGraveOn=true animAction=grave`. Because no `sumo_grave`
strip exists, `Anim.animFor` falls back to `sumo_stand` (`anim.ts:160-163`) and `Anim.sprite` keeps the dead
body on screen as a static **standing corpse** (the `graveOn === false → return null` vanish branch at
`anim.ts:174` is never reached).

**Evidence (dual-tree).**
- Original: `casts/script_objects/modGrave.txt:25` (`pGraveOn = params.graveOn`) + `objCPUCharacter.txt:239`.
- Port: `port/src/components/grave.ts:19` (ignores `cfg["graveOn"]`); `port/src/entities/archetypes.ts` build
  call never passes `graveOn`.

**Classification: real PORT bug.** A dropped data property. Systemic — 5 actors set `#graveOn:false`
(sumo, skelitonLord, skelitonUpper, orcInvasion, undeadInvasion); all incorrectly leave a grave/corpse.
Fix would thread `graveOn` from data into the build and have `Grave.init` honor it
(`graveOn = cfg["graveOn"] !== false && cfg["ghost"] !== true`).

---

### DIVERGENCE 2 — Ranged firing reach inflated 25 → 60 (PORT BUG)

**Derived-correct (original).** `#attack.reach: 25` (integer). `#animType:#naturalRanged` →
`AttackSetTypeFromAnimType` resolves the attack `#type` to `#ranged`
(`casts/general_functions/AttackSetTypeFromAnimType().txt`). `objAiCPU.targetInReachRanged`
(`casts/script_objects/objAiCPU.txt`, `targetInReachRanged`) with an integer reach uses
`distToTarget < reach*reach` = 625 px² → sumo only fires when the target is within **25 px** (nearly
adjacent — a very short-range thrower).

**Observed (port).** `EnemyAI.init` clamps the ranged reach with a **floor of 60**:
`this.reachRanged = Math.min(220, Math.max(60, cfg["atkReach"]))` (`port/src/components/control.ts:502`;
same clamp at `:675`). Probe spawn diag: `currentAttack.reach=25` but `AI.reachRanged=60`. So sumo fires
from up to **60 px** — 2.4× the intended standoff. (Floor exists to cap a caster's `reach:9999`; it
over-applies to genuinely short ranged reaches.)

**Evidence (dual-tree).**
- Original: `casts/script_objects/objAiCPU.txt` `targetInReachRanged` (integer reach → `dist < reach²`, reach=25).
- Port: `port/src/components/control.ts:502` (`Math.max(60, cfg["atkReach"])`).

**Classification: real PORT bug** (minor — affects engagement distance, not damage/cadence). sumo (reach 25)
is the clearest victim; any ranged actor with `#reach < 60` is over-extended.

---

## FAITHFUL / VERIFIED (no divergence)

| Property | Derived | Observed in port | Status |
|----------|---------|------------------|--------|
| team / allegiance | `#karate` (enemy); karate.hates[0] includes `#aldevar` (`tem_karate.txt`) | spawns `type=enemy`, `findTarget` acquires the #aldevar dummy | OK |
| energy | 750 | `energy:750` forwarded | OK |
| attack type | `#naturalRanged` → `#ranged` thrower | `currentAttack.type=ranged`, `AI.ranged=true` | OK |
| bullet | `#cracks` | `cracks` projectile spawns on fire (cracks_fly/explode strips bundled) | OK |
| `#animframe` firing frame | `[41]` (raw lowercase key overrides structMaster default `animFrame:2`) | `resolveAttack` reads `animframe` → `[41]`; FIRE observed at strip frame 41, once per cycle (7 shots in 200 ticks, all on frame 41) | OK |
| **`#weaponTechnique:200` cadence speedup** | adds 200/cycle, spends 2 frames/cycle (200 ÷ frameValue 100) → ~2× anim speedup (`modWeaponTechnique.skipFramesForWeaponTechnique`) | naturalRanged strip advances ~2 frames/tick (1,3,4,7,8,11,…41); 42-frame windup completes in ~21 ticks instead of 42 → fire-to-fire ≈ 21–23 ticks | OK |
| firingType | `#fullstrength` → throw speed = strength | `WeaponManager` reads `firingType=#fullstrength`; throwSpeed = strength(20) | OK |
| strength / dexterity | 20 / 10 | forwarded (dexterity seeds ranged cooldown inc) | OK |
| cooldown | 0 → cadence is strip-bound | effectiveCooldown back-solve recovers in ~18 ticks < ~21-tick strip → strip-bound cadence (faithful feel) | OK |
| runReload | not set → false (`objCPUCharacter` default) | `AI.runReload=false` (data-flag gate, sumo isn't a kiter) | OK |
| movement (`walkType:#anyDirSpeed`, walkSpeed 15) | inherited from CPUCharacter | `walkSpeed 15 × 0.6` px/tick; stands & fires when in reach | OK |
| strips resolve to real bundled art | stand / walk / reel / naturalRanged + cracks | every action resolved to a real bundled strip — **no fallback** (except the grave fallback, which is Divergence 1) | OK |
| experienceImWorth | 50 | forwarded to Experience | OK |

## Notes / non-issues
- The data `#attack` object printed by the registry shows BOTH `animFrame:2` (structMaster default) and
  `animframe:[41]` (sumo's real key). `resolveAttack` reads `animframe` first (`weapon.ts:181`), so the live
  attack correctly fires on `[41]`. No divergence.
- After reaching the last frame the one-shot strip HOLDS at frame 41 between re-entries (cosmetic; the fire
  still occurs once per cycle at the correct cadence). Not flagged.
- Probe note: `spawnEnemy` does NOT push into `game.entities` and `teamMaster.cullTeamList` needs a populated
  roster — the harness must push spawned entities and (for `findTarget`) the target's team must be registered.
  Early "no target / no attack" readings were harness artifacts, not port divergences (corrected before the
  findings above).
