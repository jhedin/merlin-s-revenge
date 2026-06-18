// Archetype factories: compose components in chain order (control/AI -> movement -> anim ->
// energy -> team). These mirror objActorPlayer / objCPUCharacter module stacks at slice scope.

import { Archetype, type Entity, makeEntityId } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Anim } from "../components/anim";
import { Energy, Team } from "../components/combat";
import { PlayerControl, EnemyAI } from "../components/control";

const DEFAULTS = { isDead: false, getTeam: "", energyFrac: 1 };

export const PlayerArchetype = new Archetype("player", [PlayerControl, Movement, Anim, Energy, Team], { defaults: DEFAULTS });
export const EnemyArchetype = new Archetype("enemy", [EnemyAI, Movement, Anim, Energy, Team], { defaults: DEFAULTS });

export function spawnPlayer(x: number, y: number): Entity {
  const e = PlayerArchetype.create(makeEntityId());
  e.type = "player";
  return e.build({ x, y, walkSpeed: 4, energy: 100, team: "#aldevar", animChar: "mer", box: 12 });
}

export function spawnEnemy(x: number, y: number): Entity {
  const e = EnemyArchetype.create(makeEntityId());
  e.type = "enemy";
  return e.build({ x, y, walkSpeed: 2.4, energy: 40, team: "#monsters", animChar: "blackOrc", box: 14 });
}
