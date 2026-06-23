# Behavioral Parity Audit: monkGhost

**Actor:** `monkGhost` | `#objCPUCharacter` | AiType `#objAiCPUGhost` (modGhost) | Team `#ghosts` | teamWhenAlive `#aldevar`
**Method:** REPRODUCED in the port — loaded the real `@/generated/assets.json`, spawned a `monkGhost`
(via `spawnUnit`) plus a `monk` target on `#aldevar`, ticked 600 frames, observed strips/drift/possession.
Harness: `port/tools/_audit_monkGhost.ts` (deleted after the run).

## What monkGhost SHOULD do (derived from the original cast)

`act_monkGhost.txt` is the REINCARNATED form of `monk` (`act_monk.txt #reincarnateAs:[#monkGhost]`). It is a
GHOST: a drifting spirit that hunts a live `monk` on its alive-team (`#aldevar`) and POSSESSES it by merging
its experience into it, then vanishes. It is intentionally minimal — NO `#attack`, NO `#weapon`, NO `#walkSpeed`.

Derived contract:

| Property | Original (file:line) | Derived behavior |
|---|---|---|
| AiType | `act_monkGhost.txt:4` `#objAiCPUGhost` | drift → findTarget → goToLoc → attemptPossess |
| `#ghost` | `act_monkGhost.txt:13` `true` | `modGhost.init`→`initGhost`→`collisionDetectionOff` (`modGhost.txt:31-33`) |
| collisionDetection | (off, via `#ghost`) | drifts THROUGH terrain; `objGameObject.checkCollisions:247-248` only runs if `pCollisionDetection` |
| autoConstrainToPlayArea | `objGameObject.txt:164-172` | collisionDetection off ⇒ `pConstrainToPlayArea=true` (clamped to room) |
| team / teamWhenAlive | `act_monkGhost.txt:18-19` `#ghosts` / `#aldevar` | hunts a `#monk` on `#aldevar` (`objAiCPUGhost.updateFindTarget:113-115` via `getTeamWhenAlive`) |
| targetType | `objAiCPUGhost.txt:15` default `#monk` | `findUnitOfType(#monk, #aldevar)` — FIRST match, no distance sort |
| attack/weapon | NONE | `objAiCPUGhost.getAttack:67-69` returns `#none` — never attacks |
| possess | `objAiCPUGhost.attemptPossess:33-51` | within `pPossessDistance=10` ⇒ `mergeExperience(target)` + `goMode(#finish)` |
| mergeExperience | `modExperience.txt:240-244` | grants `pExperienceImWorth + pExperienceGained` (=3+0) and `glowPink`; then ghost finishes (dies) |
| grave | `modGrave` (ghost) | `pGraveOn=false` — leaves NO grave, simply vanishes |
| takeHit | `objCPUCharacter.takeHit:198-201` | `amGhost ⇒ return` — cannot be hurt |
| energy | `act_monkGhost.txt:10` `100` | (cosmetic; never takes damage) |
| walkSpeed | inherited `#CPUCharacter walkSpeed 3` | free-direction drift (`#walkType:#anyDirSpeed`) |
| sprite strips | `monkGhost_walk`, `monkGhost_stand` ONLY | the only two strips the original ships — no grave/reel/die/charge (it never needs them) |

## Observed in the port (reproduced)

```
== monkGhost bundled strips ==  walk: PRESENT  stand: PRESENT  grave/reel/die/release/charge: — (none)
== spawn ==  team=#ghosts actorType=monkGhost energy=100 passThrough=true graveOn=false  (monk: team=#aldevar)
  ghost.ai: ghost=true teamWhenAlive=#aldevar   findUnitOfType(#monk,#aldevar) -> FOUND   char=monkGhost
== 600 ticks ==
  actions touched: stand, walk    strips resolved to REAL bundles: monkGhost_stand, monkGhost_walk
  FALLBACKS: (none)
  drift path: (200,200) -> straight diagonal toward the monk at (600,600) -> arrives ~ (618,596)
  monk xp after run: 3 (= ghost imWorth)    possession happened: TRUE    ghost died at frame 310
  ghost.isDead=true  graveOn=false (vanished, no grave)    attack/charge/reel actions: NONE
```

## Derived-correct vs Observed

| Aspect | Derived-correct | Observed in port | Status |
|---|---|---|---|
| Strip resolution | walk + stand only, both real | every action (`stand`,`walk`) → real bundle, ZERO fallbacks | ✓ |
| collisionDetection off / drift | passes through terrain | `passThrough=true`, drifts diagonally through grid | ✓ |
| constrain to room | clamped on-map | `constrainToArea=true` (archetypes.ts:314) | ✓ |
| team / teamWhenAlive | `#ghosts` / `#aldevar` | `team=#ghosts`, AI `teamWhenAlive=#aldevar` | ✓ |
| find a monk to possess | `findUnitOfType(#monk,#aldevar)` first-match | FOUND the monk, committed as target | ✓ (teams.ts:248) |
| no attack | `getAttack` → `#none`, never swings | NONE — no charge/release/reel actions in 600 ticks | ✓ |
| possess in range | within 10px ⇒ mergeExperience + finish | at frame 310 (within 10px) monk +3 XP, ghost dies | ✓ (control.ts:984-999) |
| mergeExperience value | `imWorth+gained` = 3 | monk gained exactly 3 XP | ✓ |
| grave on death | none (ghost vanishes) | `graveOn=false`, no grave entity | ✓ (grave.ts:19) |
| cannot be hit | `amGhost ⇒ return` | ghost flag forwarded to Movement.takeHit gate | ✓ (archetypes.ts:315) |

## DIVERGENCES

**NONE (port behavior).** Every derived behavior reproduced faithfully: drift-through-terrain, monk hunt on
the alive-team, no-attack, in-range possession granting `imWorth+gained` experience, and grave-less vanish.
All sprite actions resolve to real bundled strips with zero fallbacks.

### Notes (not divergences)
- **STALE PRIOR AUDIT (corrected here, not a code bug):** the previous `monkGhost.md` claimed "possession is
  documented out-of-scope" / "drift approximation". That is no longer true — the port fully implements the
  possession cycle (`CpuAI.updateGhost`/`ghostFindTarget`/`ghostGoToLoc`/`ghostAttemptPossess`,
  `control.ts:943-1000`), reproduced above. The doc text was outdated.
- **Movement feel (port-wide, faithful in spirit):** the port drives the drift with its tuned global
  accel/friction (1.4 / 0.6) and `walkSpeed×0.6` rather than the raw `#friction point(1,1)` /
  `#walkAcceleration 0.3` (archetypes.ts:308-309, movement.ts:64). This is the SAME approximation applied to
  every CPU character, not a monkGhost-specific divergence; the qualitative drift (free-direction approach to
  the monk) is preserved.
- **Original-game design (not a bug):** monkGhost ships only `monkGhost_walk` + `monkGhost_stand`. It needs no
  grave/reel/die/attack strips because it never attacks, never takes damage (`amGhost⇒return`), and leaves no
  grave (vanishes on possession). The port's strip resolver would fall back to `_stand` if any other action
  were requested, but the ghost FSM never requests one — so no fallback ever fires.

---

## RE-VERIFY (2026-06-23) — fresh reproduction (`tools/_audit_monkghost.ts`)
monkGhost is `#AiType:#objAiCPUGhost`, team `#ghosts`, `#teamWhenAlive:#aldevar`, `#ghost:true` (`#graveOn` effectively off — leaves no grave).
- **Strips:** `stand`✓ `walk`✓ (animChar=monkGhost). No `grave` strip — correct (ghost vanishes, leaves no corpse).
- **Possession mechanic (objAiCPUGhost: findUnitOfType #monk on teamWhenAlive → goToLoc → attemptPossess):** with a `#monk` (#aldevar) placed 120px away, the ghost **drifted toward the monk (400→472px) and POSSESSED it at t=63** — ghost died (finalized), monk received the merged XP + glowPink (control.ts:1147). ✓
- **No-monk case:** vs a non-monk target it drifts to random map points forever (findUnitOfType→null) — faithful (`#objAiCPUGhost` drift-only where no monk is rostered). NOT a bug.
- **Verdict: CLEAN.**
