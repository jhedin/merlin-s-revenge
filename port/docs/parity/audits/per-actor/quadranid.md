# Quadranid — Per-Actor Parity Audit (REPRODUCED)

Method: derived correct behaviour from the original cast/data, then RAN the port headlessly
(`tools/_audit_quadranid.ts`, now deleted) against the REAL `src/generated/assets.json` bundle —
spawned the actor with a live (inert) #aldevar target, ticked 220 frames with `rebuildCombatSubstrate()`
each tick, and observed strip resolution / shot count / cadence / facing / death. Result: **FAITHFUL,
0 port divergences.** The prior version of this doc was a code-read only; this one is reproduction-backed.

## SECTION 1 — Derived-correct behaviour (from the ORIGINAL)

`casts/data/act_quadranid.txt` — `#inherit #CPUCharacter`, `#objType #objCPUCharacter`, `#AiType #objAiCPU`:

| Property | Original (act_quadranid.txt:line) |
|---|---|
| team | `#monsters` (:28) — hunts #aldevar (player team) |
| energy | 80 (:22) |
| walkSpeed | 4 (:30) |
| strength | 10 (:27) — drives #fullstrength throw speed |
| dexterity | 1 (:20) — ranged cooldown-counter inc |
| eyestrain | 40 (:24) — ranged aim scatter |
| inertia / damageSpeed | 50 (:25) / 3 (:19) |
| experienceImWorth | 5 (:23) |
| attack #name | `#fireLaser` (:14) |
| attack #animType | `#naturalRanged` (:9) → `type=#ranged` (AttackSetTypeFromAnimType) |
| attack #animframe | 23 (:8) — fires on strip frame 23 (scalar) |
| attack #bullet | `#laser` (:10) |
| attack #reach | 175 (:15) |
| attack #cooldown | 30 (:12) |
| attack #firingType | `#fullstrength` (:13) → throw speed = strength (constant) |
| attack #collisionLoc | point(0,-5) (:11) — muzzle |
| attack #sound | "quadranid_fire" (:16) |
| dieSound | `#none` (:21) |

**Laser bullet** (`act_laser.txt`): `#inherit #bullet`, `#type #bullet`, damageMultiplier 10, power 0.3,
friction point(3,3), weight 0.4. Plain single-target bullet (NOT splash/explode).

**Original fire loop** (`objAiAttack.txt`): enter `#attack` → play `#naturalRanged` strip → on
`isOnAttackFrame` (`modAttack.txt:577`: `getAnimFrameFresh() AND currentFrame==animFrame` → frame 23,
fires ONCE per strip-play) call `performAttack` (`:297` → performRangedAttack + `resetCooldown`) → on
`getAnimLooped` `attackFin(#completed)` leaves attack mode. Re-attack gated by `getCooldownFin()`
(`modWeaponManager.txt:207`). Counter (`Counter ().txt`/`CounterNew ().txt`): `tim=[1,cooldown=30]`,
`inc=dexterity=1`; reset→theCount=1, recovers in `ceil((30-1)/1)=29` ticks.
**Original observable inter-shot gap ≈ 50–52 ticks** (fire@frame23 → strip ends @28 ≈ 5t → wait ~24t for
cooldown fin → re-enter → 23t to refire).

**quadAura** (`act_quadAura.txt`): a SEPARATE placeable freeze-mine — `#objMine`, `#teamMines`,
`#payloadFunction #takeFreeze`, freezeMultiplier .5, power .25, explodeCharge 18, triggerRadius 16,
`glowTeal false`, `#team #monsters`. It appears ONLY in the aura-key list of `tlk_merlinOpenObjects_key.txt`
(:227, alongside orcAura/undeadAura/snowAura/iceAura) — it is NOT referenced, spawned, or attached by
`act_quadranid.txt` (no #aura/#summon/#produce/#mine property anywhere on the quadranid). The quadranid is
a plain ranged laser shooter; the aura is an unrelated map-placed mine.

## SECTION 2 — Reproduced in the port (RAN)

Harness: real `assets.json` index, `images=new Map()` (img→null), `CollisionGrid(80,80,32)`,
`unitMap.configure(32,0,0)`, `rebuildCombatSubstrate()` per tick. Spawned quadranid @x=200 with an inert
#aldevar sponge @x=360 (~160px, inside reach 175); ticked 220 frames.

Observed:
- **Strips all resolve to REAL bundled strips — NO fallback.** Anim requested `quadranid_stand`,
  `quadranid_naturalRanged`, `quadranid_grave`; all present (28-frame naturalRanged, loop=false, delay 1).
  `MISSING strips that fell back: none`.
- **Attack = #naturalRanged, fires the laser on strip frame 23** (first shot at tick 23). One shot per
  strip-play (matches scalar #animframe 23, fresh-crossing-only).
- **Bullets fired: 5 in 220 ticks; shotTicks 23,70,117,164,211; inter-shot gap = 47,47,47,47 (constant).**
- firingType `#fullstrength` → throw speed = strength 10 (`control.ts:779-780`).
- **Facing:** target to the RIGHT → `facingLeft=false` (faces target). Committed target acquired,
  mode `moveToAttack`.
- **Death/grave:** `loseEnergy(1000)` → `isDead=true`, `getGraveOn=true`, Anim action→`grave`
  (`quadranid_grave` exists, 2 frames). (sprite()==null in-harness only because `images` Map is empty —
  a harness artefact, NOT a divergence.)
- quadAura: bundle DOES carry `quadAura_stand/_primed/_explode` strips, but the quadranid never spawns it
  (port has no aura link on quadranid — only a comment in `mine.ts:43` listing aura mine types). Matches original.

## SECTION 3 — Derived-correct vs Observed

| Aspect | Derived-correct (original) | Observed (port, RAN) | Verdict |
|---|---|---|---|
| Team / allegiance | #monsters, hunts player | #monsters, committed an #aldevar target | FAITHFUL |
| Energy / strength / walkSpeed | 80 / 10 / 4 | resolveActor 80 / 10 / 4 | FAITHFUL |
| Attack type | ranged laser, frame 23, once/play | ranged laser, fires @frame 23, once/play | FAITHFUL |
| Bullet | #laser (single-target bullet) | bulletAttack (non-splash) path | FAITHFUL |
| firingType | #fullstrength → speed=strength | speed = strength 10 | FAITHFUL |
| Reach | 175 | acquires/fires from ~160px | FAITHFUL |
| Facing | faces target | facingLeft tracks target side | FAITHFUL |
| Death / grave | leaves grave (getGraveOn) | isDead + getGraveOn + grave strip | FAITHFUL |
| quadAura | independent map mine, not spawned | not spawned by quadranid | FAITHFUL |
| **Inter-shot cadence** | **≈50–52 ticks** (raw cooldown 30 + strip replay) | **47 ticks** (effectiveCooldown 48 calibration) | **FAITHFUL (calibrated)** — see note |

### Candidate ORIGINAL-game quirks (faithful — do NOT "fix")
- **eyestrain 40** is very high for a 175-reach shooter, so the laser scatters widely at range and rarely
  lands a hit at the edge of reach (`aimWithEyestrain`, scaled by dist/reach). This is an original-data
  characteristic, faithfully reproduced.

### Cadence note (NOT a divergence)
The port's `spawnEnemy` deliberately re-derives the ranged recovery as
`framesWanted = ceil((cooldown-1)/inc) + 18 = ceil(29/1)+18 = 47`, `effectiveCooldown = round(47*1+1) = 48`
(`archetypes.ts:206-207`), so the WeaponManager Counter recovers in 47 ticks — folding the original's
strip-replay/attackFin wait (~24t) plus refire-strip time into one cooldown bound. Observed gap 47 ≈
original's ~50–52. This is the port's documented "+18" calibration (`archetypes.ts:189-207`,
`weapon.ts:368`), a deliberate abstraction kept stable for balance/tests — a FAITHFUL approximation, not a
port bug.

## Conclusion

**FAITHFUL — 0 port divergences.** Reproduction confirms every action resolves to a real bundled strip
(no fallback), the laser fires exactly once per attack on strip frame 23 (matching #animframe), the
#fullstrength throw + 175 reach + facing + committed-target FSM + death/grave all match the derived-correct
original. The cadence (47-tick gap) is the port's documented cooldown calibration of the raw 30-frame
cooldown, not a divergence. quadAura is correctly an independent map mine, never spawned by the quadranid.
