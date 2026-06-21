# Behavioral Audit: act_maxikit

**Pickup:** maxikit | #objMedikit

## Gap found + FIXED
objPlayerMerlinCharacter.medikitCollected(#maxikit): `increaseEnergy(getMaxEnergy()-getEnergy())` — an
INSTANT FULL heal, NOT a banked gradual kit, and NOT the +25 bonus. The port wrongly treated maxikit
identically to medikit (banked 1 kit). FIXED: maxikit now instant-fills to maxEnergy (takeHeal 1e9), no
bank. casts objPlayerMerlinCharacter.txt:157-158 | port/src/components/pickup.ts.
Verified: pickup.test.ts (energy 10→max, 0 banked); 364 tests + gate green.

**Status: FIXED (maxikit = instant full heal).**
