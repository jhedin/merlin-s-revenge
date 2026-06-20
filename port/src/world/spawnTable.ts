// Shared spawn routing tables (factored out of RoomManager so first-spawn and save-restore share one
// source of truth — plan §C.1). PICKUPS maps a powerup tile symbol -> its collectible effect; SKIP_SPAWN
// is the set of item/spell symbols with no unit/dwelling behavior yet.

import type { PickupEffect } from "../components/pickup";

// Powerup tiles -> collectible pickup effect (the effect is a port abstraction; the rest of a
// spawn's behavior comes from its real actor data — dwellings/units are detected by #objType).
export const PICKUPS: Record<string, PickupEffect> = {
  "#medikit": "heal", "#maxikit": "maxikit",
  "#walkSpeed": "speed",
  // each mana powerup raises its own stat (objManaCapacity/Burst/Flow), not one generic boost
  "#manaCapacity": "manaCapacity", "#manaBurst": "manaBurst", "#manaFlow": "manaFlow",
  "#merlinSword": "sword", // melee weapon upgrade (act_merlinSword, damageMultiplier 16)
  "#energyPunch": "energyPunch", // melee weapon scroll (act_energyPunch, #magicMelee, damageMultiplier 1.75) (I4)
  "#energyBlast": "spell",  // scroll (room 6): grants Merlin's charged magic — he starts punch-only
  // C spell scrolls (reachable in other maps via F1): each grants a #magic weapon (addWeapon).
  "#cBlast": "cBlast", "#darkBlast": "darkBlast", "#arcticBlast": "arcticBlast", "#healBlast": "healBlast",
  "#armySummon": "armySummon", "#monsterSummon": "monsterSummon", "#energyMines": "energyMines",
  // I7/I8 (Pass B): the GMG is a #objScroll routed to a mode (not addWeapon); the beam scrolls grant a
  // #magic weapon with the modFireBullets streaming release.
  "#gmg": "gmg", "#energyBeamSpell": "energyBeam", "#energyPulseSpell": "energyPulse",
};

// Items / spells with no unit/dwelling behavior yet (scrolls, mines, music, towers). Characters
// (#objCPUCharacter) and dwellings (#objDwelling) are handled by data; this only skips the rest.
export const SKIP_SPAWN = new Set([
  "#none", "#player",
  // Phase I Pass A handled (objType dispatch / PICKUPS): #objMusic, #objMagicLimit, #objTeamOverride,
  // #objChatter, #objMine, #energyPunch. Pass B handled (PICKUPS): #gmg (GMG mode), #energyBeamSpell /
  // #energyPulseSpell (modFireBullets streaming / beam). #energyMine is the deposited mine actor
  // (other-map item). #armySummonStones is a separate army-summon monolith (other-map item, §f.8).
  "#energyMine", "#armySummonStones",
]);
