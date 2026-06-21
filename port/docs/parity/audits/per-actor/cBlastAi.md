# Behavioral Audit: act_cBlastAi (+ the CPU damage-caster damage model)

**Spell:** cBlastAi | #magic damage blast (CPU variant of cBlast) | chargeMaxBasic 18, chargeMaxModifier 3

## Gap found + FIXED (user-approved: "fully faithful")
The original objAiCPUSpellCaster releases the SAME objSpell the player does: it charges to its chargeMax
(= mana_capacity·chargeMaxModifier + chargeMaxBasic) and explodes with radial damage scaled by that charge —
so a high-mana / leveled caster hits harder. The port previously fired a FIXED per-actor bolt (this.power),
decoupling damage from charge/mana.

**FIX:** CPU `#release` magic damage/status casters now release a real spell actor (grow-fly-explode) toward
the target via `spawnSpell`+`SpellActor.release`, exactly like the player's castMagic — charge =
chargeMaxOf(attack, mana) (full charge). The explosion's radial damage (and any takeFreeze) scales with the
caster's charge ceiling. Affects the #release damage/status casters: energyBlast (berlin/goblinMage/
friendlyGoblinMage), darkBlast (darkMage/garonlin), cBlastAi (flaetorlin), arcticBlast (amotonlin).
(Streaming casters — energyPulseSpell/energyBeamSpell — and summon/heal/depositMines casters keep their
existing dedicated paths.) casts/script_objects/objAiCPUSpellCaster + modAttack calcCollisionVectSpell |
port/src/components/control.ts (attack: magic-#release spell-release branch).

Verified: spawn→cast releases an objSpell (test/attack.test.ts), 362 tests green, room-1 gate green.

**Status: FIXED (CPU caster damage now charge-scaled via the player's spell-actor path).**
