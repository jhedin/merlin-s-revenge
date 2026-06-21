# Data-coverage audit — is every data property actually used?

A systematic check that the port consumes the actor data faithfully, per property. Two layers:

1. **Deterministic scanner** (`port/tools/data_coverage.ts`): enumerates every property key across the actor
   data (`generated/data.json`, top-level + `#attack.*`) and flags keys **never referenced** anywhere in
   the port source. Result: **171 distinct keys, 109 referenced, 62 not referenced.**
2. **Agent sweep**: 4 batched Haiku agents semantically classified the 62 unreferenced keys (real gap vs
   faithful-omission vs cosmetic vs data-typo), each cited against `casts/` + `port/src/`.

**Every agent finding was re-verified against source** — the Haiku severities were systematically inflated
(it flagged `maxEnergy`, `startOffset`, `collideWithTarget`, `walkSpeedIncLevel` as High/Med "real gaps"
that verification reduced to faithful/cosmetic). The reliable signal was the deterministic scanner + the
human verification; the LLM severity judgments were not trustworthy on their own.

## Real gaps found + FIXED (the high-value catch)
These were surfaced *during* the sweep (the first two were found by following a freeze-payload thread, not
by the scanner — they were *referenced-but-mishandled*, which the never-referenced scanner can't catch):

- **`#naturalRanged` throwers mis-classified as melee** (~30 actors: bat/golems/dwarfTower/iceRock/
  lizardSoldier/plant/…). An early slice mapped `#naturalRanged`→melee "out of scope"; those throwers
  meleed instead of throwing their `#bullet`. Now RANGED (`typeFromAnimType` + `spawnEnemy`). Verified
  in-browser: a bat moves to range and throws batBullets (fires at tick 1 in a fair 1v1).
- **Case-sensitive registry** — `iceRock`'s `#bullet:#iceboulder` didn't resolve to `act_iceBoulder`.
  Lingo symbols are case-insensitive; a lowercase fallback index fixes the whole class.
- **`#startingLevel`** (7 actors: goblinHero 20, the big golems + prestotolin 5, iceRock 3, powerOstrich 2)
  was ignored → those pre-levelled units spawned at level 0. Now applied at spawn (army re-field
  de-double-counts it).

## Verified NON-issues (Haiku over-flagged; confirmed faithful)
- **`damageSpeed`** (97 actors) — NOT combat armor: `takeHit`→`loseEnergy` directly; the `damageSpeed`-gated
  `takeDamage` is terrain/fall-damage only (`objCPUCharacter:111,124`), which doesn't exist in the port.
- **`maxEnergy`** (hydras) — hydras START at `#energy` (500/1000/1500), not `maxEnergy` (the original
  `modEnergy.init` does `pEnergy = params.energy` too); `maxEnergy` is only a heal cap and hydras don't heal.
- **`collideWithTarget`** (mines/auras/towerAxe) — the port's mine/splash path does area-only detonation,
  never single-target+splash, so the "don't collide with target" intent is inherently respected.
- **`weight`/gravity, `jumpPower`, `walkAcceleration`, `stretchDeath`, `frictionReel`, `stallSpeed`,
  `initLoc/initVect/masterPrg/createOnSolid/collisionRect`** — platforming/side-view/engine-internal
  properties with no top-down shipped effect.
- **Data typos the original ALSO ignores** (its reader uses the correct spelling): `strenghtIncLevel`
  (archer/scArcher), `attack.dammageMultiplier` (skeleton swords) — faithful to drop them.

## Minor / cosmetic / deferred tail (documented, not fixed)
- **Deferred (already in the K-backlog as cosmetic follow-ons):** `attack.animFrame` (attack-frame gating),
  `eyestrain` (caster aim jitter).
- **Cosmetic/visual:** `rotational` (spinning-bullet render), `splashGraveOn` (impact-grave sprites for
  cracks/towerAxe), `attack.collisionLoc` (per-weapon bullet spawn offset; port uses a fixed `y-6`),
  `attack.chargeVolumeMap`/`explodeVolume`/`takeHitSound`/etc. (audio-volume tuning), `minimapStatus`,
  `speechColor`, `counterColour`, `startOffset`, `layerZ`, `initFaceDir`.
- **Minor behavioral (low impact):** `walkSpeedIncLevel` (per-level walk growth — only stationary towers +
  one boss part carry it), `buildRateInc` (builder accel), `attack.idealAttackLoc` (melee micro-position),
  `attack.targetTileWhenNotBlank` (summon tile-centering), `chargeOffsetSide`/`chargeLoc` (caster spell
  charge offset — `SpellActor` supports `#top`/`#side` but only `#top` is wired), `overlapToLeaveRoom`,
  `enemyGoodShootingDistance`, `pathFindingTime` (the stall-time `5` IS implemented; the count-down isn't).

## Caveat / what this does NOT cover
The scanner finds *never-referenced* keys. The more dangerous class is **referenced-but-mishandled** (like
`#naturalRanged`, which the scanner could not flag because the string *was* referenced — just wired wrong).
That class was only found by chance. A fully thorough check would spawn each of the 263 actors and assert
its live behavior matches its data; the `#naturalRanged` catch suggests doing so could surface more
classification bugs. The current pass fixed the high-value gaps and verified the unreferenced tail.
