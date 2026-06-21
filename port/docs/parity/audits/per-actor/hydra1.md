# Behavioral Audit: act_hydra1

**Actor:** hydra1 | **Type:** #objCPUCharacter | **Team:** #swamp | **AiType:** #objAiCPU

Smallest hydra; ranged #acid thrower. CLEAN behaviorally (the agent over-flagged a dieSound #none audio call).

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType`/`bullet` | #naturalRanged / #acid | RANGED, acid bullet | ✓ |
| `energy` / `maxEnergy` | 500 / 1500 | starts at energy 500; maxEnergy is a heal-cap (catalogued) | ✓ |
| `team` | #swamp | enemy | ✓ |
| `dieSound` | #none | see note | ✓ |

## Note (engine bug surfaced, FIXED)
The hydra1 audit flagged `dieSound:#none` being passed to `audio.play("#none")`. The audible result is
nil (catalogued audio non-issue), BUT it exposed a real PORT engine bug: play() claimed a sound channel
(busy=true) without attaching onended, so a missing/#none buffer LEAKED the channel forever — after 8 such
calls every real SFX is dropped. FIXED in audio.ts: #none/empty is a no-op (no channel), and a genuine
missing-buffer miss frees the channel. casts (soundMaster filters #none) | port/src/systems/audio.ts.

**Status: CLEAN (behavior); audio channel-leak engine bug FIXED as a side-find.**
