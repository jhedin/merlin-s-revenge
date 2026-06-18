// Archetype factories: compose components in chain order (control/AI -> movement -> anim ->
// energy -> team). These mirror objActorPlayer / objCPUCharacter module stacks at slice scope.

import { Archetype, type Entity, makeEntityId } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Anim } from "../components/anim";
import { Energy, Team } from "../components/combat";
import { PlayerControl, EnemyAI } from "../components/control";
import { registry } from "../game/data";

const DEFAULTS = { isDead: false, getTeam: "", energyFrac: 1 };

export const PlayerArchetype = new Archetype("player", [PlayerControl, Movement, Anim, Energy, Team], { defaults: DEFAULTS });
export const EnemyArchetype = new Archetype("enemy", [EnemyAI, Movement, Anim, Energy, Team], { defaults: DEFAULTS });

export function spawnPlayer(x: number, y: number): Entity {
  const e = PlayerArchetype.create(makeEntityId());
  e.type = "player";
  return e.build({ x, y, walkSpeed: 4, energy: 100, team: "#aldevar", animChar: "mer", box: 12 });
}

/** Spawn an enemy from real act_*.txt data (resolved #inherit/#attack), e.g. "blackOrc". */
export function spawnEnemy(actorName: string, x: number, y: number, opts: { animChar?: string; ranged?: boolean } = {}): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const num = (k: string, dflt: number) => (typeof d[k] === "number" ? (d[k] as number) : dflt);
  const str = (k: string, dflt: string) => (typeof d[k] === "string" ? (d[k] as string) : dflt);
  const e = EnemyArchetype.create(makeEntityId());
  e.type = "enemy";
  return e.build({
    x, y,
    walkSpeed: num("walkSpeed", 3) * 0.6, // engine walk units -> px/tick (tuned to the slice)
    energy: num("energy", 40),
    strength: num("strength", 5),
    team: str("team", "#monsters"),
    animChar: opts.animChar ?? actorName, box: 14,
    ranged: opts.ranged === true,
  });
}
