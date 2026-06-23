# Per-Actor Parity Audit: greyGhost

Method: behavior DERIVED from the original cast/data, then REPRODUCED in the port by spawning
`greyGhost` from the real `@/generated/assets.json` bundle + `data.json` registry and ticking ~300
frames against a live `#aldevar` target. Probe: `tools/_audit_greyGhost.ts` (deleted after the run).

## SECTION 1 — Derived-correct behavior (from the ORIGINAL)

Source: `casts/data/act_greyGhost.txt`, `casts/data/act_undeadSummon.txt`,
`casts/script_objects/objAiCPUSpellCaster.txt`, `objAiAttack.txt`, `modSpellMultistage.txt`,
`modStretchDeath.txt`.

| Property | Derived value (original) | Source |
|----------|--------------------------|--------|
| objType / AiType | `#objCPUCharacter` / `#objAiCPUSpellCaster` | act_greyGhost.txt:3-4 |
| team / allegiance | `#undead` (an enemy; #undead hates the player side) | act_greyGhost.txt:25 |
| energy | 100 | act_greyGhost.txt:14 |
| strength / dexterity | 1 / 1 | act_greyGhost.txt:11,23 |
| mana capacity/flow/regen | 20 / 3 / 0.5 | act_greyGhost.txt:17,18,20 |
| collisionDetection | **false → DRIFTS through terrain** | act_greyGhost.txt:9 |
| walkSpeed / inertia | 1 / 70 | act_greyGhost.txt:27,16 |
| stretchDeath | **true** (modStretchDeath: stretch+fade the last sprite, then `#stretchDeathFin`) | act_greyGhost.txt:24 |
| dieSound | `greyGhost_die` | act_greyGhost.txt:12 |
| weapon | `#undeadSummon` (a #magic summon spell, reach 9999) | act_greyGhost.txt:28 |
| data #name (sprite char) | **`greyGhost`** → renders the `greyGhost_*` strips | act_greyGhost.txt:26 |
| attack animType / explodeFunction | `#magic` / `#summonUnit` | act_undeadSummon.txt:9,21 |
| chargeMax (attack) / randomSummon | 36 / true | act_undeadSummon.txt:16,25 |
| charge ceiling | min(36, capacity·1 + 0) = **20** (struct default chargeMaxModifier 1, chargeMaxBasic 0) | act_undeadSummon.txt:16 + structAttack |
| summon tiers castable (≤20) | skeletonWarrior(15), skeletonArcher(17), skeletonThrower(20) — NOT greyGhost(25)+ | act_undeadSummon.txt:27-36 |
| summoned unit team | residentTeamCategory `#enemies`; each skeleton's own `#team` = `#undead` | act_undeadSummon.txt:43 |
| cast anim | `ensureMode(#charge)` during wind-up, then `ensureMode(#release)`+`goMode(#release)` at fire | objAiAttack.txt:126-127, 337-348 |
| AI mode | `#moveToOptimumPosition` (kite / bullet-dodge) | objAiCPUSpellCaster.txt:34 |

## SECTION 2 — Observed in the PORT (reproduced)

Probe output (seed `Rng(12345)`, 300 ticks, target = inert `#aldevar` dummy):

```
type: enemy   team: #undead
anim char: greyGhost   (blackOrc fallback? false)     <- real strip, NOT blackOrc
energy: 100
passThrough(drift): true   constrainToArea: true       <- drifts through terrain, stays on-map
stretchDeath: true
current attack: name #undeadSummon, type magic, animType #magic, reach 9999,
                explodeFunction #summonUnit, randomSummon true,
                chargeMax 36, chargeMaxModifier 1, chargeMaxBasic 0,
                multistage = [warrior15, archer17, thrower20, greyGhost25, dragon29, necro33, darkMage35, lord38]
computed chargeCeil (no wobble): 20
greyGhost_stand: true  greyGhost_charge: true  greyGhost_release: true  greyGhost_magic: false

ever played charge strip: true   ever release: false   <- see DIVERGENCE 1
summoned units: skeletonThrower x4, skeletonArcher x2  (all enemy / #undead, allegiance #enemy)
entity breakdown: ally 1, enemy 7 (gg + 6 summons), spell 7 (orbs in flight), bullet 23 (summons firing)
death probe: isDead true, stretchDeathDone true        <- stretch death resolves
```

## SECTION 3 — Comparison

### FAITHFUL (no divergence)
- **Sprite char resolves to `greyGhost`** (its own bundled strips), not the `blackOrc` stand-in. ✓
- **Charges then summons.** Releases a flying `#undeadSummon` spell; on landing `summonUnit` fields a
  unit of the highest tier ≤ charge. Over 300 ticks it summoned only tiers ≤20 (skeletonThrower 20,
  skeletonArcher 17) — exactly the derived castable set. ✓ (charge.ts:36-44 randomSummon wobble lands
  some casts on the lower tier — faithful to `calcAttackChargeMax`.)
- **Summoned units on `#undead` / `enemy` with `#enemy` allegiance** (hunt the player side). ✓
- **Drift:** `collisionDetection:false → passThrough=true`, `constrainToArea=true` (stays on-map). ✓
  (archetypes.ts:340-341)
- **stretchDeath:** flagged true, `stretchDeathDone()` resolves on death. ✓ (anim.ts:84-87, 120)
- **Targets / faces / dies** as derived; `#objAiCPUSpellCaster` → `dodgesBullets`+`runReload` kite. ✓
  (archetypes.ts:264-267)

### DIVERGENCE 1 — release strip never shown (PORT bug, cosmetic only)
- **Original:** the cast cycle is `ensureMode(#charge)` (wind-up) → at fire `ensureMode(#release)` +
  `goMode(#release)`, so the brief `greyGhost_release` strip plays on the firing frame.
  - `casts/script_objects/objAiAttack.txt:126-127` (chargeMagic → #charge)
  - `casts/script_objects/objAiAttack.txt:343-345` (releaseMagic → #release + goMode #release)
- **Port:** `CpuAI.attackAction()` **always prefers the `charge` strip when it exists** and only falls
  back to `release` when no charge strip is bundled. greyGhost ships BOTH, so `release` is never shown.
  Probe confirms `ever played charge: true, ever release: false`.
  - `port/src/components/control.ts:557-563`
- **Severity:** cosmetic. The summon mechanics, charge ceiling, tier selection, team, and damage are all
  correct — only the momentary release-frame flash is dropped. The port comment frames it as a deliberate
  "prefer the visible charge bulk" choice; documenting it as a faithful-divergence the team may want to
  honor (play `release` for the brief fire frame the way the original `goMode(#release)` does).

### CANDIDATE ORIGINAL-GAME QUIRK (do NOT fix)
- **randomSummon wobble can drop below the first tier.** `calcAttackChargeMax` (modAttack 106-112,
  ported in charge.ts:36-44) lets a cast's effective ceiling fall under skeletonWarrior(15), in which
  case `selectTier` returns null and the cast fizzles to its bolt only. This is faithful to the original
  random-summon design (you can't reliably top-tier every cast); not a port bug.

## Verdict
greyGhost is **behaviorally faithful** in all load-bearing respects (char, drift, charge→summon, tiers,
team, stretchDeath). One **cosmetic PORT divergence**: the `#release` firing-frame strip is never
rendered because the port hard-prefers the `charge` strip.

Probe: `tools/_audit_greyGhost.ts` (deleted).

---

## RE-VERIFY (2026-06-23) — fresh reproduction (`tools/_audit_combat.ts greyGhost --dist=250`)
- **Strips:** `stand`✓ `walk`✓ `grave`✓ `charge`✓ `release`✓ `reel`✓ (animChar=greyGhost, team #undead). Both charge AND release strips present and BOTH used (charge 42 ticks / release 21 ticks over 300).
- **Summoner (#weapon #undeadSummon, #magic, #explodeFunction:#summonUnit, #randomSummon):** released flying summon spells; summoned **6 undead minions (skeletonThrower / skeletonArcher) over 300 ticks at a steady ~45-tick cadence**; minions then damaged the pinned target (26 damage events). ✓
- **Verdict: CLEAN.**
