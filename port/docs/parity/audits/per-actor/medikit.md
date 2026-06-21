# Behavioral Audit: act_medikit (+ the +25 collect-bonus model)

**Pickup:** medikit | #objMedikit

## Gaps found + FIXED
objPlayerMerlinCharacter: collecting ANY medikit / scroll / sword / potion ends with
`increaseEnergy(pBonusEnergy=25)` — a flat +25 instant health (lines 156/166/200). The port granted NONE
of it. FIXED in pickup.ts: every collect EXCEPT maxikit & gmg now grants +25 (takeHeal 12.5,0 = +25, capped).
- **medikit**: BANKS a gradual kit AND grants the instant +25 (was bank only).

casts/script_objects/objPlayerMerlinCharacter.txt:152-160,200 | port/src/components/pickup.ts.
Verified: pickup.test.ts (energy 20→45 + banked kit); 364 tests + gate green.

**Status: FIXED (medikit now bank + instant +25).**
