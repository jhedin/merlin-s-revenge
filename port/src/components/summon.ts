// Summon (modSpellMultistage summon path, C3 + K9): a summon spell (#explodeFunction:#summonUnit) maps
// charge tiers -> unit types via #multistage. On release, selectTier(charge) picks the highest affordable
// tier and summonUnit fields ONE unit of that type at the cast loc — armyMaster.createUnitFromSummonSpell
// -> createUnit(team, typ, startLoc, spellName):
//   - #armySummon REQUIRES a reservation: it draws the best banked record from the army reserve (G2),
//     re-fields the unit AT its saved level, and consumes the record. No reserve (armyDetails=#none) ->
//     createUnit returns #none (the spell fizzles to its bolt only). [K9 — the reservation requirement]
//   - every OTHER summon (#monsterSummon / #undeadSummon / #goblinSummon / #skelitonSummon / #scSummon):
//     if a reserve record happens to exist for [team][typ] it is withdrawn+re-fielded+consumed too
//     (faithful to createUnit's unconditional lookupArmyDetails), otherwise a FRESH default-level unit is
//     spawned via actorMaster.newActor (armyDetails=#none, no consume) — these are normally never banked.
// The bolt still fires (the energyBlastBullet with #takeHit) so a summon cast also damages — faithful
// (selectPayload keeps the payload non-blank).
//
// OUT OF SCOPE (plan §g): permission/icon UI (obtainPermissionOrHalt/displayIcon/chargeReinIn — the charge
// is never headcount-gated here; the spell just no-ops if armySummon has no reserve) and the teleport-in
// animation (collapsed to an instant re-field — render only).

import type { Entity } from "../engine/dispatch";
import { game } from "../game/context";
import type { AttackData } from "./weapon";
import { spawnFromSymbol } from "../entities/actorSerial";
import { Anim } from "./anim";

// depositMines (modSpellMultistage.depositMines): an #explodeFunction:#depositMines spell (energyMines)
// drops numMines = charge/chargePerUnit #energyMine actors, each scattered VarRoughly(loc, charge/2) around
// the explode loc. The energyMine carries its own #team (#aldevar) so it triggers on the caster's enemies.
// Used by the player energyMines spell (spellActor.explode) AND CPU mine-casters (verdanlinInGame).
export function depositMines(attack: AttackData, charge: number, x: number, y: number): void {
  if (attack.explodeFunction !== "depositMines" && attack.explodeFunction !== "#depositMines") return;
  const perUnit = attack.chargePerUnit > 0 ? attack.chargePerUnit : 5;
  const numMines = Math.floor(charge / perUnit);
  const slack = Math.max(0, Math.floor(charge / 2));            // possibleDistance = charge/2
  const rough = (v: number): number => (slack > 0 ? v - slack + game.rng.int(2 * slack) : v); // VarRoughly
  for (let i = 0; i < numMines; i++) {
    const mine = spawnFromSymbol("energyMine", rough(x), rough(y));
    if (mine) game.entities.push(mine);
  }
}

// selectTier (modSpellMultistage.selectPayload): the highest tier whose chargeRequired <= charge; null
// below the first tier (cast fizzles into a plain bolt). Tiers are pre-sorted ascending by resolveAttack.
export function selectTier(charge: number, multistage: Array<{ type: string; chargeRequired: number }>): string | null {
  let picked: string | null = null;
  for (const tier of multistage) {
    if (tier.chargeRequired <= charge) picked = tier.type;
    else break;
  }
  return picked;
}

// summonUnit: spawn the selected unit on the spell's residentTeamCategory team. The unit carries its OWN
// #team in act data (warrior->#aldevar, summonArcher->#monsterSummon) which equals residentTeamCategory,
// so spawnUnit (routes render-type by isPlayerSide) puts the unit on the correct side — a monsterSummon
// monster joins #monsterSummon (a player-side team that hates the real monsters), faithful to tem_*.
export function summonUnit(attack: AttackData, charge: number, x: number, y: number, ownerId: number): Entity | null {
  if (attack.explodeFunction !== "summonUnit" && attack.explodeFunction !== "#summonUnit") return null;
  const type = selectTier(charge, attack.multistage);
  if (!type) return null;
  const owner = game.entities.find((u) => u.id === ownerId);
  // team = summonSpell.getTeam() — the caster's allegiance (the reserve is keyed [team][typ]); the spell's
  // residentTeamCategory equals it for armySummon (#aldevar) and is the fresh-spawn side otherwise.
  const team = (owner?.send("getTeam") as string) || attack.residentTeamCategory || "#aldevar";
  const isArmySummon = attack.name === "#armySummon" || attack.name === "armySummon";

  // reservationsMaster.getPermissionToRelease: a summon can't push the team past its concurrent cap
  // (gMaxFriends=12 player-side / gMaxEnemies=16). At capacity the spell fizzles (no fresh spawn, no
  // reserve withdrawal) — faithful to createUnit returning #none when there's no free slot.
  if (game.teamMaster.atCapacity(team)) return null;

  // armyMaster.createUnit's lookupArmyDetails branch: a banked record (highest level) is withdrawn,
  // re-fielded at its saved level, and consumed. #armySummon REQUIRES one (else #none); other summons fall
  // through to a fresh spawn when the reserve is empty.
  if (game.armyMaster && game.armyMaster.hasReserve(team, type)) {
    const fielded = game.armyMaster.createUnit(team, type, x, y);
    if (fielded) { owner?.send("gainXp", 0.5); return fielded; }
  }
  if (isArmySummon) return null; // createUnit returns #none for armySummon w/ armyDetails=#none

  if (!game.spawnUnit) return null;
  const e = game.spawnUnit(type, x, y, {});
  e.tryGet(Anim)?.startTeleportIn();  // armyTeleportIn (#teleportInStretch): beam the summoned unit in
  game.entities.push(e);
  // owner gains +0.5 experience (pExperienceGain) — same gainXp chain a kill uses.
  owner?.send("gainXp", 0.5);
  return e;
}
