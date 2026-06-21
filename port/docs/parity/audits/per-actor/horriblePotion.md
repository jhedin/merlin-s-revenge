# Behavioral Audit: act_horriblePotion
**Actor:** horriblePotion | #character #prop | #inherit #actorPlayer | Team: #collectables
An inert DECORATIVE PROP (identical structure to blackPotion: no #objType potion, no #attack, no effect).
## Agent flag — VERIFIED NON-ISSUE
The agent flagged "original spawns as pickup, port spawns as unit." But horriblePotion (and blackPotion) are
referenced ONLY in assets.json (graphics) + data.json (own data) — NOT placed in ANY shipped room/scene/map.
So they are never spawned during gameplay; the theoretical spawn-categorization difference is moot (dead /
cutscene-only prop data). blackPotion (identical) was correctly ruled CLEAN.
**Status: CLEAN (unused decorative prop; never placed in a shipped room).**
