# scArcher — Per-Actor Parity Audit (REPRODUCED)

Method: behavior derived purely from the original cast/data, then REPRODUCED in the port via a
throwaway node harness (`tools/_audit_scArcher.ts`, since deleted) that loaded the REAL
`src/generated/assets.json` bundle, spawned `scArcher` against a hostile `archer` (#aldevar) target,
and ticked 200 frames + a lethal-death pass. Observed: strip resolution, shot count per `#animframe`,
bullet, cadence, kiting, facing, death/grave/reincarnate. Bullets were attributed by `Projectile.ownerId`
so the target's return fire did not contaminate scArcher's shot count.

Verdict: **CLEAN — 0 port divergences.** All behavior reproduces faithfully. Two FAITHFUL original-game
quirks are catalogued below (reproduce-as-is, do NOT fix). The pre-existing audit's prose contained one
inaccurate narrative claim (kiting), corrected here against the reproduced behavior.

---

## SECTION 1 — Derived-correct behavior (from the ORIGINAL)

Source: `casts/data/act_scArcher.txt`, `act_scArcherBow.txt`, `act_scArcherArrow.txt`;
`casts/script_objects/objAiCPU.txt`, `objCPUCharacter.txt`; `casts/script_objects/modAttack.txt`.

| Aspect | Derived-correct (original) | Source |
|---|---|---|
| objType / AiType / inherit | #objCPUCharacter / #objAiCPU / #CPUCharacter | act_scArcher.txt |
| team / allegiance | #scarlet (hates #aldevar et al.) | act_scArcher.txt |
| energy | 175 | act_scArcher.txt |
| strength / dexterity | 15 / 3 | act_scArcher.txt |
| walkSpeed | 5 (CPUCharacter base 3, overridden) | act_scArcher / act_CPUCharacter.txt |
| inertia / damageSpeed | 60 / 4 | act_scArcher.txt |
| reincarnateAs | [#fire] | act_scArcher.txt |
| weapon | #scArcherBow | act_scArcher.txt |
| attack type / animType | ranged / #weaponRanged | act_scArcherBow.txt |
| **#animframe** | **9 (SCALAR, not a list)** | act_scArcherBow.txt:`#animframe: 9` |
| #firingType | #fullstrength (constant speed = strength) | act_scArcherBow.txt |
| bullet | #scArcherArrow | act_scArcherBow.txt |
| reach | 110 | act_scArcherBow.txt |
| #cooldown | 0 | act_scArcherBow.txt |
| sound | "goblin_fire" | act_scArcherBow.txt |
| targetRoles | [[#teamMembers, #teamBuildings]] (one tier, both) | act_scArcherBow.txt |
| arrow power / damageMultiplier | 0.9 / 5 | act_scArcherArrow.txt |
| arrow weight / friction | 0.4 / point(5,5) | act_scArcherArrow.txt |
| runReload (kite) | **false** — no `#runReload` key; `pRunReload` defaults false | objCPUCharacter.txt:30,62 |

Original firing rule (`modAttack.txt` `onAttackFrame`, lines ~585-620): a hit fires only on a FRESH anim
frame (`getAnimFrameFresh`); if `pAttack.animFrame` is a `#list` it fires when the current frame is in the
list, else (scalar) it fires when `currentFrame = animFrame`. So scArcher's scalar `9` ⇒ exactly ONE shot
per attack, on frame 9. After each attack, `objAiCPU.attackFin` checks `getRunReload()` — false ⇒
`goMode(#moveToAttack)` (NO kiting).

---

## SECTION 2 — Reproduced behavior (port, RUN)

Harness output (real assets.json bundle, scArcher vs hostile archer, 200 ticks):

```
char: scArcher | strips: weaponRanged, walk, stand, reel, grave
ranged: true  runReload: false  reachRanged: 110  reach(melee): 22  team: #scarlet
currentAttack: name #scArcherBow, type ranged, animType #weaponRanged, animFrame [9],
               firingType #fullstrength, reach 110, cooldown 55, bullet #scArcherArrow
bulletAttack: powerScalar 0.9, mult 5 | bulletChar scArcherArrow
strip resolution: scArcher_{stand,walk,weaponRanged,grave,reel} all OK (bundled);
                  scArcherArrow_fly OK; weaponRanged = 10 frames, loop=false
modes visited: { moveToAttack:158, dazed:36, findTarget:6 }
performAttack calls: 4  (one shot fired per attack, on frame 9, frameFresh=true)
scArcher bullets spawned (ownerId-filtered): 4  fire ticks [17,77,138,165]
clean inter-shot cadence (uninterrupted): ~27 ticks
facingLeft (target to the right): false  (faces target correctly)
death: loseEnergy lethal -> isDead true; reincarnate spawned exactly 1 #fire actor at corpse;
       grave strip bundled; #fire child resolves to real fire_stand (no fallback)
```

### Strip resolution (REPRODUCED, no fallback)
Every action scArcher uses resolves to a REAL bundled `scArcher_*` strip — `stand`, `walk`,
`weaponRanged` (10f one-shot), `grave`, `reel`. The fired arrow resolves to `scArcherArrow_fly`
(bulletChar derived from the bullet actor's `#name "scArcherArrow"`). The `#fire` reincarnation child
resolves to a real bundled `fire_stand`. **No `_stand` fallback, no `blackOrc` stand-in anywhere.**
(anim.ts:160-163 `animFor` would fall back to `scArcher_stand`, and `spriteCharOr` to `blackOrc`, only if
a strip were missing — none are.)

### Shot count per #animframe (REPRODUCED)
`#animframe: 9` (scalar) → port `resolveAttack` maps scalar `9` → `[9]` (weapon.ts:181-185) → exactly
ONE shot per attack on frame 9. Instrumented `performAttack` ran **4 times over 4 attack cycles**, each on
a fresh frame-9 crossing (control.ts:744-745 `frameFresh() && attackFrames.includes(attackFrame())`).
The 10-frame one-shot `scArcher_weaponRanged` strip crosses frame 9 once per play, and the `looped()`
catch-up shot (control.ts:749) is guarded by `attackFired` (already true) — no double-fire.
(The initial "doubled fire ticks" observation was the TARGET archer's return fire; once filtered by
`Projectile.ownerId`, scArcher fires cleanly 1/attack.)

### Bullet, cadence, firingType (REPRODUCED)
Fires `#scArcherArrow` (power 0.9, mult 5). `#fullstrength` → constant throw speed = `max(1, strength)` =
15 (control.ts:779-780). Effective cooldown derived to 55 (archetypes.ts:194-207); counter recovers in
18 ticks; with the ~10-tick attack-strip window this yields the observed ~27-tick uninterrupted re-fire
cadence (longer gaps in the 200-tick run came from `dazed` interruptions by the target's return fire).

### Kiting / FSM (REPRODUCED)
`runReload: false` (no `#runReload` key; AiType `#objAiCPU`, not spellcaster; animType not `#magic` →
archetypes.ts:237-238 yields false). NO kiting. FSM ran `moveToAttack → attack → moveToAttack`, never
`runReload`/`optimumPosition`. Faithful to `objAiCPU.attackFin` (control.ts:712-713).

### Targeting / death (REPRODUCED)
`targetRoles [[#teamMembers, #teamBuildings]]` read as one priority tier (teams.ts:156). scArcher acquired
and fired at the #aldevar archer (#scarlet hates #aldevar). Lethal death sets `isDead`, leaves a grave
(`getGraveOn` true → grave strip bundled), and spawns exactly ONE `#fire` actor at the corpse
(reincarnate.ts:68-107) — faithful to `#reincarnateAs: [#fire]`.

---

## SECTION 3 — Divergences

**PORT DIVERGENCES: 0.** No action fell back to `_stand`/`blackOrc`; shot count, bullet, cadence,
firingType, targeting, facing, death, grave, and reincarnation all reproduce as derived.

### Candidate ORIGINAL-GAME quirks (FAITHFUL — reproduce, do NOT fix)
1. **`#strenghtIncLevel` typo** (act_scArcher.txt) — the shipped key is misspelled ("strenght"). The port
   reads the same misspelled key, so the per-level strength growth (0.5) applies exactly as in the original.
   Faithful; do not "fix" the spelling.
2. **`#animframe: 9` as a SCALAR** (act_scArcherBow.txt) — the sibling `archerBow` uses the list form
   `[9]`. The original `onAttackFrame` (modAttack.txt) handles scalar and 1-element-list identically
   (1 shot at frame 9), and the port normalizes scalar `9` → `[9]` to the same result. A harmless data
   inconsistency in the shipped game, faithfully reproduced.

### Calibration adaptation (documented, not a divergence)
- **Effective cooldown 55 / ~27-tick cadence** — the port re-derives ranged-enemy cooldown from
  `rawCooldown(0) + dexterity(3)` (archetypes.ts:194-207, B2 plan §f.3). `#cooldown: 0` would otherwise
  re-fire every tick. This abstraction is applied uniformly to all ranged enemies, not scArcher-specific.

### Note on the prior audit
The previous `scArcher.md` (verdict CLEAN) was a code-read. Its data table is correct, but Section 5's
prose ("scArcher … uses updateRunReload backs away at 70% of reachRanged") is INACCURATE: scArcher has no
`#runReload` and the reproduced FSM never enters runReload. The corrected, reproduced behavior is above
(no kiting). Final verdict is unchanged: CLEAN.
