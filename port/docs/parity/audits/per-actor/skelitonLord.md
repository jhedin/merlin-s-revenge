# Per-Actor Parity Audit: `skelitonLord`

**Method:** REPRODUCED — derived correct behavior from `casts/data/act_skelitonLord.txt` +
`act_skelitonLordSword.txt`, then ran the real port against the bundled `assets.json` via a throwaway
harness (`tools/_audit_skelitonLord.ts`, since deleted). Spawned the lord with a live `#aldevar` target,
ticked 250 frames, then killed it and ticked the death/reincarnation path.

**Verdict:** **CLEAN — no port divergences.** All derived behaviors reproduce faithfully in the port.

---

## SECTION 1 — Derived-correct behavior (from the ORIGINAL)

| Property | Original (file:line) | Value |
|---|---|---|
| objType / AiType | act_skelitonLord.txt | `#objCPUCharacter` / `#objAiCPU` (melee CPU) |
| team | act_skelitonLord.txt:`#team` | `#undead` (hates `#aldevar` et al.) |
| energy | act_skelitonLord.txt | 750 |
| strength / dexterity | act_skelitonLord.txt | 14 / 2 |
| walkSpeed | act_skelitonLord.txt | 5 |
| inertia / stallSpeed / frictionReel | act_skelitonLord.txt | 75 / 7 / point(30,30) |
| experienceImWorth / eyestrain / damageSpeed | act_skelitonLord.txt | 75 / 30 / 5 |
| **weapon** | act_skelitonLord.txt:`#weapon` | `#skelitonLordSword` (no own `#attack`, no `#character`) |
| **graveOn** | act_skelitonLord.txt:14 | **false → vanishes on death, NO corpse/grave** |
| **reincarnateAs** | act_skelitonLord.txt:11 | `[#skelitonUpper, #skelitonLowerLeg, #skelitonSword]` |
| reincarnateRadius | act_skelitonLord.txt | 40 |
| **sprite char (#name)** | act_skelitonLord.txt:`#name` | `"skelitonLord"` (no `#character` anywhere up the chain) |

**Weapon `#skelitonLordSword`** (act_skelitonLordSword.txt):
- `#animType: #weaponMelee`, `#animframe: 5` (line 7), `#cooldown: 0`
- `#power: point(3, 0)`, `#damageMultiplier: 12` (line 13), `#collisionLoc: point(80,-15)` (line 9)
- `#hits: [#teamMembers, #teamBuildings]`, `#sound: "skeleton_fire"`

**Derived expectations:**
1. Sprite must resolve to the **`skelitonLord` family strip**, NOT the `blackOrc` stand-in (lord ships its
   own `_stand/_walk/_reel/_weaponMelee` art).
2. Melee CPU: approach target, swing `weaponMelee` strip, land **exactly one hit per swing** at `#animframe 5`.
3. `graveOn:false` → on death the body **vanishes** (no grave frame held behind the living).
4. On killed-in-action death, **split into 3 children** `[skelitonUpper, skelitonLowerLeg, skelitonSword]`
   (the start of a deep undead cascade), fanned out within radius 40.

---

## SECTION 2 — Observed (port, RUN)

| Check | Expected | Observed | Status |
|---|---|---|---|
| **Sprite char resolves** | `skelitonLord` (not blackOrc) | `spriteCharOr("skelitonLord")` → **`skelitonLord`**; `_stand`(1f) `_walk`(8f) `_reel`(1f) `_weaponMelee`(6f) all bundled | ✓ |
| Anim char on spawned entity | `skelitonLord` | `lord.animChar = skelitonLord` | ✓ |
| Targeting | finds the `#aldevar` target | `findTarget → obj` found; `#aldevar` in undead hate-tier | ✓ |
| **Attack type / frame** | melee, `animFrame=[5]` | `getCurrentAttack` → `type:melee reach:25 mult:12 name:#skelitonLordSword animFrame:[5]`; `CpuAI.attackFrames=[5]` | ✓ |
| **Hits per swing (#animframe)** | 1 hit / swing | 6 swing-entries over 250f → **6 hits** (1:1); target killed | ✓ |
| Facing | faces target (right) | `facingLeft=false` (target to the right) | ✓ |
| **Death / graveOn:false** | vanish, no corpse | dead → `getGraveOn=false` → `Anim.sprite()` returns **`null` (vanish)** | ✓ |
| **Reincarnation** | `[Upper, LowerLeg, Sword]` | 3 children: `skelitonUpper` / `skelitonLowerLeg` / `skelitonSword`, correct order, each with its own family anim char | ✓ |

The `skelitonLord_weaponMelee` strip is **6 frames** (1-based 1–6), so `#animframe 5` is a real frame and
fires once per one-shot swing — no dropped strip, no wrong shot count.

---

## SECTION 3 — Comparison & findings

**0 PORT DIVERGENCES.**

### Faithful, worth noting (NOT bugs)
- **No `skelitonLord_grave` strip is bundled.** Correct and expected: `graveOn:false` means the lord never
  draws a grave, so the builder had no reason to extract one. The port's `Anim.sprite()`
  (`port/src/components/anim.ts`) returns `null` for a dead `graveOn:false` actor before it ever looks up a
  `_grave` strip — so the absence is benign.
- The resolved attack object carries an inherited top-level `animFrame:2` alongside the raw `animframe:5`.
  The port's parser (`port/src/components/weapon.ts:181-185`) correctly prefers the raw `r["animframe"]`,
  yielding `[5]` — verified at runtime (`CpuAI.attackFrames=[5]`). No divergence.

### Harness note (method integrity, NOT a port bug)
The port's `spawnEnemy/spawnAlly` helpers do **not** push the new entity onto `game.entities` — the room
layer does (`port/src/world/rooms.ts:213,247,430`). A harness that omits this push leaves the unit-map /
team roster empty, so `findTarget` returns nothing and the actor never engages or reincarnates. This was
confirmed to be a HARNESS gap (not a port bug) by reproducing the identical "never engages" failure on the
known-good `blackOrc`, then fixing it by pushing spawned entities exactly as the room does — after which the
lord engaged and reincarnated correctly. Reincarnation children are pushed by
`port/src/components/reincarnate.ts:104`.

---

**Conclusion:** `skelitonLord` is faithfully ported. Sprite resolves to its own family strip (not
blackOrc), the `#weaponMelee #animframe 5` swing lands one hit per swing, `graveOn:false` vanishes with no
corpse, and the 3-way reincarnation cascade (`Upper / LowerLeg / Sword`) fires on killed-in-action death.
