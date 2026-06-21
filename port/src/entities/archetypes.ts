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
import { WeaponManager, resolveAttack } from "../components/weapon";
import { WeaponTechnique } from "../components/weaponTechnique";
import { Hurt } from "../components/hurt";
import { ColourTransform } from "../components/colourTransform";
import { Reincarnate, parseReincarnate as parseReincarnateList } from "../components/reincarnate";
import { Grave } from "../components/grave";
import { Dwelling } from "../components/dwelling";
import { Identity } from "../components/identity";
import { Medikit } from "../components/medikit";
import { ExtraLives } from "../components/extraLives";
import { WastedMode } from "../components/wasted";
import { Pickup, type PickupEffect } from "../components/pickup";
export type PickupSym = PickupEffect;
import { registry } from "../game/data";
import { game } from "../game/context";

const DEFAULTS = { isDead: false, getTeam: "", getTeamRole: "#teamMembers", energyFrac: 1, getLevel: 1, isFrozen: false, freezeFactor: 1, isInvince: false, isHurt: false, getColourTransform: null, getAlpha: undefined, colourTransformFin: undefined };

// Experience is ordered BEFORE Energy (records attacker before death); Hurt is AFTER Energy
// (feedback + i-frames arm once the hit has landed). Targeting (the #attack.target* config) sits with
// Team so teamMaster.findTarget / impactMeleeAttack can read it generically.
// WeaponManager (modWeaponManager) sits after Mana (so addCooldownCounter reads manaRegeneration at
// init) and supplies the data-driven #attack/charge/cooldown the control/AI driver dispatches on.
export const PlayerArchetype = new Archetype("player", [Identity, PlayerControl, Freeze, Mana, WeaponManager, Movement, Anim, ColourTransform, Experience, Energy, Hurt, Medikit, ExtraLives, WastedMode, Team, Targeting], { defaults: { ...DEFAULTS, getActorType: "", getNumOfMedikits: 0, getExtraLives: 0, isWasted: false } });
export const EnemyArchetype = new Archetype("enemy", [Identity, Grave, EnemyAI, Freeze, Mana, WeaponManager, WeaponTechnique, Movement, Anim, ColourTransform, Experience, Energy, Hurt, Reincarnate, Team, Targeting], { defaults: { ...DEFAULTS, getActorType: "", getKilledInAction: false } });
// Dwellings are static (no AI) but reuse Movement for position + Energy/Team so they're targetable.
export const DwellingArchetype = new Archetype("dwelling", [Identity, Grave, Dwelling, Movement, Anim, ColourTransform, Energy, Hurt, Team, Targeting], { defaults: { ...DEFAULTS, getActorType: "" } });

/** Summon a friendly unit on Merlin's team that hunts enemies, using the actor's real stats. */
export function spawnAlly(actorName: string, x: number, y: number, animChar = actorName): Entity {
  const e = spawnEnemy(actorName, x, y, { animChar }); // real energy/strength/walkSpeed/attack from data
  e.type = "ally";
  e.get(Team).team = "#aldevar"; // summoned onto the player's side; #enemy allegiance => hunts #aldevar.hates
  e.flags.add("teleportable"); // pTeleportable: a SUMMONED ally teleports to reserve on room-leave (G2).
  return e;                    // tile-spawned #aldevar units (via spawnUnit) are NOT teleportable.
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

export const PickupArchetype = new Archetype("pickup", [Identity, Pickup, Movement], { defaults: { isDead: false, isFinished: false, getTeam: "", getActorType: "" } });

export function spawnPickup(effect: PickupEffect, x: number, y: number): Entity {
  const e = PickupArchetype.create(makeEntityId());
  e.type = "pickup";
  return e.build({ x, y, walkSpeed: 0, effect, box: 8, actorType: effect });
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
  // lifetime budget from real #totalResidents (default 10 per addModParams). Shipped dwellings are
  // 5-12; modResidents has no cap, so use the real value (the concurrent aliveCap prevents flooding).
  const budget = typeof d["totalResidents"] === "number" ? (d["totalResidents"] as number) : 10;
  const dieSound = typeof d["dieSound"] === "string" ? (d["dieSound"] as string) : undefined;
  const e = DwellingArchetype.create(makeEntityId());
  e.type = game.teamMaster.isPlayerSide(team) ? "ally" : "enemy"; // targetable/destroyable; a #village hut is friendly
  // act_dwelling inherits #inertia 80 (knockback-resistant building) and #energyIncPercentage -1 (its max
  // energy shrinks 1% each time it levels up — i.e. per resident released). Both come through resolveActor
  // but were not forwarded to build; pass them so a dwelling resists reel and decays as it spawns.
  const num = (k: string, dflt: number) => (typeof d[k] === "number" ? (d[k] as number) : dflt);
  // a dwelling joins the roster as a #teamBuildings member (so hunters with building-roles can target it)
  return e.build({ x, y, walkSpeed: 0, energy, team, teamRole: "#teamBuildings", animChar, box: 24,
    inertia: num("inertia", 80), energyIncPercentage: num("energyIncPercentage", -1),
    startingLevel: num("startingLevel", 0),
    residentGroups: groups, budget, dieSound, actorType: actorName });
}

export function spawnPlayer(x: number, y: number): Entity {
  // real Merlin: act_player carries energy/strength/mana_* + the #punch attack; act_merlin the walkSpeed.
  const d = registry.resolveActor("player") ?? {};
  const md = registry.resolveActor("merlin") ?? {};
  const num = (src: Record<string, any>, k: string, dflt: number) => (typeof src[k] === "number" ? (src[k] as number) : dflt);
  const e = PlayerArchetype.create(makeEntityId());
  e.type = "player";
  // actorType set in build cfg below (the respawn key — "player")
  // act_player #punch is Merlin's natural attack (the WeaponManager's first weapon). agility/dexterity
  // seed the per-type cooldown counter inc (act_player: agility 1, dexterity 0.2).
  const punch = resolveAttack(d["attack"] as Record<string, any> | undefined);
  return e.build({
    x, y,
    walkSpeed: num(md, "walkSpeed", 4),
    walkSpeedIncLevel: 0.075, // modMoveToLoc.incWalkSpeedLevel: the player's walk cap grows 0.075/level (1:1)
    energy: num(d, "energy", 200),
    strength: num(d, "strength", 8),
    attack: punch, agility: num(d, "agility", 1), dexterity: num(d, "dexterity", 0.2),
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
    actorType: "player",
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
  // I9 fix — spellcaster casts its #weapon, not its melee #attack. A #objAiCPUSpellCaster (berlinInGame
  // = energyBlast, garonlinInGame = darkBlast, …) carries its OWN #attack as a #naturalMelee #punch
  // backup, but its primary weapon is the magic #weapon (reach 9999 — the spellcaster fires the spell,
  // melee is just an animation backup). The original modWeaponManager sets the magic weapon current, so
  // getAttack().reach == 9999 (the spellcaster's "spell loaded" signal). Previously the port read the
  // melee #attack (its animType is set) and never reached the #weapon fallback, so these named wizards
  // spawned MELEE-ONLY and never cast. When the actor is a spellcaster AND its #weapon resolves to a
  // #magic attack, use the WEAPON's #attack as the firing attack.
  const aiTypeEarly = typeof d["AiType"] === "string" ? (d["AiType"] as string) : "";
  if (typeof d["weapon"] === "string") {
    const weaponAtk = objAttack((registry.resolveActor(d["weapon"].replace(/^#/, "")) ?? {})["attack"]);
    if (!atk["animType"]) {
      atk = weaponAtk;                                            // no own attack -> use the weapon's
    } else if (aiTypeEarly === "#objAiCPUSpellCaster" && weaponAtk["animType"] === "#magic") {
      atk = weaponAtk;                                            // spellcaster -> the magic spell is primary
    }
  }
  const animType = typeof atk["animType"] === "string" ? atk["animType"] : "";
  // K6: a #multiAttack CPU's natural attack is its RANGED weapon 1 (#naturalRanged shuriken/throwSmoke),
  // so it fires at range (its FSM is ranged) and switches to the melee weapon 2 up close.
  const isMulti = d["multiAttack"] === true;
  // a thrower (#naturalRanged) / archer (#weaponRanged) / caster (#magic) fights at RANGE, firing its
  // #bullet — its FSM is ranged (moveToAttack to within reach, then fire), not melee-contact.
  const ranged = opts.ranged ?? (animType === "#weaponRanged" || animType === "#magic"
    || animType === "#naturalRanged");
  const aiType = str("AiType", "");
  // agility/dexterity seed the WeaponManager cooldown-counter inc (melee=agility, ranged=dexterity).
  const agility = num("agility", 1);
  const dexterity = num("dexterity", 0.2);
  // The resolved AttackData the enemy's WeaponManager carries. We preserve the slice's enemy attack
  // FEEL by re-deriving an EFFECTIVE cooldown so the per-weapon counter recovers in the same #frames
  // the old CpuAI used (atkCooldown + (ranged?18:6)). Recovery = ceil((hi-1)/inc); inc is agility for
  // melee, dexterity for ranged/magic. So hi = framesWanted*inc + 1. (Faithful power/reach/sound/bullet
  // pass through unchanged; only the cooldown bound is calibrated — B2 plan §f.3.)
  const rawCooldown = typeof atk["cooldown"] === "number" ? atk["cooldown"] : (ranged ? 40 : 18);
  const framesWanted = Math.max(1, rawCooldown + (ranged ? 18 : 6));
  // the counter inc the WeaponManager will use for THIS weapon's #type (melee=agility, ranged=dexterity,
  // magic=manaRegeneration). manaRegen is passed into the build below so Mana.regeneration (the live inc)
  // matches this calibration inc for magic enemies (else a caster with mana_regeneration!=1 would drift).
  const isMagic = animType === "#magic";
  const manaRegen = num("mana_regeneration", 1);
  const counterInc = isMagic ? manaRegen : ranged ? dexterity : agility;
  const effectiveCooldown = Math.round(framesWanted * (counterInc > 0 ? counterInc : 1) + 1);
  // An enemy with no #attack/#weapon (e.g. monkGhost, #objAiCPUGhost, energy-only) still melee-contacts.
  // Give it a synthetic #natural melee so the WeaponManager builds a cooldown counter — otherwise
  // getCooldownFin() is unconditionally true and the unit attacks EVERY frame (the old code defaulted
  // its cooldown to 18). The synthetic attack carries no power (CpuAI uses its scalar this.power).
  const hasAttack = animType !== "" && typeof atk["name"] === "string" && atk["name"] !== "#none";
  // attackless fallback recovers in the old default 18 frames (cooldownMax 18 for a no-atkCooldown melee).
  const fallbackCooldown = Math.round(18 * (agility > 0 ? agility : 1) + 1);
  const enemyAttack = hasAttack
    ? resolveAttack({ ...atk, cooldown: effectiveCooldown })
    : resolveAttack({ name: "#natural", animType: "#naturalMelee", cooldown: fallbackCooldown });
  // K6: a multiAttack actor's natural attack IS its ranged weapon 1 — force its type so getCurrentAttack()
  // and setMultiAttack's ranged/melee branch are correct (the global animType map keeps it "melee" for scope).
  if (isMulti && (animType === "#naturalRanged" || animType === "#weaponRanged")) (enemyAttack as any).type = "ranged";
  // FSM configuration from #AiType: spellcasters/flying-bombers kite (runReload after a shot); the
  // ghost keeps the drift approximation (possession is out of scope). Bombers now run a normal attack
  // loop (no suicide). aiKind/targetTypes are gone — allegiance is data-driven via Targeting.
  const ghost = aiType === "#objAiCPUGhost";
  // runReload (objCPUCharacter pRunReload, default false): kite away after a shot. The ORIGINAL gates this
  // purely on the #runReload data property (getRunReload). bat/caveBat/evilTv/vultureGuard set it true and
  // were previously ignored. We OR the data flag with the AiType approximations the port leans on for AI
  // kinds it doesn't fully model (spellcaster optimumPosition / flyingbomber kiting) — additive, so the 4
  // data-driven kiters now kite without disturbing the existing spellcaster/bomber behaviour.
  const runReload = !ghost && ranged && (d["runReload"] === true
    || aiType === "#objAiCPUSpellCaster" || animType === "#magic" || aiType === "#objAiFlyingBomber");
  // K4: a spellcaster runs the bullet-dodge optimumPosition chain (tangent-run incoming bullets).
  const dodgesBullets = aiType === "#objAiCPUSpellCaster";
  // K8a: a builder (dwarf/goblinBuilder) walks to a site + incrementally builds its #unitToBuild dwelling.
  const builder = aiType === "#objAiCPUBuilder";
  const unitToBuild = Array.isArray(d["unitToBuild"])
    ? (d["unitToBuild"] as string[]).filter((s) => typeof s === "string" && s !== "#none").map((s) => s.replace(/^#/, ""))
    : [];
  // K6: a #multiAttack:true CPU (ninja/shrouder) carries weapon 1 (natural ranged #attack) + weapon 2
  // (the #weapon's melee #attack), range-switched by setMultiAttack. Build the second weapon's #attack.
  const multiAttack = d["multiAttack"] === true;
  let secondAttack: ReturnType<typeof resolveAttack> | undefined;
  if (multiAttack && typeof d["weapon"] === "string") {
    const w2 = objAttack((registry.resolveActor(d["weapon"].replace(/^#/, "")) ?? {})["attack"]);
    if (w2["animType"]) {
      // weapon 2 gets the same effective-cooldown calibration as a single weapon of its type.
      const w2ranged = w2["animType"] === "#weaponRanged" || w2["animType"] === "#naturalRanged" || w2["animType"] === "#magic";
      const w2raw = typeof w2["cooldown"] === "number" ? w2["cooldown"] : (w2ranged ? 40 : 18);
      const w2frames = Math.max(1, w2raw + (w2ranged ? 18 : 6));
      const w2inc = w2ranged ? dexterity : agility;
      secondAttack = resolveAttack({ ...w2, cooldown: Math.round(w2frames * (w2inc > 0 ? w2inc : 1) + 1) });
      // K6: #naturalRanged isn't globally mapped to "ranged" (scope), so set the two weapons' TYPES
      // explicitly for the range-switch (weapon 1 = ranged natural; weapon 2 = its real melee/ranged type).
      (secondAttack as any).type = w2ranged ? "ranged" : "melee";
    }
  }
  // SPLASH-bullet caster (C2): a ranged CPU whose #attack.bullet is a splash/explode bullet (dwarfTower's
  // towerAxe, energyPulse casters) fires the real splash bullet — on land/collide it resolves an AREA hit
  // through SplashDamage instead of single-target. Resolve that bullet's #attack (+ top-level splashDamageOn).
  let splashBullet: ReturnType<typeof resolveAttack> | undefined;
  // K1: a PLAIN (non-splash) ranged bullet's resolved #attack (archerArrow) carries the faithful
  // power·mult the CpuAI fires as speed·power·mult·BULLET_DAMAGE_SCALE. energyBlastBullet has no record
  // (-> undefined here -> CpuAI falls back to the caster's power).
  let bulletAttack: ReturnType<typeof resolveAttack> | undefined;
  // a fired bullet's #reincarnateAs (objBullet.reincarnate): flamingRock -> #fire, lizardEgg -> #bug,
  // ostrichEgg -> #babyOstrich. The bullet hatches/leaves these at its death loc — threaded to Projectile.
  let bulletReincarnate: string[] = [];
  if (ranged && typeof atk["bullet"] === "string" && atk["bullet"] !== "#none") {
    const bulletActor = registry.resolveActor(atk["bullet"].replace(/^#/, ""));
    const ba = bulletActor ? resolveAttack(bulletActor["attack"] as Record<string, any>, bulletActor) : undefined;
    if (ba && (ba.attackType === "#explode" || ba.splashDamageOn)) splashBullet = ba;
    else if (ba) bulletAttack = ba;
    bulletReincarnate = parseReincarnateList(bulletActor?.["reincarnateAs"] ?? bulletActor?.["reincarnateInto"]);
  }
  const pw = atk["power"];
  const atkPower = pw && typeof pw === "object" && "x" in pw ? Math.abs(pw.x) + Math.abs(pw.y) : 0;
  // #attack target fields (default structAttack): allegiance/criteria/roles/hits + reach (point -> radius)
  const rch = atk["reach"];
  const targetReach = typeof rch === "number" ? rch
    : (rch && typeof rch === "object" && "x" in rch ? Math.hypot(rch.x, rch.y) : undefined);
  const e = EnemyArchetype.create(makeEntityId());
  e.type = "enemy";
  e.build({
    x, y,
    actorType: actorName, // the respawn key (objGameObject.getActorType)
    walkSpeed: num("walkSpeed", 3) * 0.6, // engine walk units -> px/tick (tuned to the slice)
    walkSpeedIncLevel: num("walkSpeed", 3) > 0 ? 0.075 * 0.6 : 0, // modMoveToLoc.incWalkSpeedLevel (engine 0.075 ×0.6 conv)
    // #collisionDetection:false (bat/greyGhost/summonArcher/Warrior/Orc/Golem/Boulder/skelitonSword) and the
    // #objAiCPUGhost (monkGhost, via modGhost.initGhost -> collisionDetectionOff) DRIFT THROUGH terrain —
    // objGameObject.checkCollisions only runs when pCollisionDetection. Map to passThrough (no moveBox).
    passThrough: d["collisionDetection"] === false || ghost,
    constrainToArea: d["collisionDetection"] === false || ghost, // autoConstrainToPlayArea: ghosts stay on-map
    // (#ghost is already passed below for the AI; Movement.init reads it for the takeHit amGhost gate)
    energy: num("energy", 40),
    strength: num("strength", 5),
    team: str("team", "#monsters"), teamRole: "#teamMembers",
    animChar: opts.animChar ?? actorName, box: 14,
    inertia: num("inertia", 0), // resists knockback (modGameObject damping); heavy orcs get shoved less
    ranged, runReload, ghost, splashBullet, bulletAttack, bulletReincarnate,
    // K4/K5/K6/K8a AI config: bullet-dodge caster, multi-attack 2-weapon switch, builder build-loop, the
    // ghost's possess team. Defaults keep every other actor on the existing committed-target FSM.
    dodgesBullets, multiAttack, builder, unitToBuild,
    buildRate: num("buildRate", 100), buildOne: d["buildOne"] !== false,
    buildDie: d["buildDie"] === true, leaveWhenFinished: d["leaveWhenFinished"] === true,
    bufferDist: num("bufferDist", 100),
    teamWhenAlive: typeof d["teamWhenAlive"] === "string" ? (d["teamWhenAlive"] as string) : str("team", "#monsters"),
    // K7 modWeaponTechnique: the attack-anim speedup rating (default 0 = no effect). ninja/shrouder 20,
    // kongFuChicken 200, bowOrc/archer negative.
    weaponTechnique: num("weaponTechnique", 0),
    // WeaponManager: the enemy's weapon(s) + cooldown-counter inc stats. manaRegen is forwarded so a magic
    // enemy's live counter inc (Mana.regeneration) matches the calibration. attack2 = K6 melee weapon 2.
    attack: enemyAttack, attack2: secondAttack, agility, dexterity, mana_regeneration: manaRegen,
    // real mana_* so a CPU caster charges to its true ceiling (summon tiers / charge-scaled spell power)
    mana_capacity: num("mana_capacity", 10), mana_flow: num("mana_flow", 1), mana_burst: num("mana_burst", 1),
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
    // objCPUCharacter overrides objCharacter's energyRecoverDelay(30) -> 300 (objCPUCharacter.txt:22): every
    // CPU/enemy/ally unit slowly regens +1 energy per 300 ticks (modEnergy.recoverEnergy) unless it sets its
    // own. No shipped enemy sets it in data, so the inherited 300 is the live default — NOT 0 (which would
    // give enemies no passive regen at all). An explicit data value still wins.
    energyRecoverDelay: num("energyRecoverDelay", 300),
    // E1 reincarnation: on a lethal death, split into these actors at the corpse loc (Reincarnate).
    // Both #reincarnateAs and #reincarnateInto are honored; #none entries skipped; bare symbol -> [one].
    reincarnateAs: d["reincarnateAs"],
    reincarnateInto: d["reincarnateInto"],
    reincarnateRadius: num("reincarnateRadius", 0) || undefined,
    // #minEnergy: multistage enemies (hydra) die at this energy floor, not 0 (Energy death threshold).
    minEnergy: num("minEnergy", 0) || undefined,
    // #reelProof: knockback/reel-immune (skelitonHead) — Hurt skips the reel feedback (still takes damage).
    reelProof: d["reelProof"] === true || undefined,
  });
  // modExperience #startingLevel: a pre-levelled unit (goblinHero 20, the big golems 5, iceRock 3, …)
  // spawns at its data level (init runs `repeat 1 to pStartingLevel: levelUp`). Apply it AFTER build so
  // every component's #levelUp handler (Energy/strength/Mana growth) exists. experienceImWorth is NOT
  // raised, so a pre-levelled unit is worth the same XP as a fresh one (faithful to the property note).
  const startLevel = num("startingLevel", 0);
  for (let i = 0; i < startLevel; i++) e.send("forceLevelUp");
  return e;
}
