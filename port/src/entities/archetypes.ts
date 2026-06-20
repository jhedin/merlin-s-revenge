// Archetype factories: compose components in chain order (control/AI -> movement -> anim ->
// energy -> team). These mirror objActorPlayer / objCPUCharacter module stacks at slice scope.

import { Archetype, type Entity, makeEntityId } from "../engine/dispatch";
import { Movement } from "../components/movement";
import { Anim } from "../components/anim";
import { Energy, Team, Targeting } from "../components/combat";
import { Experience } from "../components/experience";
import { Freeze } from "../components/freeze";
import { PlayerControl, EnemyAI } from "../components/control";
import { Mana } from "../components/mana";
import { Hurt } from "../components/hurt";
import { Dwelling } from "../components/dwelling";
import { Pickup, type PickupEffect } from "../components/pickup";
import { registry } from "../game/data";
import { game } from "../game/context";

const DEFAULTS = { isDead: false, getTeam: "", getTeamRole: "#teamMembers", energyFrac: 1, getLevel: 1, isFrozen: false, isInvince: false, isHurt: false };

// Experience is ordered BEFORE Energy (records attacker before death); Hurt is AFTER Energy
// (feedback + i-frames arm once the hit has landed). Targeting (the #attack.target* config) sits with
// Team so teamMaster.findTarget / impactMeleeAttack can read it generically.
export const PlayerArchetype = new Archetype("player", [PlayerControl, Freeze, Mana, Movement, Anim, Experience, Energy, Hurt, Team, Targeting], { defaults: DEFAULTS });
export const EnemyArchetype = new Archetype("enemy", [EnemyAI, Freeze, Movement, Anim, Experience, Energy, Hurt, Team, Targeting], { defaults: DEFAULTS });
// Dwellings are static (no AI) but reuse Movement for position + Energy/Team so they're targetable.
export const DwellingArchetype = new Archetype("dwelling", [Dwelling, Movement, Anim, Energy, Hurt, Team, Targeting], { defaults: DEFAULTS });

/** Summon a friendly unit on Merlin's team that hunts enemies, using the actor's real stats. */
export function spawnAlly(actorName: string, x: number, y: number, animChar = actorName): Entity {
  const e = spawnEnemy(actorName, x, y, { animChar }); // real energy/strength/walkSpeed/attack from data
  e.type = "ally";
  e.get(Team).team = "#aldevar"; // summoned onto the player's side; #enemy allegiance => hunts #aldevar.hates
  return e;
}

/**
 * Spawn a unit from the objects layer, routing its render/room-clear TYPE by its real team: same-side
 * actors (the #aldevar army) become allies, hostile actors become enemies. Targeting is fully
 * data-driven (an ally is just a unit on #aldevar with #enemy allegiance, hunting #aldevar.hates).
 */
export function spawnUnit(actorName: string, x: number, y: number, opts: { animChar?: string; ranged?: boolean } = {}): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const team = typeof d["team"] === "string" ? (d["team"] as string) : "#monsters";
  const e = spawnEnemy(actorName, x, y, opts);
  if (game.teamMaster.isPlayerSide(team)) e.type = "ally";
  return e;
}

export const PickupArchetype = new Archetype("pickup", [Pickup, Movement], { defaults: { isDead: false, isFinished: false, getTeam: "" } });

export function spawnPickup(effect: PickupEffect, x: number, y: number): Entity {
  const e = PickupArchetype.create(makeEntityId());
  e.type = "pickup";
  return e.build({ x, y, walkSpeed: 0, effect, box: 8 });
}

export function spawnDwelling(actorName: string, x: number, y: number, animChar = actorName): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const energy = typeof d["energy"] === "number" ? (d["energy"] as number) : 400;
  const team = typeof d["team"] === "string" ? (d["team"] as string) : "#monsters";
  // residents come from the building's own #residentGroups (typ + timing), not a hardcoded table.
  // Keep only types we have data for; #fangBunnyBaby / #SpeedyGuy etc. have no act_ record.
  const pair = (v: any, dflt: [number, number]): [number, number] =>
    Array.isArray(v) && v.length >= 2 ? [Number(v[0]), Number(v[1])] : dflt;
  const groups = (Array.isArray(d["residentGroups"]) ? (d["residentGroups"] as Record<string, any>[]) : [])
    .map((g) => ({
      typ: typeof g["typ"] === "string" ? g["typ"].replace(/^#/, "") : "",
      buildTime: pair(g["buildTime"], [40, 50]),
      groupSize: pair(g["groupSize"], [1, 2]),
      releaseInterval: pair(g["releaseInterval"], [25, 45]),
    }))
    .filter((g) => g.typ && registry.resolveActor(g.typ));
  // lifetime budget from real #totalResidents (default 10 per addModParams; clamped so a portal
  // doesn't flood the slice). The building stops producing once the budget is spent.
  const budget = Math.min(12, typeof d["totalResidents"] === "number" ? (d["totalResidents"] as number) : 10);
  const dieSound = typeof d["dieSound"] === "string" ? (d["dieSound"] as string) : undefined;
  const e = DwellingArchetype.create(makeEntityId());
  e.type = game.teamMaster.isPlayerSide(team) ? "ally" : "enemy"; // targetable/destroyable; a #village hut is friendly
  // a dwelling joins the roster as a #teamBuildings member (so hunters with building-roles can target it)
  return e.build({ x, y, walkSpeed: 0, energy, team, teamRole: "#teamBuildings", animChar, box: 24, residentGroups: groups, budget, dieSound });
}

export function spawnPlayer(x: number, y: number): Entity {
  // real Merlin: act_player carries energy/strength/mana_* + the #punch attack; act_merlin the walkSpeed.
  const d = registry.resolveActor("player") ?? {};
  const md = registry.resolveActor("merlin") ?? {};
  const num = (src: Record<string, any>, k: string, dflt: number) => (typeof src[k] === "number" ? (src[k] as number) : dflt);
  const e = PlayerArchetype.create(makeEntityId());
  e.type = "player";
  return e.build({
    x, y,
    walkSpeed: num(md, "walkSpeed", 4),
    energy: num(d, "energy", 200),
    strength: num(d, "strength", 8),
    mana_capacity: num(d, "mana_capacity", 10),
    mana_flow: num(d, "mana_flow", 1),
    mana_burst: num(d, "mana_burst", 1),
    mana_regeneration: num(d, "mana_regeneration", 1), // cooldown divisor (not a pool regen rate)
    // per-level growth (modCharacterAttackProperties / modEnergy)
    mana_capacityIncLevel: num(d, "mana_capacityIncLevel", 0.5),
    mana_flowIncLevel: num(d, "mana_flowIncLevel", 0.1),
    mana_burstIncLevel: num(d, "mana_burstIncLevel", 0.1),
    mana_regenerationIncLevel: num(d, "mana_regenerationIncLevel", 0.1),
    strengthIncLevel: num(d, "strengthIncLevel", 0.1),
    experienceAmountForNextLevel: num(d, "experienceAmountForNextLevel", 10),
    energyIncPercentage: num(d, "energyIncPercentage", 2),
    energyRecoverDelay: num(d, "energyRecoverDelay", 30),
    team: "#aldevar", teamRole: "#teamMembers", animChar: "mer", box: 12,
    invince: 18, // brief i-frames so overlapping enemies can't chain-kill
    // act_player #punch targeting: auto-aim/melee at enemies (#aldevar.hates), reach = punch reach.
    targetAllegiance: "#enemy", targetCriteria: "#closestDistance",
    targetRoles: [["#teamMembers", "#teamBuildings"]],
    hits: ["#teamMembers", "#teamBuildings"], targetReach: 18,
  });
}

/** Spawn an enemy from real act_*.txt data (resolved #inherit/#attack), e.g. "blackOrc". */
export function spawnEnemy(actorName: string, x: number, y: number, opts: { animChar?: string; ranged?: boolean } = {}): Entity {
  const d = registry.resolveActor(actorName) ?? {};
  const num = (k: string, dflt: number) => (typeof d[k] === "number" ? (d[k] as number) : dflt);
  const str = (k: string, dflt: string) => (typeof d[k] === "string" ? (d[k] as string) : dflt);
  // real #attack drives cooldown / reach / ranged-ness / power (PLAN_REVIEW: damage == knockback).
  // characters carry attacks indirectly via #weapon (the attack lives on the weapon actor).
  const objAttack = (v: any): Record<string, any> =>
    (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
  let atk = objAttack(d["attack"]);
  if (!atk["animType"] && typeof d["weapon"] === "string") {
    atk = objAttack((registry.resolveActor(d["weapon"]) ?? {})["attack"]);
  }
  const animType = typeof atk["animType"] === "string" ? atk["animType"] : "";
  const ranged = opts.ranged ?? (animType === "#weaponRanged" || animType === "#magic");
  const aiType = str("AiType", "");
  // FSM configuration from #AiType: spellcasters/flying-bombers kite (runReload after a shot); the
  // ghost keeps the drift approximation (possession is out of scope). Bombers now run a normal attack
  // loop (no suicide). aiKind/targetTypes are gone — allegiance is data-driven via Targeting.
  const ghost = aiType === "#objAiCPUGhost";
  const runReload = !ghost && ranged && (aiType === "#objAiCPUSpellCaster" || animType === "#magic" || aiType === "#objAiFlyingBomber");
  const pw = atk["power"];
  const atkPower = pw && typeof pw === "object" && "x" in pw ? Math.abs(pw.x) + Math.abs(pw.y) : 0;
  // #attack target fields (default structAttack): allegiance/criteria/roles/hits + reach (point -> radius)
  const rch = atk["reach"];
  const targetReach = typeof rch === "number" ? rch
    : (rch && typeof rch === "object" && "x" in rch ? Math.hypot(rch.x, rch.y) : undefined);
  const e = EnemyArchetype.create(makeEntityId());
  e.type = "enemy";
  return e.build({
    x, y,
    walkSpeed: num("walkSpeed", 3) * 0.6, // engine walk units -> px/tick (tuned to the slice)
    energy: num("energy", 40),
    strength: num("strength", 5),
    team: str("team", "#monsters"), teamRole: "#teamMembers",
    animChar: opts.animChar ?? actorName, box: 14,
    inertia: num("inertia", 0), // resists knockback (modGameObject damping); heavy orcs get shoved less
    ranged, runReload, ghost,
    atkCooldown: typeof atk["cooldown"] === "number" ? atk["cooldown"] : undefined,
    atkReach: typeof atk["reach"] === "number" ? atk["reach"] : undefined,
    atkPower: atkPower || undefined,
    atkSound: typeof atk["sound"] === "string" ? atk["sound"] : undefined,   // #attack.sound
    // teamMaster.findTarget / impactMeleeAttack config (#attack.target*); defaults from structAttack
    targetAllegiance: typeof atk["targetAllegiance"] === "string" ? atk["targetAllegiance"] : "#enemy",
    targetCriteria: typeof atk["targetCriteria"] === "string" ? atk["targetCriteria"] : "#closestDistance",
    targetRoles: Array.isArray(atk["targetRoles"]) ? atk["targetRoles"] : [["#teamMembers", "#teamBuildings"]],
    hits: Array.isArray(atk["hits"]) ? atk["hits"] : ["#teamMembers"],
    targetReach: targetReach ?? (ranged ? 150 : 22),
    dieSound: typeof d["dieSound"] === "string" ? d["dieSound"] : undefined,  // played on death
    experienceImWorth: num("experienceImWorth", 0) || undefined,             // XP this unit grants
    energyIncPercentage: num("energyIncPercentage", 0) || undefined,
    energyRecoverDelay: num("energyRecoverDelay", 0) || undefined,
  });
}
