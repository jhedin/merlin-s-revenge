# Behavioral Audit: act_loreStone
**Actor:** loreStone | #chatter | #character #loreStone | Team: #collectables
A LORE/TEXT stone: on touch it displays narrative text (objTransTextScroll / talking states).
## Agent flag — out-of-scope (documented)
The agent flagged the missing #talking→#finishedTalking second-touch reversal. This is the lore TEXT
display state machine — narrative/cutscene UI presentation, which the port does not render (lore-text UI is
out of scope). No GAMEPLAY effect (the stone grants no combat/stat change). A documented presentation
deviation, not a behavioral gap.
**Status: CLEAN (lore-text presentation is out-of-scope UI).**
