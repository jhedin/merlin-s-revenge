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
