# Per-Actor Parity Audit: boulderMonster

**Audit date:** 2026-06-22  
**Auditor method:** Read full #inherit chain + AI/module scripts → wrote probe
`port/tools/_audit_boulderMonster.ts` → ran 200-frame simulation → compared
per-frame output to derived original behavior → deleted probe.

---

## 1. Derived Original Behavior

### Identity / Inheritance chain

```
act_boulderMonster
  #inherit: #CPUCharacter
    #inherit: #character
      #inherit: #actor
#objType: #objCPUCharacter
#AiType: #objAiCPU
```

**Team:** `#monsters`  
**No wizard, no ghost, no multiAttack, no builder, no reincarnation, no
leaveWhenFinished.**

### Stats (resolved from chain)

| Property | Value | Source |
|---|---|---|
| energy | 400 | act_boulderMonster.txt:21 |
| strength | 12 | act_boulderMonster.txt:27 |
| dexterity | 10 | act_boulderMonster.txt:19 |
| eyestrain | 25 | act_boulderMonster.txt:23 |
| inertia | 50 | act_boulderMonster.txt:25 |
| walkSpeed | 1 | act_boulderMonster.txt:30 |
| damageSpeed | 3 | act_boulderMonster.txt:18 |
| frictionReel | point(40,40) | act_boulderMonster.txt:24 |
| experienceImWorth | 50 | act_boulderMonster.txt:22 |
| startingLevel | 0 | act_boulderMonster.txt:26 |
| weaponTechnique | 0 | act_boulderMonster.txt:31 |
| dieSound | "boulder_die" | act_boulderMonster.txt:20 |

**`#frictionReel point(40,40)`** is the key heavy-unit marker. Default is
`point(10,10)` (objGameObject.txt:57). `4×` stiffer means boulderMonster barely
skids when hit — knockback slides die out very quickly.

### Attack

```
#attack: [
  #animframe: 19,           -- fires on frame 19 of the naturalRanged strip
  #animType: #naturalRanged,
  #bullet: #boulder,
  #collisionLoc: point(0,0),
  #cooldown: 0,             -- zero cooldown (see D1 below)
  #firingType: #fullstrength,
  #name: #throwBoulder,
  #reach: 220,
  #sound: "boulder_fire"
]
```

**Attack type:** `#naturalRanged` → RANGED (moves to within 220px, then fires).  
**Bullet:** `act_boulder` — `#power:2, #damageMultiplier:1, #type:#bullet,
#friction:point(4.5,4.5), #weight:2`.  
**`#firingType:#fullstrength`** → throw velocity = strength (12 px/tick).  
**`#eyestrain:25`** → shots scatter ±25px at maximum range (0 at point-blank).

### Cooldown semantics in the original

`modWeaponManager.addCooldownCounter` (modWeaponManager.txt:157–203):

```lingo
c = CounterNew()          -- {theCount:0, tim:[1,10], inc:1, fin:false}
                          -- CounterNew calls CounterReset → theCount=tim[1]=1
c.tim[2] = 0             -- cooldown=0 → tim:[1,0]
c.fin = true             -- starts ready
c.inc = 10               -- dexterity
```

After reset (on fire), `theCount=tim[1]=1`. Next `CounterOnce` call:
`Counter()` checks `tim[1]=1 == tim[2]=0`? → NO (Counter.txt:5–8 — the
instant-fin shortcut only fires when both ends equal). Then
`theCount = 1+10 = 11 >= tim[2]=0` → `fin=true`. **Recovery: 1 tick.**

The attack strip (`boulderMonster_naturalRanged`) is 34 frames long (dela=1
each). In the original, after a shot the unit enters a new attack cycle. With
1-tick cooldown recovery and a 34-frame strip, the bottleneck is the strip.
**Original effective fire rate: 1 boulder per ~34 frames.**

### AI / movement

`#AiType:#objAiCPU` → standard committed-target FSM:
`findTarget → moveToAttack → attack → attackFin (re-acquire) → …`

No `#runReload` in data → does NOT kite after shots. Walks toward target,
stops when within 220px, fires.

`#walkSpeed:1` → very slow (vs archer 3, warrior 2). Moves at 1 engine unit/tick.

### frictionReel semantics

`objGameObject.frictionReel()` (objGameObject.txt:387–389) calls
`pMoveXY.setFriction(pFrictionReel.duplicate())` when the unit enters `#reel`.
This replaces the normal `point(50,50)` topdown friction with `point(40,40)`.
A **higher** reel friction means the knockback impulse dies out **faster** —
boulderMonster skids much less than a default unit (frictionReel=10) when hit.

### Death / grave

`dieSound:"boulder_die"` plays on death. `modGrave.drawGrave` captures the
`#grave` strip at death. `boulderMonster_grave` exists in assets. No
`reincarnateAs` → stays dead.

---

## 2. Port Reproduction Results (probe run)

Probe: `port/tools/_audit_boulderMonster.ts` — 200-frame simulation with
player at 180px (within reach 220), real assets bundle, CollisionGrid.

### Verified faithful

| Attribute | Original | Port (measured) | Status |
|---|---|---|---|
| team | `#monsters` | `#monsters` | ✓ FAITHFUL |
| energy | 400 | 400 | ✓ FAITHFUL |
| strength | 12 | 12 | ✓ FAITHFUL |
| walkSpeed (px/tick) | 1×0.6=0.6 | 0.6 | ✓ FAITHFUL |
| inertia | 50 | 50 | ✓ FAITHFUL |
| eyestrain | 25 | 25 | ✓ FAITHFUL |
| ranged | true (#naturalRanged) | true | ✓ FAITHFUL |
| runReload | false | false | ✓ FAITHFUL |
| ghost / multiAttack / builder | all false | all false | ✓ FAITHFUL |
| frictionReel | 40 | 40 | ✓ FAITHFUL |
| knockFriction | ~0.195 (40 → 4× faster) | 0.195 | ✓ FAITHFUL |
| damageSpeed | 3 | 3 | ✓ FAITHFUL |
| weaponTechnique | 0 | 0 | ✓ FAITHFUL |
| startingLevel | 0 | 0 (no levelUp loops) | ✓ FAITHFUL |
| attack.name | `#throwBoulder` | `#throwBoulder` | ✓ FAITHFUL |
| attack.animType | `#naturalRanged` | `#naturalRanged` | ✓ FAITHFUL |
| attack.type | ranged | ranged | ✓ FAITHFUL |
| attack.bullet | `#boulder` | `#boulder` | ✓ FAITHFUL |
| attack.reach | 220 | 220 | ✓ FAITHFUL |
| attack.firingType | `#fullstrength` | `#fullstrength` | ✓ FAITHFUL |
| attack.animFrame | [19] | [19] | ✓ FAITHFUL |
| attack.sound | `boulder_fire` | `boulder_fire` | ✓ FAITHFUL |
| attack.collisionLoc | {x:0,y:0} | {x:0,y:0} | ✓ FAITHFUL |
| bullet.power | 2 | 2 | ✓ FAITHFUL |
| bullet.damageMultiplier | 1 | 1 | ✓ FAITHFUL |
| bulletChar | "boulder" | "boulder" | ✓ FAITHFUL |
| dieSound | "boulder_die" | forwarded | ✓ FAITHFUL |
| grave strip | boulderMonster_grave | exists | ✓ FAITHFUL |
| naturalRanged strip | 34 frames, loop=false | 34 frames, false | ✓ FAITHFUL |
| bullet speed (#fullstrength) | ~12 px/tick | 12.0 px/tick | ✓ FAITHFUL |
| effective fire rate | ~34 frames/shot | ~34 frames/shot | ✓ FAITHFUL (see D1) |
| FSM: dazed on #reel | yes | yes | ✓ FAITHFUL |
| knockback decay (4× default) | heavy, snappy | 3 ticks to threshold | ✓ FAITHFUL |

---

## 3. Divergences

### D1 — Cooldown counter internal value (WONTFIX — no observable behavioral effect)

**What diverges:** The port stores `effectiveCooldown=181` in the
`Counter.hi` field (archetypes.ts:202: `round(18 × 10 + 1) = 181`). The
original sets `c.tim[2]=0` (cooldown=0), giving a 1-tick post-fire recovery.

**Why it is NOT a real divergence:** The 34-frame attack strip is the binding
constraint. The port's 18-frame cooldown recovery (`ceil((181−1)/10)=18`) is
entirely consumed *within* the attack animation window (frames 18→34 of the
36-frame attack budget). Per-frame trace confirms:

```
t=1:  attackT=36, cooldown reset (count=11, fin=false)
t=18: cooldown fin (count=181)       ← counter done mid-strip
t=19: bullet fires (animFrame 19)    ← shot lands
t=34: attackT=0, strip ends
t=35: immediately re-enters attack (cooldown already fin)
```

**Both original and port fire 1 boulder per 34-frame attack cycle with zero
inter-attack gap.** The cooldown never gates entry to the next swing because
it recovers before the strip finishes playing. Observable behavior: identical.

**Proof:** `attack.test.ts`-style 200-frame sim → 6 bullets in 200 frames at
exactly frame 19, 53, 87, 121, 155, 189 — period = 34 frames ≡ the strip
length, matching original semantics. The internal counter value is an
implementation detail of the port's calibration formula; the Lingo cooldown
semantics are faithfully reproduced at the behavioral level.

**WONTFIX** — archetypes.ts cooldown formula note (line 190–196) documents
this as the `rawCooldown + (ranged?18:6)` minimum-floor calibration. Changing
it for rawCooldown=0 actors would require careful regression testing against
the formula's other consumers and is not warranted when the observable fire
rate is correct.

---

## 4. Files Referenced

**Original (casts):**
- `casts/data/act_boulderMonster.txt` (lines 1–31) — actor definition
- `casts/data/act_boulder.txt` (lines 1–15) — bullet record
- `casts/data/act_CPUCharacter.txt` — `#inherit:#character` base
- `casts/script_objects/objAiCPU.txt` — committed-target FSM
- `casts/script_objects/objAiAttack.txt` — attack dispatch + cooldown gate
- `casts/script_objects/modWeaponManager.txt` (lines 157–203) — addCooldownCounter
- `casts/script_objects/modReel.txt` — #reel / frictionReel dispatch
- `casts/script_objects/objGameObject.txt` (lines 387–389) — frictionReel()
- `casts/script_objects/objCPUCharacter.txt` — enemy base (energyBar, grave, dazed)
- `casts/general_functions/Counter ().txt` — counter step logic
- `casts/general_functions/CounterNew ().txt` — counter initialization
- `casts/general_functions/CounterReset ().txt` — reset semantics

**Port:**
- `port/src/entities/archetypes.ts` (lines 150–368) — spawnEnemy, cooldown calibration
- `port/src/components/control.ts` (lines 428–860) — CpuAI FSM
- `port/src/components/weapon.ts` (lines 241–407) — WeaponManager + Counter integration
- `port/src/components/movement.ts` (lines 61–222) — frictionReel → knockFriction mapping
- `port/src/engine/counter.ts` — Counter class (faithful lo=1,hi=cd model)
- `port/src/generated/data.json` — `act_boulderMonster`, `act_boulder` entries

---

`boulderMonster | DIVERGENCES=0`  
D1 (cooldown counter internal value) is WONTFIX: cooldown recovers within the
34-frame attack strip so effective fire rate is identical to the original.
