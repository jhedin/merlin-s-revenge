# Behavioral Audit: act_energyMine (+ the objMine dieOnExplode default)

**Mine:** energyMine | #objMine | Team: #aldevar | deposited by the player's energyMines spell / verdanlin

## Gap found + FIXED
objMine default `i[#dieOnExplode] = true` — a mine is SINGLE-SHOT (consumed after one blast) unless it
explicitly sets dieOnExplode:false. energyMine leaves it UNSET → should be single-shot. The port (spawnMine
+ Mine.init) used `=== true`, so an UNSET dieOnExplode became false → energyMine RE-ARMED FOREVER, detonating
repeatedly instead of being consumed (a much stronger, never-spent minefield). FIXED: default TRUE when unset
(`!== false`) in spawnMine (objTypes.ts:45) + Mine.init (mine.ts:42). The re-arming mines
(fire/pitMonster/iceAura/orcAura/snowAura/quadAura/undeadAura) all set dieOnExplode:false explicitly →
unaffected. casts/script_objects/objMine.txt:18 | port/src/entities/objTypes.ts + components/mine.ts.

Verified: deposit_mines.test.ts asserts energyMine dieOnExplode=true; 363 tests + room-1 gate green;
re-arming mines still re-arm (explicit false).

**Status: FIXED (energyMine single-shot; objMine dieOnExplode default corrected to true).**
