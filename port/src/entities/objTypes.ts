// objType spawners (plan §c): the placed-but-inert #objType actors mr4Demo puts down get real Entities
// here. spawnFromSymbol dispatches by registry.resolveActor(name)["objType"]:
//   #objMine        -> spawnMine        (Mine FSM: prime->check->detonate via resolveSplash)
//   #objMagicLimit  -> spawnRegionMarker(magicLimit)  (sets game.magicLimit on spawn, resets on leave)
//   #objMusic       -> spawnRegionMarker(music)       (plays the track once on spawn)
//   #objTeamOverride-> spawnRegionMarker(teamOverride)(sets game.teamMaster.teamOverride, resets on leave)
//   #objChatter     -> spawnChatter     (decorative stone NPC; cutscene scripts unbundled -> inert sprite)
// The region markers reset their effect when the entity leaves play (RegionMarker.onRemove), which the
// RoomManager fires on room-teardown — making the magicLimit/teamOverride effects room-scoped (§g.5).

import { Archetype, type Entity, makeEntityId } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Anim } from "../components/anim";
import { Energy, Team, Targeting } from "../components/combat";
import { Identity } from "../components/identity";
import { Mine } from "../components/mine";
import { RegionMarker, type RegionEffect } from "../components/regionMarker";
import { Chatter } from "../components/chatter";
import { resolveAttack } from "../components/weapon";
import { spriteCharOr } from "../components/anim";
import { registry } from "../game/data";

const num = (d: Record<string, any>, k: string, dflt: number) => (typeof d[k] === "number" ? (d[k] as number) : dflt);
const str = (d: Record<string, any>, k: string, dflt: string) => (typeof d[k] === "string" ? (d[k] as string) : dflt);

// Mine archetype: a static actor (no AI, no movement intent) with Team + Energy (targetable/killable)
// + Anim + the Mine FSM. type "mine" so it does NOT gate room-clear (a re-arming pitMonster never dies).
export const MineArchetype = new Archetype("mine",
  [Identity, Movement, Anim, Energy, Mine, Team, Targeting],
  { defaults: { isDead: false, getTeam: "", getTeamRole: "#teamMines", energyFrac: 1, getLevel: 1, getActorType: "" } });

export function spawnMine(actorName: string, x: number, y: number): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const attack = resolveAttack(d["attack"] as Record<string, any> | undefined, d);
  const e = MineArchetype.create(makeEntityId());
  e.type = "mine";
  return e.build({
    x, y, walkSpeed: 0, box: 12,
    energy: num(d, "energy", 50),
    team: str(d, "team", "#monsters"), teamRole: str(d, "teamRole", "#teamMines"),
    animChar: spriteCharOr(actorName, "blackOrc"),
    actorType: actorName,
    attack,
    triggerRadius: num(d, "triggerRadius", 20),
    dieOnExplode: d["dieOnExplode"] !== false, // objMine default true (single-shot, e.g. energyMine); only re-arming mines set false
    dieOnExplodeNumber: num(d, "dieOnExplodeNumber", 0),
    explodeSound: str(d, "explodeSound", "") === "#none" ? "" : str(d, "explodeSound", ""),
    timeToPrime: num(d, "timeToPrime", 30),
    timeToCheck: num(d, "timeToCheck", 3),
  });
}

// Region marker archetype: a zero-cost effect Entity (no team, no collision). It applies its effect on
// spawn and resets it when removed from play (room-leave). It carries Movement only for a position.
export const MarkerArchetype = new Archetype("marker",
  [Identity, Movement, RegionMarker],
  { defaults: { isDead: false, getTeam: "", getActorType: "", isFinished: false } });

export function spawnRegionMarker(effect: RegionEffect, value: number | string, x: number, y: number, actorName: string): Entity {
  const e = MarkerArchetype.create(makeEntityId());
  e.type = "marker";
  return e.build({ x, y, walkSpeed: 0, box: 4, effect, value, actorType: actorName });
}

// Chatter archetype: a stone cutscene-trigger NPC (static Anim + Team + the Chatter overlap FSM). The
// #stonesN cutscene scripts are bundled (K12), so on player overlap the stone plays its #scriptToPerform
// over the live game (playInGameCutScene) and latches. type "chatter" keeps it off room-clear.
export const ChatterArchetype = new Archetype("chatter",
  [Identity, Movement, Anim, Team, Chatter],
  { defaults: { isDead: false, getTeam: "", getTeamRole: "#teamMembers", energyFrac: 1, getActorType: "" } });

export function spawnChatter(actorName: string, x: number, y: number): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const e = ChatterArchetype.create(makeEntityId());
  e.type = "chatter";
  return e.build({
    x, y, walkSpeed: 0, box: 12,
    team: str(d, "team", "#chatters"), teamRole: "#teamMembers",
    animChar: spriteCharOr(actorName, "blackOrc"),
    actorType: actorName,
    scriptToPerform: str(d, "scriptToPerform", ""),
    collisionRect: d["collisionRect"], // per-actor trigger box (objChatter checkForCollisionWithPlayer)
  });
}
