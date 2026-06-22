# Per-Actor Parity Audit: lavaGolem

**Actor:** `act_lavaGolem` | **objType:** `#objCPUCharacter` | **AiType:** `#objAiCPU` | **Team:** `#scarlet`
**Renders as (data `#name`):** `lavaDarkGolem`

Audit method: derived from original cast/data, then REPRODUCED with a live 200-frame run on the real
`@/generated/assets.json` bundle (probe `port/tools/_audit_lavaGolem.ts`, since deleted).

---

## 1. Derived Correct Behavior (original)

Source: `casts/data/act_lavaGolem.txt`. (Note: `act_lavaDarkGolem.txt` is a byte-identical duplicate of the
same record — both carry `#name: "act_lavaGolem"` at the top and the inner data `#name: "lavaDarkGolem"`.)
The objects key (`tlk_merlinOpenObjects_key.txt:174`) places `#lavaGolem` as the spawn symbol.

### Identity / stats

| Field | Value | Source |
|-------|-------|--------|
| `objType` | `#objCPUCharacter` | `act_lavaGolem.txt:3` |
| `AiType` | `#objAiCPU` | `act_lavaGolem.txt:4` |
| `inherit` | `#CPUCharacter` | `act_lavaGolem.txt:5` |
| `team` | `#scarlet` | `act_lavaGolem.txt:28` |
| data `#name` (sprite) | `"lavaDarkGolem"` | `act_lavaGolem.txt:29` |
| `energy` | 750 | `act_lavaGolem.txt:21` |
| `strength` | 20 | `act_lavaGolem.txt:27` |
| `dexterity` | 10 | `act_lavaGolem.txt:19` |
| `eyestrain` | 25 | `act_lavaGolem.txt:23` |
| `walkSpeed` | 1 | `act_lavaGolem.txt:30` |
| `inertia` | 50 | `act_lavaGolem.txt:25` |
| `damageSpeed` | 3 | `act_lavaGolem.txt:18` |
| `frictionReel` | point(50,50) | `act_lavaGolem.txt:24` |
| `weaponTechnique` | 0 | `act_lavaGolem.txt:31` |
| `startingLevel` | 0 | `act_lavaGolem.txt:26` |
| `experienceImWorth` | 50 | `act_lavaGolem.txt:22` |
| `dieSound` | `"boulder_die"` | `act_lavaGolem.txt:20` |
| (no `#reincarnateAs`) | absent | — |

### Attack (`#attack` proplist)

| Field | Value | Source |
|-------|-------|--------|
| `name` | `#throwBoulder` | `act_lavaGolem.txt:14` |
| `animType` | `#naturalRanged` | `act_lavaGolem.txt:9` |
| `bullet` | `#flamingRock` | `act_lavaGolem.txt:10` |
| `reach` | 150 | `act_lavaGolem.txt:15` |
| `animframe` | `[7, 14]` (2 hit frames) | `act_lavaGolem.txt:8` |
| `firingType` | `#fullstrength` | `act_lavaGolem.txt:13` |
| `cooldown` | 0 (data) | `act_lavaGolem.txt:12` |
| `collisionLoc` | point(0,0) | `act_lavaGolem.txt:11` |
| `sound` | `"darkGolem_fire"` | `act_lavaGolem.txt:16` |

### Bullet actor: `act_flamingRock`

| Field | Value | Source |
|-------|-------|--------|
| `inherit` | `#bullet` | `act_flamingRock.txt:3` |
| `attack.type` | `#explode` | `act_flamingRock.txt:8` |
| `attack.explodeCharge` | 40 | `act_flamingRock.txt:6` |
| `attack.power` | 1 | `act_flamingRock.txt:7` |
| `reincarnateAs` | `[#fire]` (leaves a fire mine) | `act_flamingRock.txt:21` |
| `explodeSound` | `"spell_explode"` | `act_flamingRock.txt:18` |
| `rotational` | true | `act_flamingRock.txt:22` |
| `weight` | 0.4 | `act_flamingRock.txt:23` |

### Derived behavior

- **lavaGolem == darkGolem mechanically, with two deltas:** `team` `#scarlet` (vs darkGolem `#monsters`)
  and `bullet` `#flamingRock` (vs darkGolem `#darkRock`). Identical stats, attack frames, reach, AI.
- **AI**: `#objAiCPU` committed-target FSM. RANGED (`#naturalRanged`, reach 150). No `runReload`, no ghost.
- **Shot count**: `#animframe [7, 14]` → **2 flamingRock bullets per attack cycle** (one at strip frame 7,
  one at frame 14 of the 26-frame `naturalRanged` strip). NOT 1.
- **Bullet path**: flamingRock is `#explode` → splash bullet (`fireSplashBullet`), AREA detonation.
- **Bullet leave-behind**: flamingRock `#reincarnateAs [#fire]` → each rock hatches a **fire mine** (team
  `#fire`) when it lands/collides/detonates. (darkGolem's darkRock does NOT.)
- **Throw velocity**: `#firingType #fullstrength` → constant speed = strength = 20 px/tick.
- **Muzzle**: `collisionLoc (0,0)` → bullet spawns at the golem's loc, no offset.
- **walkSpeed 1** → port 0.6 px/tick (×0.6 spawn convention).
- **NO actor-level reincarnation** — unlike `doubleDarkGolem` (`#reincarnateAs [#darkGolem, #darkGolem]`),
  lavaGolem does NOT split on death. It just dies (grave, `dieSound "boulder_die"`, XP 50).

---

## 2. Reproduced in Port (live 200-frame run)

Probe: `port/tools/_audit_lavaGolem.ts` (deleted after audit). Harness per spec: real `assets.json` index,
`CollisionGrid(80,80,32)`, `teamMaster.reset()` + `unitMap.configure(32,0,0)`, `rebuildCombatSubstrate()`
each tick. Spawn `spawnPlayer(400,200)` + `spawnEnemy("lavaGolem",520,200)` (120px < reach 150 → fires
immediately). `#scarlet` hates `#aldevar` (`tem_scarlet.hates`), so the golem acquires the player.

### Resolved stats

| Stat | Expected (derived) | Reproduced | Match |
|------|--------------------|-----------|-------|
| `animChar` | `lavaDarkGolem` | `lavaDarkGolem` (NOT blackOrc) | ✓ |
| `team` | `#scarlet` | `#scarlet` | ✓ |
| `ranged` | true | true | ✓ |
| `runReload` | false | false | ✓ |
| `ghost` | false | false | ✓ |
| `reachRanged` | 150 | 150 | ✓ |
| `splashBullet` | present (flamingRock `#explode`) | present | ✓ |
| `bulletAttack` | null (splash path) | null | ✓ |
| `bulletChar` | `flamingRock` | `flamingRock` | ✓ |
| `bulletReincarnate` | `["fire"]` | `["fire"]` | ✓ |
| `attack.name` | `#throwBoulder` | `#throwBoulder` | ✓ |
| `attack.animType` | `#naturalRanged` | `#naturalRanged` | ✓ |
| `attack.type` | ranged | ranged | ✓ |
| `attack.animFrame` | `[7, 14]` | `[7, 14]` | ✓ |
| `attack.firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| `attack.bullet` | `#flamingRock` | `#flamingRock` | ✓ |
| `attack.reach` | 150 | 150 | ✓ |
| `attack.cooldown` (effective) | 181 | 181 | ✓ |
| `attack.collisionLoc` | `{x:0,y:0}` | `{x:0,y:0}` | ✓ |
| `attack.sound` | `"darkGolem_fire"` | `"darkGolem_fire"` | ✓ |
| `energy` / `max` | 750 / 750 | 750 / 750 | ✓ |
| `strength` | 20 | 20 | ✓ |
| `eyestrain` | 25 | 25 | ✓ |
| `walkSpeed`→`maxSpeed` | 0.6 | 0.6 | ✓ |

### Animation strips (assets.json — real bundled `lavaDarkGolem`, NOT a fallback)

| Strip | Exists | Frames | Loop |
|-------|--------|--------|------|
| `lavaDarkGolem_stand` | yes | 1 | true |
| `lavaDarkGolem_walk` | yes | 8 | true |
| `lavaDarkGolem_naturalRanged` | yes | 26 | false (one-shot) |
| `lavaDarkGolem_grave` | yes | 2 | false |

Hit frames 7 and 14 both fall within the 26-frame `naturalRanged` strip — `animframe [7,14]` is valid.
The bullet strip `flamingRock_fly` and the fire-mine strip `fire_stand` are also bundled.

### Live behavior (200 frames)

- **Shots fired: 4** = exactly **2 per attack cycle × 2 cycles**. Shot ticks `[13, 27, 64, 78]` — within a
  cycle the two shots are ~14 ticks apart (frame 7 ≈ t13, frame 14 ≈ t27 at strip delay 2), and the next
  cycle starts ~51 ticks later (the 26-frame strip's play length). The 2-shots-per-cycle count is correct,
  NOT 1.
- **Bullet speed: 20.00 px/tick** on every shot — matches `#fullstrength` with strength 20.
- **Muzzle: (520, 200)** = the golem's loc with no offset (collisionLoc (0,0)).
- **bulletChar `flamingRock`**, each bullet carries **`reincarnateAs ["fire"]`** → leaves a fire mine.
- **AI modes seen:** `moveToAttack`, `findTarget` (target in reach from spawn; no walking needed).
- **Death:** killed via lethal `loseEnergy` (sets `killedInAction`) → `isDead=true`, `graveOn=true`,
  and **0 new enemy entities spawned** → confirms lavaGolem does NOT split/reincarnate.

---

## 3. Divergence Table

| # | Property | Original | Port | Status |
|---|----------|----------|------|--------|
| — | sprite (`#name`) → animChar | `lavaDarkGolem` | `lavaDarkGolem` (not blackOrc) | CORRECT |
| — | `team` | `#scarlet` | `#scarlet` | CORRECT |
| — | `animType` → ranged | `#naturalRanged` | ranged=true | CORRECT |
| — | `bullet` → splash path | `#flamingRock` (#explode) | splashBullet present | CORRECT |
| — | `reach` → reachRanged | 150 | 150 | CORRECT |
| — | `animframe [7,14]` → 2 shots/cycle | 2 | 2 (live: 4 over 2 cycles) | CORRECT |
| — | `firingType #fullstrength` → speed 20 | 20 px/tick | 20.00 px/tick | CORRECT |
| — | `collisionLoc (0,0)` → muzzle=loc | no offset | (520,200) | CORRECT |
| — | flamingRock `reincarnateAs [#fire]` | fire mine leave-behind | `["fire"]` on each bullet | CORRECT |
| — | `runReload` | false | false | CORRECT |
| — | `walkSpeed` → 0.6 | 0.6 | 0.6 | CORRECT |
| — | `energy/max` | 750/750 | 750/750 | CORRECT |
| — | `strength` / `eyestrain` | 20 / 25 | 20 / 25 | CORRECT |
| — | effective cooldown | 181 | 181 | CORRECT |
| — | animations (stand/walk/naturalRanged/grave) | all present | all bundled (26-frame strip) | CORRECT |
| — | `dieSound` | `"boulder_die"` | `"boulder_die"` | CORRECT |
| — | NO actor reincarnation/split | absent | 0 children on death | CORRECT |

**DIVERGENCES: 0**

Probe FAILs encountered were wrong-probe-API only (player needs the input chain to `update`; bullet
entities have no `Anim` component — read `Projectile.char` instead) — NOT port divergences. Both fixed
in-probe and re-run clean.

---

## Conclusion

lavaGolem is fully faithful in the port. The live 200-frame run confirms it renders off its real bundled
`lavaDarkGolem` sprite (not the blackOrc fallback), fires **2 flamingRock splash bullets per attack cycle**
(strip frames 7 and 14 of the 26-frame `naturalRanged` strip), each travelling at 20 px/tick
(`#fullstrength`), each carrying `reincarnateAs ["fire"]` so it leaves a fire mine on detonation. Team
`#scarlet`, reach 150, energy 750, eyestrain 25, walkSpeed 0.6 all match. It does NOT split/reincarnate on
death (unlike doubleDarkGolem). Mechanically identical to `darkGolem` apart from the `#scarlet` team and the
`#flamingRock` (fire-leaving) bullet, both correctly wired.

`lavaGolem | DIVERGENCES=0`
