// Archetype factories: compose components in chain order (control/AI -> movement -> anim ->
// energy -> team). These mirror objActorPlayer / objCPUCharacter module stacks at slice scope.

import { Archetype, type Entity, makeEntityId } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Anim } from "../components/anim";
import { Energy, Team } from "../components/combat";
import { Experience } from "../components/experience";
import { Freeze } from "../components/freeze";
import { PlayerControl, EnemyAI } from "../components/control";
import { Dwelling } from "../components/dwelling";
import { registry } from "../game/data";

const DEFAULTS = { isDead: false, getTeam: "", energyFrac: 1, getLevel: 1, isFrozen: false };

// Experience is ordered BEFORE Energy so it records the attacker before energy applies death.
export const PlayerArchetype = new Archetype("player", [PlayerControl, Freeze, Movement, Anim, Experience, Energy, Team], { defaults: DEFAULTS });
export const EnemyArchetype = new Archetype("enemy", [EnemyAI, Freeze, Movement, Anim, Experience, Energy, Team], { defaults: DEFAULTS });
// Dwellings are static (no AI) but reuse Movement for position + Energy/Team so they're targetable.
export const DwellingArchetype = new Archetype("dwelling", [Dwelling, Movement, Anim, Energy, Team], { defaults: DEFAULTS });

export function spawnDwelling(actorName: string, x: number, y: number, produces: string, producesRanged: boolean, animChar = actorName): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const energy = typeof d["energy"] === "number" ? (d["energy"] as number) : 400;
  const team = typeof d["team"] === "string" ? (d["team"] as string) : "#monsters";
  const e = DwellingArchetype.create(makeEntityId());
  e.type = "enemy"; // targetable/destroyable like an enemy
  return e.build({ x, y, walkSpeed: 0, energy, team, animChar, box: 24, produces, producesRanged });
}

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
