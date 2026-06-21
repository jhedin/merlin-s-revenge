# Behavioral Audit: act_manaCapacity
**Pickup:** manaCapacity | raises Merlin's mana capacity.
Capacity increase verified faithful. The agent-flagged "missing +25 bonus energy on collect" is FIXED
globally (see medikit.md): collecting any potion now grants +25 (potionCollected → increaseEnergy(25)).
**Status: CLEAN (benefits from the +25 collect-bonus fix).**
