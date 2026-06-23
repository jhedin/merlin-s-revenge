# Per-Actor Parity Audit: darkGolem

**Actor:** `act_darkGolem` | **objType:** `#objCPUCharacter` | **AiType:** `#objAiCPU` | **Team:** `#monsters`
**Method:** REPRODUCED in a headless harness loading the real `src/generated/assets.json` bundle
(`tools/_audit_darkGolem.ts`, now deleted). Spawned a darkGolem + an `#aldevar` player target it hates,
ticked 200 frames, observed firing / bullet flight / explosion / reincarnation.

**Result: DIVERGENCES = 0.** darkGolem is faithful. Two probe observations that look like divergences
(`getEnergy` undefined; shots "at frame 8/15") are PROBE artifacts, explained and dismissed below.

---

## 1. Derived-correct behavior (from the ORIGINAL cast/data)

Source: `casts/data/act_darkGolem.txt`, `act_darkRock.txt`, `act_doubleDarkGolem.txt`,
`act_CPUCharacter.txt`, `act_character.txt`, `act_bullet.txt`, `casts/data/tem_monsters` (in data.json).

| Property | Original value | Source |
|---|---|---|
| inherit chain | `#CPUCharacter` → `#character` → `#actor` | act_darkGolem.txt:5 |
| team / allegiance | `#monsters` (hates `#aldevar`,`#scarlet`,…; friends `#goblins`,`#swamp`) | act_darkGolem.txt:24, tem_monsters |
| energy | **750** | act_darkGolem.txt:18 |
| walkSpeed | 1 (overrides CPUCharacter's 3) | act_darkGolem.txt:32 |
| attack name / animType | `#throwBoulder` / `#naturalRanged` (ranged rock lob) | act_darkGolem.txt:9,11 |
| **#animframe (shot frames)** | **`[7, 14]`** — a LIST → **2 shots per attack cycle** | act_darkGolem.txt:9 |
| bullet | `#darkRock` | act_darkGolem.txt:12 |
| reach | 150 | act_darkGolem.txt:15 |
| firingType | `#fullstrength` → constant throw speed = strength (20) | act_darkGolem.txt:14 |
| cooldown | 0 (cadence = strip replay only) | act_darkGolem.txt:13 |
| sound | `darkGolem_fire` | act_darkGolem.txt:16 |
| dieSound | `boulder_die` | act_darkGolem.txt:21 |
| **data #name (sprite char)** | **`"darkGolem"`** → strips `darkGolem_stand/walk/naturalRanged/grave` | act_darkGolem.txt:30 |
| reincarnation | **NONE** (no `#reincarnateAs`) | act_darkGolem.txt (absent) |

### Bullet `darkRock` (the "decelerating lob")
| Property | Original value | Source |
|---|---|---|
| inherit | `#bullet` (team `#none`, role `#teamBullets`, hits `#teamMembers`) | act_darkRock.txt:3 |
| attack.type | **`#explode`** → SPLASH/area bullet (not single-target) | act_darkRock.txt:7 |
| attack.power / explodeCharge | 1 / 40 | act_darkRock.txt:5-6 |
| **#friction** | **`point(10,10)`** → loses 10%/frame → decelerating lob that STALLS | act_darkRock.txt:21 |
| explodeEvents | `bulletArrivedAtTargetLoc`, `bulletCollidedWithTarget`, `bulletLanded` | act_darkRock.txt:9-13 |
| explodeSound | `spell_explode` | act_darkRock.txt:14 |
| rotational / weight | true / 0.4 | act_darkRock.txt:16,18 |

### Context family
- **doubleDarkGolem** — energy 1000, `#animframe: [5,11,18,25]` (4 shots/cycle), collisionLoc (0,-10),
  startingLevel 5, **`#reincarnateAs: [#darkGolem, #darkGolem]`** (`#reincarnateRadius: 30`) → splits into
  two darkGolems on lethal death (act_doubleDarkGolem.txt).
- **lavaGolem / lavaDarkGolem** — team `#scarlet`, bullet `#flamingRock` (data #name `lavaDarkGolem`).
  Not the audited actor; confirms darkGolem's own `#darkRock`/`#monsters` are correct.

---

## 2. Reproduced behavior (PORT, observed)

Harness probe output (real assets bundle):

```
=== darkGolem STATIC ===
anim char            : darkGolem            (NOT the blackOrc fallback ✓)
team                 : #monsters
attack name/type     : #throwBoulder / ranged   animType: #naturalRanged
attack animFrame     : [7,14]               (✓ list preserved)
attack reach/firing  : 150 / #fullstrength  bullet: #darkRock
naturalRanged frames : 31                   (≥14 → both shot frames exist)
splashBullet set?    : true                 (darkRock #type:#explode → SPLASH ✓)
bulletChar           : darkRock             (real strip, not fallback ✓)
splash friction/type : 10 / #explode  explodeCharge: 40   (✓)

=== darkGolem DYNAMIC (200 ticks) ===
total bullets fired  : 6 (2 per cycle, cycles ~31 frames apart: shots at t7,t14 / t38,t45 / t69,t76)
golem anim char now  : darkGolem
bullet speed max/min : 18.00 / 0.19         (decelerating lob ✓)
bullet stalled?      : true   finished/exploded?: true

=== doubleDarkGolem + REINCARNATION ===
doubleDD animFrame   : [5,11,18,25]         (✓ 4-shot list)
darkGolem children   : 2                    (✓ reincarnates into TWO darkGolems)
doubleDD isDead/KIA  : true / true
```

A precise frame trace (separate probe) confirmed the bullet is BORN on the tick the strip displays
**frame 7 and frame 14** (the displayed frame advances to 8/15 by the END of that same update tick):

```
tick 7:  bullet born. attackFrame BEFORE update = 7,  AFTER update = 8
tick 14: bullet born. attackFrame BEFORE update = 14, AFTER update = 15
```

A second flight trace confirmed both explode paths: a bullet aimed slightly short overshoots and
STALLS (speed 0.19, `#bulletLanded`) then detonates; one aimed onto the target detonates on contact
(`#bulletCollidedWithTarget`). `darkRock_fly` and `darkRock_explode` strips are bundled and used.

---

## 3. Derived-correct vs observed — comparison

| Behavior | Derived correct | Observed in port | Verdict |
|---|---|---|---|
| Sprite char | `darkGolem_*` strips | `darkGolem` (anim.ts:39 → `${dn}_stand` bundled) | ✓ FAITHFUL — not blackOrc |
| Team / hates | `#monsters` vs `#aldevar` | `#monsters`, targets the player | ✓ |
| Energy | 750 | 750 (kill via loseEnergy works) | ✓ |
| Attack type | `#naturalRanged` ranged FSM | `ranged` (archetypes.ts:202-205) | ✓ |
| #animframe shots | `[7,14]` → 2/cycle | fires at frame 7 & 14, 2 bullets/cycle | ✓ |
| reach / firingType | 150 / `#fullstrength` const speed | 150, speed = strength = 18px/f | ✓ |
| bullet routing | `#explode` → splash bullet | `splashBullet` set, `darkRock` char | ✓ (archetypes.ts:311) |
| bullet friction | 10 → decel lob | 18→0.19, stalls | ✓ (weapon.ts:207, projectile.ts:120) |
| bullet explode | land / collide / arrive | detonates on land & on collide | ✓ |
| reincarnation | darkGolem: NONE | none for darkGolem; doubleDarkGolem → 2 darkGolems | ✓ |

### Dual-tree evidence (key faithful mappings, no divergence)
- **Shot frames** — original `act_darkGolem.txt:9` `#animframe:[7,14]`; port resolves to `animFrame:[7,14]`
  (`src/components/weapon.ts:186-190`) and fires once per fresh crossing where `attackFrame()∈[7,14]`
  (`src/components/control.ts:754`). Trace: born at frame 7 and 14.
- **Splash bullet** — original `act_darkRock.txt:7` `#type:#explode`; port routes `attackType==="#explode"`
  → `splashBullet` (`src/entities/archetypes.ts:311`), fired via `fireSplashBullet`
  (`src/components/control.ts:797-803`).
- **Friction lob** — original `act_darkRock.txt:21` `#friction:point(10,10)`; port reads `o["friction"].x`=10
  (`src/components/weapon.ts:207`), applies exponential decay + STALL_SPEED 0.2 detonate
  (`src/components/projectile.ts:120-134`).
- **Reincarnation** — original `act_doubleDarkGolem.txt` `#reincarnateAs:[#darkGolem,#darkGolem]`; port
  `Reincarnate` spawns both children on killed-in-action death (`src/components/reincarnate.ts:81-106`).
  darkGolem itself has no `#reincarnateAs` → no children (correct).

---

## 4. Dismissed probe artifacts (NOT divergences)

1. **`getEnergy` returned `undefined`.** The `Energy` component exposes no `getEnergy` query — only
   `energyFrac()` (`src/components/combat.ts:10`). Probe API mistake. Energy 750 is correctly applied
   internally (the lethal `loseEnergy` kill worked, and `doubleDarkGolem` died at 1000).
2. **First probe reported shots "at frame 8 / 15".** It sampled `attackFrame()` AFTER `golem.update()`
   had already advanced the strip one frame within the same tick. A before/after trace shows the bullet
   is actually born when the strip DISPLAYS frame 7 and 14 — exactly `#animframe:[7,14]`. Faithful.

No port divergences and no candidate original-game bugs surfaced for this actor.
