# Behavioral Audit: act_fire
**Class:** #objMine (#dieOnExplode false → re-arming fire patch; dieOnExplodeNumber 10 → dies after 10 blasts).
The lingering fire mine LEFT BY flamingRock (lavaGolem/lavaDarkGolem) via the bullet #reincarnateAs fix.
Mine FSM (prime/check/detonate/re-arm), takeFreeze/damage payload, triggerRadius, and the dieOnExplode
re-arm (explicit false → unaffected by the energyMine single-shot default fix) all VERIFIED via the
bullet-reincarnation + mine/aura audits.
**Status: CLEAN (covered — bullet reincarnation hatches it; re-arming mine class verified).**
