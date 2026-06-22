# Per-actor data audit progress

Queue: 263 actors (combat first). Status derives from which <actor>.md files exist.
Waves of ~5; failures retried (max 3). Gaps consolidated + fixed after the sweep.

## Charter (expanded per owner)
Each per-actor agent checks BOTH:
1. Property coverage — every data property faithfully consumed (ignored OR mishandled).
2. BEHAVIORAL correctness — does the actor behave as the original would? Wrong AI mode/decisions,
   wrong attack resolution (melee vs ranged vs magic, bullet/splash), wrong targeting/allegiance,
   wrong movement/speed, wrong death/grave/reincarnation, wrong special mechanics (wizard/ghost/
   multiAttack/builder/reincarnate/reelProof). INCORRECT BEHAVIOUR is a gap even if no single property
   is "unused" — e.g. #naturalRanged was read but wired to melee. Flag any divergence with dual-tree
   evidence; ALL gaps get fixed (no severity filter), but each must be a REAL divergence, not a guess.

## Charter v2 (corrected — the v1 sweep read code and missed real bugs: a dropped sprite strip / a
## wrong shot-count looks fine on paper)
1. REPRODUCE, don't just read. Each agent writes a throwaway `tools/_audit_<actor>.ts`, loads the REAL
   `@/generated/assets.json` bundle (so missing art surfaces), spawns the actor with a target via the
   test harness (spawnEnemy + wire game.spawnUnit/spawnAlly; rebuildCombatSubstrate each tick), ticks
   ~200f, and OBSERVES: does every action (stand/walk/attack/grave) resolve to a real bundled strip
   (not a `_stand`/blackOrc fallback)? does it attack — shot/hit COUNT per #animframe, bullet/melee/
   summon, cadence? move/target/face/die as derived? Code-reading only EXPLAINS a divergence the run found.
2. NO SYMPTOMS in the prompt. Derive "correct" purely from the cast/data; never name a known bug — a
   symptom hint makes the agent hunt only that and go blind to the bugs nobody has pointed out yet.

