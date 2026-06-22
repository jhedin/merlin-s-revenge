// Control components set Movement intent each tick (run before Movement in the chain).
// PlayerControl reads input, auto-aims/melees through teamMaster, and fires projectiles; CpuAI
// (objAiCPU) is a committed-target FSM (findTarget/moveToAttack/runReload/dazed) that hunts via
// teamMaster.findTarget and resolves melee through teamMaster.impactMeleeAttack.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { spawnSpell } from "../systems/spells";
import { SpellActor } from "./spellActor";
import { Mana } from "./mana";
import { game } from "../game/context";
import type { Input } from "../systems/input";
import { fireBullet, fireSplashBullet, fireBulletPayload, performBeamAttack } from "../systems/bullets";
import { Projectile } from "./projectile";
import { registry } from "../game/data";
import { meleeHitFn } from "../systems/teams";
import { aimWithEyestrain } from "../engine/math";
import { Targeting } from "./combat";
import { WeaponManager, meleeBasePower, enemyMeleeBasePower, resolveAttack, BULLET_DAMAGE_SCALE, type AttackData } from "./weapon";
import { summonUnit, depositMines } from "./summon";
import { chargeMaxOf, chargeStartOf, chargeSpeedOf } from "./charge";
import { PathFinding } from "./pathFinding";
import { ColourTransform } from "./colourTransform";
import { Experience } from "./experience";
import type { Entity } from "../engine/dispatch";

// Damage/bolt-speed are still tuned per charge-unit to the px slice (PLAN_REVIEW: damage == knockback;
// full base charge ~12.5 fells a rank-and-file 300-energy enemy). The CHARGE math (chargeMax/Start/Speed)
// now flows from the magic weapon's #attack × Mana via charge.ts instead of an inline SPELL constant.
const SPELL_FX = { dmgPerUnit: 26, speedBase: 4.5, speedPerUnit: 0.28, speedCap: 9, releaseFrames: 6, life: 110 };
const MELEE_FRAMES = 6; // the melee anim-strip window (presentational)
const bare = (s: string): string => (s.startsWith("#") ? s.slice(1) : s); // #energyBeam -> energyBeam (resolveActor key)
// a #fireBullets spell (energyPulse/beam) streams bullets on release (I8); every other spell is #release
// (grow-fly-explode, the K2 spell actor). The struct default releaseFunction is #release.
const isStreaming = (a: AttackData): boolean => a.releaseFunction === "#fireBullets" || a.releaseFunction === "fireBullets";

// PORT CONTROL SCHEME (B2 plan §f.6): Merlin AUTO-MELEES adjacent hostiles with his current MELEE
// weapon (#punch, upgraded to #merlinSword on pickup) AND holds mouse/space to charge+release magic
// once a magic weapon is owned. WeaponManager is the data store; PlayerControl drives BOTH modes,
// gating each on that weapon's own cooldown counter (resetCooldown on FIRE).
export class PlayerControl extends Component {
  static handles = ["update", "levelUp", "animAction", "chargeFrac", "addSaveData", "restoreFromSave"];
  private strength = 8;
  private strengthInc = 0.1;
  private charge = 0;
  private charging = false;
  // the charge CEILING for the current cast, computed ONCE when charging starts (calcAttackChargeMax sets
  // pChargeMax once, not per-frame). For a #randomSummon spell this bakes in the per-cast tier wobble; for
  // every other spell it equals the deterministic chargeMaxOf (the wobble branch needs randomSummon).
  private chargeCeil = 0;
  private releaseT = 0;
  private meleeT = 0;
  private aimLeft = false;
  private usingSword = false; // most-recent melee swing used #merlinSword (anim/sound)
  // I7 GMG (modGoldenMachineGun): a MODE (not a weapon) modifying the current magic weapon's charge.
  private gmgCollected_ = false; // pGmgCollected — found at least once (the toggle is inert until then)
  private gmgOn = false;         // pGmgOn — the live on/off state (the cosmetic gmgMaster HUD flag)
  // I8 beams (modFireBullets): a short-lived streaming-release substate. On releasing a
  // releaseFunction:#fireBullets spell, latch the held charge here; each tick, every fireDelay frames,
  // emit one #bullet draining chargePerUnit until charge<0. (The port's stand-in for the objSpell actor.)
  private stream: { attack: AttackData; charge: number; delay: number; counter: number;
    aimX: number; aimY: number; team: string } | null = null;
  // K2 spell actor (objSpell): the LIVE charging spell grown over Merlin's head for a #release spell
  // (energyBlast/cBlast/darkBlast/arcticBlast/healBlast/summons). Released to fly+explode; null otherwise.
  private spell: Entity | null = null;

  override init(cfg: Record<string, any>): void {
    this.strength = typeof cfg["strength"] === "number" ? cfg["strength"] : 8;
    this.strengthInc = typeof cfg["strengthIncLevel"] === "number" ? cfg["strengthIncLevel"] : 0.1;
    this.charge = 0; this.charging = false; this.chargeCeil = 0; this.releaseT = this.meleeT = 0; this.usingSword = false;
    this.gmgCollected_ = false; this.gmgOn = false; this.stream = null; this.spell = null;
  }

  // gmgCollected (modGoldenMachineGun.gmgCollected): collecting the GMG scroll sets collected + turns on.
  gmgCollected(): void { this.gmgCollected_ = true; this.setGmg(); }
  // setGmg (modGoldenMachineGun.setGmg): toggle on/off — inert until the GMG has been collected.
  setGmg(): void { if (this.gmgCollected_) this.gmgOn = !this.gmgOn; }
  getGmgOn(): boolean { return this.gmgOn; }
  getGmgCollected(): boolean { return this.gmgCollected_; }

  private wm(): WeaponManager { return this.entity.get(WeaponManager); }

  /** merlinSword scroll: addWeapon a real #weaponMelee (damageMultiplier 16) — auto-selected as melee. */
  equipSword(attack: AttackData): void {
    this.wm().addWeapon(attack.name, attack);
    const tg = this.entity.tryGet(Targeting); if (tg) tg.reach = attack.reach; // widen the melee area sweep
  }
  /** energyBlast scroll (room 6): addWeapon the charged magic (modWeaponManager.addWeapon). */
  grantSpell(attack: AttackData): void { this.wm().addWeapon(attack.name, attack); }

  // summonWizard (modSummonWizard): toggle the selected found wizard in/out of combat at the cursor.
  // Out already -> unsummon (armyTeleportOut). Else summon it from the reserve (banked) or a fresh spawn.
  summonWizard(input: Input): void {
    const wm = game.wizardMaster;
    const active = game.entities.find((e) => e.id === wm.activeWizardId && !e.send("isDead"));
    if (active) { game.armyMaster.teleportOut(active); active.flags.add("left"); wm.clearActive(); return; }
    const typ = wm.currentActorType();           // "<wiz>InGame"
    if (!typ) return;                            // no wizard found yet
    const team = this.entity.send("getTeam") as string;
    const at = input.cursor() ?? this.entity.get(Movement);
    let wiz = game.armyMaster.createUnit(team, typ, at.x, at.y); // re-field from the reserve when banked
    if (!wiz && game.spawnUnit) {                                 // else summon a fresh copy of the found wizard
      wiz = game.spawnUnit(typ.replace(/^#/, ""), at.x, at.y);
      if (!game.entities.includes(wiz)) game.entities.push(wiz);
    }
    if (wiz) wm.setActive(wiz.id);
  }

  // summonArmy (modAutoSummon.summonArmy): re-field a battalion of the player's banked reserve at the
  // cursor, spread around it, respecting the team capacity (gMaxFriends).
  summonArmy(input: Input): void {
    const team = this.entity.send("getTeam") as string;
    const at = input.cursor() ?? this.entity.get(Movement);
    const types = game.armyMaster.reserveTypes(team);
    let i = 0;
    for (const typ of types) {
      if (game.teamMaster.atCapacity(team)) break;
      const ang = (i++ / Math.max(1, types.length)) * Math.PI * 2;
      game.armyMaster.createUnit(team, typ, at.x + Math.cos(ang) * 20, at.y + Math.sin(ang) * 20);
    }
  }

  // weapon inventory persists via WeaponManager.addSaveData/restoreFromSave (no booleans here anymore).
  // The GMG collected/on flags persist (modGoldenMachineGun.addSaveData) — a held GMG survives save/load.
  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["gmg"] = { collected: this.gmgCollected_, on: this.gmgOn };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const r = next(sd);
    if (sd["gmg"]) { this.gmgCollected_ = sd["gmg"].collected === true; this.gmgOn = sd["gmg"].on === true; }
    // after WeaponManager restored the inventory, re-widen the melee sweep to the current melee reach.
    const ma = this.wm().getMeleeAttack();
    const tg = this.entity.tryGet(Targeting); if (ma && tg) tg.reach = ma.reach;
    return r;
  }

  // incStrength on level-up (modCharacterAttackProperties). Melee power now derives from the weapon ×
  // current strength at swing time, so there is no power scalar to rescale.
  levelUp(next: NextFn): void { this.strength += this.strengthInc; next(); }

  update(next: NextFn): void {
    if (this.releaseT > 0) this.releaseT--;
    if (this.meleeT > 0) this.meleeT--;
    // I8: tick any in-flight bullet stream (modFireBullets) regardless of input/death — it owns its
    // own residual charge and drains independently once released.
    if (this.stream) this.tickStream();
    if (this.entity.send("isDead")) {
      const m = this.entity.get(Movement); m.intentX = m.intentY = 0;
      // dying mid-charge: drop the held charge orb so it doesn't hang frozen in the world (it never
      // releases/finishes, so sweepSpells would never reap it) — and clear the charge latch.
      if (this.spell) { this.spell.get(SpellActor).discard(); this.spell = null; }
      this.charging = false; this.charge = 0;
      return next();
    }

    // objPlayerMerlinCharacter.takeHit OVERRIDES modReel: after the hit it immediately goMode(#walk), so
    // Merlin NEVER reels/dazes — he takes the damage (and the knockback slide) but keeps FULL control the
    // same frame (unlike a CPU unit, which goes #dazed). And modInvince grants i-frames only from PICKUPS,
    // never from a hit — so there is no post-hit input-lock and no hit-invincibility here (faithful: a swarm
    // can damage Merlin every cooldown-gated swing). The white flash (modFlasher) still plays for feedback.

    const input = game.input;
    const m = this.entity.get(Movement);
    const mv = input.moveVector();
    m.intentX = mv.x; m.intentY = mv.y;

    // G key (objAiPlayer.interpretGameKeys -> setGmg): toggle the Golden Machine Gun on/off (edge).
    const gmgBefore = this.gmgOn;
    if (input.pressed("g")) this.setGmg();
    const gmgToggled = this.gmgOn !== gmgBefore;

    // #spell1..#spell9 hotkeys (objAiPlayer:157-187 -> selectSpell(n)): number keys 1-9 switch the current
    // magic weapon (energyBlast/armySummon/...). Without this the player was stuck on the last-collected
    // spell. selectSpell is 0-indexed, so #spellN -> n-1. (Save/load moved off 1/2 to F5/F9 in main.ts.)
    for (let n = 1; n <= 9; n++) if (input.pressed(String(n))) this.wm().selectSpell(n - 1);

    // #weaponSelector (objAiPlayer.interpretGameKeys -> displayWeaponSelector): the E key opens the weapon
    // palette; while it's up, a click picks a weapon (so the primary fire is suppressed, below).
    if (input.pressed("e")) game.weaponPalette?.open(this.entity);
    if (game.weaponPalette?.displaying) game.weaponPalette.tick(input, this.entity);

    // the summon-helper system (modSummonWizard / modAutoSummon): Q summons/unsummons the selected found
    // wizard at the cursor, Tab cycles which wizard, C summons a battalion from the reserve.
    if (input.pressed("q")) this.summonWizard(input);
    if (input.pressed("tab")) game.wizardMaster.selectNext();
    if (input.pressed("c")) this.summonArmy(input);

    // aim point: the cursor in world space, else the auto-acquired target (teamMaster.findTarget over
    // data allegiance/roles — same logic every unit uses), else current facing
    const cur = input.cursor();
    const target = game.teamMaster.findTarget(this.entity).obj;
    const aim = cur ?? (target ? target.send("getPos") as { x: number; y: number }
      : { x: m.x + (m.facingLeft ? -100 : 100), y: m.y });
    this.aimLeft = aim.x < m.x;

    const wm = this.wm();
    const mana = this.entity.get(Mana);
    const magic = wm.getMagicAttack();           // the owned magic weapon (energyBlast), or null
    const melee = wm.getMeleeAttack();           // the current melee weapon (#punch / #merlinSword)
    // suppress fire while the weapon palette is open (a click there picks a weapon, it doesn't cast).
    const primary = (input.mouseDown() || input.held(" ")) && !game.weaponPalette?.displaying;
    const gmg = this.gmgOn;

    // objAiPlayer.internalEvent #gmgTurnedOn/#gmgTurnedOff: toggling the GMG while a charge is held
    // RELEASES it immediately (playerAttackRelease) instead of holding it across the mode switch. (The
    // #gmgTurnedOff follow-up playerAttackCharge resumes naturally while fire is still held — gated by the
    // weapon cooldown — so the observable outcome matches without an unsafe same-frame double-fire.)
    if (gmgToggled && this.charging && magic) {
      this.castMagic(magic, m, aim, wm);
      this.charging = false; this.charge = 0; this.spell = null;
      return next();
    }

    // hold-to-charge magic — only once Merlin owns a magic weapon. No pool gate; the recast gate is the
    // magic weapon's own cooldown counter (getCooldownFin), reset on FIRE.
    const magicReady = magic ? wm.cooldownFinFor(magic.name) : false;
    if (magic && primary && magicReady) {
      if (!this.charging) {
        this.charge = chargeStartOf(magic, mana, gmg); game.audio?.play("spell_charge");
        // calcAttackChargeMax fires ONCE per cast → bake the (possibly #randomSummon-wobbled) ceiling now.
        this.chargeCeil = chargeMaxOf(magic, mana, game.rng, gmg);
      }
      this.charging = true;
      m.facingLeft = this.aimLeft;
      const cm = this.chargeCeil;
      this.charge = Math.min(cm, this.charge + chargeSpeedOf(magic, mana, gmg));
      // K2 ensureSpell/chargeSpell (objAiAttack.chargeMagic): a #release spell grows a LIVE objSpell over
      // Merlin's head each tick (the #fireBullets streamers carry no charge actor — they latch on release).
      if (!isStreaming(magic)) this.ensureSpell(magic, m).get(SpellActor).setCharge(this.charge, m.x, m.y - 6);
      // I7 auto-fire (objAiPlayer.internalEvent #spellCharged): under GMG with gmgAutoFire, the instant
      // the charge reaches max, release the spell and immediately re-charge (continuous machine-gun fire).
      if (gmg && magic.gmgAutoFire && this.charge >= cm) {
        this.castMagic(magic, m, aim, wm);              // playerAttackRelease
        this.charge = chargeStartOf(magic, mana, gmg);  // playerAttackCharge (re-charge from gmgChargeStart)
      }
    } else if (this.charging) {
      if (magic) this.castMagic(magic, m, aim, wm); // released or cooled down -> fire at whatever charge was held
      else if (this.spell) { this.spell.get(SpellActor).discard(); this.spell = null; } // no weapon -> drop the orb
      this.charging = false; this.charge = 0;
    } else if (melee && primary) {
      // objAiPlayer.interpretMouse: a swing fires ONLY while the fire button is held (#pressed ->
      // playerAttackCharge -> attack; #notPressed does nothing). So melee is click/hold-to-attack — it
      // autofires on cooldown WHILE held (into empty air, target-independent), and stops when you release.
      this.tryMelee(melee, m, wm);
    }
    next();
  }

  // I8 tickStream (modFireBullets.updateFireBullets): every fireDelay frames, fire one bullet draining
  // chargePerUnit; drain happens BEFORE the <0 check (so the bullet count == floor(held/chargePerUnit) and
  // the LAST shot that would push charge negative does NOT fire). fireDelay=0 (GMG) empties in one tick.
  private tickStream(): void {
    const s = this.stream!;
    const m = this.entity.get(Movement);
    // emit as many shots as fall due this tick (fireDelay==0 -> drain the whole stream in one tick).
    let guard = 0;
    while (s.counter <= 0 && guard++ < 10000) {
      s.charge -= s.attack.chargePerUnit;       // reduce charge (modFireBullets.fireBullet)
      if (s.charge < 0) { this.stream = null; return; } // finished -> spell actor dies
      this.emitStreamBullet(s, m);
      s.counter = s.delay;                       // resetFireDelay (CounterReset)
      if (s.delay <= 0) continue;                // fireDelay 0 -> keep emptying this tick
      break;
    }
    if (this.stream) s.counter--;                // Counter(pFireDelayCounter) — count toward the next shot
  }

  // emit one bullet of the stream — energyBeam via the beam path, energyPulse via fireSplashBullet (it
  // carries an explode #attack, C2). Both spawn the #bullet actor's resolved #attack at the cast/target.
  private emitStreamBullet(s: { attack: AttackData; aimX: number; aimY: number; team: string }, m: Movement): void {
    const bulletAttack = resolveAttack(((registry.resolveActor(bare(s.attack.bullet)) ?? {})["attack"]) as any,
      registry.resolveActor(bare(s.attack.bullet)) as any);
    const hits = s.attack.hits.length ? s.attack.hits : ["#teamMembers", "#teamBuildings"];
    if (s.attack.beam) {
      performBeamAttack(this.entity.id, m.x, m.y - 6, s.aimX, s.aimY, bulletAttack, s.team, hits, "#enemy");
    } else {
      const dirX = s.aimX - m.x, dirY = (s.aimY - 6) - m.y;
      fireSplashBullet(this.entity.id, m.x, m.y - 6, dirX, dirY, s.attack.spellSpeed / 3, bulletAttack,
        s.team, hits, "#enemy", 90);
    }
    game.audio?.play("spell_release", 0.4);
  }

  // ensureSpell (objAiAttack.ensureSpell): a live objSpell over Merlin's head for a #release spell. Spawns
  // one if none is charging; carries the spell's team + payload-derived allegiance (heal -> friendly).
  private ensureSpell(attack: AttackData, m: Movement): Entity {
    if (this.spell && !(this.spell.send("isFinished") as boolean)) return this.spell;
    const team = this.entity.send("getTeam") as string;
    const allegiance = attack.payloadFunction.includes("takeHeal") ? "#friendly" : "#enemy";
    this.spell = spawnSpell(attack, this.entity.id, m.x, m.y - 6, team, attack.hits, allegiance);
    this.spell.get(SpellActor).aimDir = this.aimLeft ? -1 : 1;
    return this.spell;
  }

  private castMagic(attack: AttackData, m: Movement, aim: { x: number; y: number }, wm: WeaponManager): void {
    const c = this.charge; // already >= chargeStart
    const team = this.entity.send("getTeam") as string;

    // I8 streaming release (modFireBullets #spellReleased): a releaseFunction:#fireBullets spell does NOT
    // fly+explode — it starts a bullet stream draining chargePerUnit per shot over fireDelay frames.
    // Under GMG, ensureSpell forces fireDelay=0 -> the stream empties in one tick.
    if (isStreaming(attack)) {
      const delay = this.gmgOn ? 0 : Math.round(attack.fireDelay);
      this.stream = { attack, charge: c, delay, counter: 0, aimX: aim.x, aimY: aim.y, team };
      m.facingLeft = this.aimLeft;
      wm.resetCooldownFor(attack.name);
      this.releaseT = SPELL_FX.releaseFrames;
      return;
    }

    // K2 #release (objAiAttack.releaseMagic -> objSpell.release): release the live spell — it flies to the
    // aim point and EXPLODES radially on arrival. The summon (armySummon/monsterSummon), freeze, heal and
    // damage all resolve at the LANDING loc via the spell's explode (no instant bolt). spellSpeed/3 -> px.
    const spell = this.ensureSpell(attack, m);
    spell.get(SpellActor).setCharge(c, m.x, m.y - 6);          // final size at release
    spell.get(SpellActor).release(aim.x, aim.y, Math.max(2, attack.spellSpeed / 3));
    this.spell = null;
    m.facingLeft = this.aimLeft;
    wm.resetCooldownFor(attack.name); // recast gate = the magic weapon's cooldown counter (cd/manaRegeneration)
    this.releaseT = SPELL_FX.releaseFrames;
  }

  private tryMelee(attack: AttackData, m: Movement, wm: WeaponManager): void {
    if (!wm.cooldownFinFor(attack.name)) return;                 // per-weapon cooldown counter gate
    // objAiPlayer: "#melee and #ranged will autofire" — the player swings on cooldown UNCONDITIONALLY
    // (objAiAttack.attack/attackMelee gate only on getCooldownFin, never on a target/reach). The swing
    // animates + sounds into empty air; `reach` is only the damage AREA, so impactMeleeAttack just whiffs
    // when nothing's there. (Was wrongly target+reach-gated, so Merlin wouldn't punch unless next to a foe.)
    m.facingLeft = this.aimLeft;                                 // swing toward the aim
    // performMeleeAttack -> teamMaster.impactMeleeAttack: area resolution. A swing knocks back EVERY
    // hostile (role #hits) within reach, each via A1's aimed-vector takeHit. Damage = power·strength·SCALE
    // carried as the vector L1, times damageMultiplier as `mult` (now data-driven from the weapon).
    // J2 #magicMelee (energyPunch): calcCollisionVectMelee adds a mana term — power·(strength +
    // 1.5·manaCapacity)/1.5 — so a magic punch scales with mana. #naturalMelee/#weaponMelee (punch/sword)
    // use plain strength (unchanged, no room-1 regression).
    const effStrength = attack.animType === "#magicMelee"
      ? (this.strength + 1.5 * this.entity.get(Mana).capacity) / 1.5
      : this.strength;
    const base = meleeBasePower(attack, effStrength);
    game.teamMaster.impactMeleeAttack(this.entity, meleeHitFn(this.entity, this.entity.id, base, attack.damageMultiplier));
    wm.resetCooldownFor(attack.name);
    this.meleeT = MELEE_FRAMES;
    this.usingSword = attack.type === "melee" && attack.animType === "#weaponMelee";
    game.audio?.play(this.usingSword ? "skeleton_fire" : "wizard_punch"); // #attack.sound: merlinSword / #punch
  }

  // action override for modAnimSet: melee / release / charge strips take priority over walk/stand
  animAction(): string | null {
    if (this.entity.send("isDead")) return null;
    const moving = this.entity.get(Movement).moving();
    if (this.meleeT > 0) return this.usingSword ? "weaponMelee" : "naturalMelee";
    if (this.releaseT > 0) return moving ? "releasewalk" : "release";
    if (this.charging) return moving ? "chargewalk" : "charge";
    return null;
  }

  chargeFrac(): number {
    if (!this.charging) return 0;
    const magic = this.wm().getMagicAttack();
    if (!magic) return 0;
    // use the per-cast cached ceiling so the orb ratio matches a wobbled #randomSummon ceiling.
    const ceil = this.chargeCeil > 0 ? this.chargeCeil : chargeMaxOf(magic, this.entity.get(Mana));
    return Math.min(1, this.charge / ceil);
  }
}

// CpuAI (objAiCPU): the committed-target decision FSM. A referenced controller (objAiGameObject.pAI)
// whose update() drives modes findTarget -> moveToAttack -> attack -> attackFin, with runReload (kite)
// and dazed (reel/recoil/die). The single best target is acquired ONCE via teamMaster.findTarget,
// COMMITTED as a #target relationship (teamMaster.subscribe), dropped reactively on #leaveGame, and
// only re-evaluated on a 30-frame throttle or after an attack — not re-scanned every tick (the cardinal
// behaviour change vs the old per-tick nearest scan). Allegiance/criteria/roles flow from Targeting.
type CpuMode = "findTarget" | "moveToAttack" | "runReload" | "dazed" | "optimumPosition";
type GhostMode = "findTarget" | "goToLoc";
type BuilderMode = "lookForBuilding" | "walkToBuilding" | "build" | "fight";

export class CpuAI extends Component {
  static handles = ["update", "levelUp", "eventLeaveGame", "characterModeChanged", "getAiMode", "getAiTarget",
    "getTargetDetails", "setAiTarget", "attackActive"];
  reach = 22;          // melee strike reach (targetInReachMelee)
  reachRanged = 150;   // ranged targetInReachRanged (GeomDist < reach)
  power = 8;           // melee-vector strength source (strength); bullet damage uses weapon power
  ranged = false;
  runReload = false;   // getRunReload: kite away after a shot until cooled (ranged casters)
  atkSound = "";       // #attack.sound
  ghost = false;       // objAiCPUGhost: drifts looking for a #monk to possess (K5)
  dodgesBullets = false; // K4: objAiCPUSpellCaster — runs the bullet-dodge optimumPosition chain
  builder = false;     // K8a: objAiCPUBuilder — walk-to-site + incremental dwelling build
  multiAttack = false; // K6: setMultiAttack — range-based 2-weapon auto-switch (ninja/shrouder)
  bufferDist = 100;    // K6 #bufferDist (default 100)
  teamWhenAlive = "";  // K5: the ghost's possess team (#aldevar) — getTeamWhenAlive
  splashBullet: AttackData | null = null; // towerAxe/energyPulse etc: fire a SPLASH bullet, not single-target
  bulletAttack: AttackData | null = null; // K1: a plain (non-splash) ranged weapon's resolved #attack.bullet
  bulletChar = "";                         // the fired bullet's sprite char (archerArrow/axe…) for `<char>_fly`
  bulletReincarnate: string[] = [];       // bullet #reincarnateAs (flamingRock->fire, eggs->creature): hatch on death
  // K8a builder data (modBuilder): the unitToBuild list, build rate (per-100 advances a frame), and the
  // buildOne/buildDie/leaveWhenFinished disposition.
  unitToBuild: string[] = [];
  buildRate = 100; buildOne = true; buildDie = false; leaveWhenFinished = false;
  private strength = 5;
  private strengthInc = 0.1; // modCharacterAttackProperties #strengthIncLevel: melee strength grows per level
  private eyestrain = 0;     // modCharacterAttackProperties #eyestrain: ranged/magic aim scatter (px at max range)

  private mode: CpuMode = "findTarget";
  private target: Entity | null = null;
  private retargetCtr = 0;                  // pRetargetCounter: forced re-eval every 30 frames
  private static readonly RETARGET = 30;
  private noTargetCtr = 0;                  // frames with no target (leaveWhenFinished retire grace)
  private static readonly LEAVE_GRACE = 60; // ~2s of no targets before a leaveWhenFinished ally retires
  private attackT = 0;                       // #attack-mode window (drives modWeaponTechnique accumulation)
  private static readonly ATTACK_FRAMES = 6;
  private path = new PathFinding();          // K3 modPathFinding (beeline→scenic)
  // K5 ghost FSM
  private ghostMode: GhostMode = "findTarget";
  private ghostTargetX = 0; private ghostTargetY = 0;
  // K8a builder FSM
  private builderMode: BuilderMode = "lookForBuilding";
  private building: Entity | null = null;
  private buildAmount = 0; private builtCount = 0;
  private static readonly POSSESS_DIST = 10; // pPossessDistance
  private static readonly BUILD_RANGE = 50;  // pBuildRange
  private static readonly BULLET_SAFE = 100;  // pBulletSafeDistance
  private static readonly ENEMY_SAFE = 100;   // pEnemySafeDistance

  override init(cfg: Record<string, any>): void {
    this.strength = typeof cfg["strength"] === "number" ? cfg["strength"] : 5;
    this.strengthInc = typeof cfg["strengthIncLevel"] === "number" ? cfg["strengthIncLevel"] : 0.1;
    this.eyestrain = typeof cfg["eyestrain"] === "number" ? cfg["eyestrain"] : 0;
    const strPow = this.strength / 3;
    const atkPow = typeof cfg["atkPower"] === "number" ? cfg["atkPower"] : 0;
    this.power = Math.max(4, Math.round(strPow + atkPow));
    this.ranged = cfg["ranged"] === true;
    this.runReload = cfg["runReload"] === true; // spellcaster kite
    this.ghost = cfg["ghost"] === true;
    this.dodgesBullets = cfg["dodgesBullets"] === true;
    this.builder = cfg["builder"] === true;
    this.multiAttack = cfg["multiAttack"] === true;
    this.bufferDist = typeof cfg["bufferDist"] === "number" ? cfg["bufferDist"] : 100;
    this.teamWhenAlive = typeof cfg["teamWhenAlive"] === "string" ? cfg["teamWhenAlive"] : "";
    this.unitToBuild = Array.isArray(cfg["unitToBuild"]) ? cfg["unitToBuild"].slice() : [];
    this.buildRate = typeof cfg["buildRate"] === "number" ? cfg["buildRate"] : 100;
    this.buildOne = cfg["buildOne"] !== false;
    this.buildDie = cfg["buildDie"] === true;
    this.leaveWhenFinished = cfg["leaveWhenFinished"] === true;
    if (typeof cfg["atkReach"] === "number") {
      if (this.ranged) this.reachRanged = Math.min(220, Math.max(60, cfg["atkReach"])); // cap magic's 9999
      else this.reach = Math.max(16, Math.min(40, cfg["atkReach"]));
    }
    this.atkSound = typeof cfg["atkSound"] === "string" ? cfg["atkSound"] : "";
    this.splashBullet = (cfg["splashBullet"] as AttackData | undefined) ?? null; // a ranged CPU's splash bullet (tower)
    this.bulletAttack = (cfg["bulletAttack"] as AttackData | undefined) ?? null; // K1: plain bullet's #attack (power/mult)
    this.bulletChar = typeof cfg["bulletChar"] === "string" ? cfg["bulletChar"] : "";
    this.bulletReincarnate = (cfg["bulletReincarnate"] as string[] | undefined) ?? []; // bullet hatch/leave-behind list
    this.retargetCtr = 0; this.noTargetCtr = 0;
    this.mode = "findTarget"; this.target = null; this.attackT = 0;
    this.path.reset();
    this.ghostMode = "findTarget"; this.ghostTargetX = this.ghostTargetY = 0;
    this.builderMode = "lookForBuilding"; this.building = null; this.buildAmount = 0; this.builtCount = 0;
  }
  override reset(): void {
    this.mode = "findTarget"; this.target = null; this.retargetCtr = 0; this.attackT = 0; this.path.reset();
    this.ghostMode = "findTarget"; this.builderMode = "lookForBuilding"; this.building = null;
  }

  // levelUp (modCharacterAttackProperties.incStrength via #levelUp): an enemy/ally CPU's melee strength grows
  // per level, like the player's. Without this an enemy that levels (now from its first kill, threshold 0)
  // would deal the same melee damage forever. Fans out alongside Energy/Mana/walk-speed growth.
  levelUp(next: NextFn): any { this.strength += this.strengthInc; return next(); }

  // attackActive (modWeaponTechnique.update gate: getAI().getMode() == #attack): true during the brief
  // strike window after an attack fires — when the attack anim plays and technique accumulates.
  attackActive(): boolean { return this.attackT > 0; }

  // Fire gate is now the enemy's single-weapon cooldown counter (modWeaponManager getCooldownFin),
  // reset on FIRE. Recovery #frames preserve the slice's enemy attack feel (effective cooldown derived
  // in spawnEnemy from atkCooldown + (ranged?18:6)). Replaces the old this.cooldown countdown.
  private cooledDown(): boolean { return this.entity.get(WeaponManager).getCooldownFin(); }

  getAiMode(): CpuMode { return this.mode; }        // query (tests / debug)
  getAiTarget(): Entity | null { return this.target; }

  // getTargetDetails (objGameObject 542-555): a POSITIONAL locator for my committed target (G1c). Saved
  // by serializeActor as ActorSave.rel — NEVER an entity id. A dead/absent target returns null.
  getTargetDetails(): { team: string; role: string; x: number; y: number } | null {
    const t = this.target;
    if (!t || (t.send("isDead") as boolean)) return null;
    const p = t.send("getPos") as { x: number; y: number };
    return { team: (t.send("getTeam") as string) || "", role: (t.send("getTeamRole") as string) || "#teamMembers", x: p.x, y: p.y };
  }
  // setAiTarget (teamMaster.restoreTarget phase-2): commit a re-acquired target and enter moveToAttack.
  setAiTarget(_next: NextFn, t: Entity): void {
    this.target = t; this.mode = "moveToAttack"; this.retargetCtr = 0;
  }

  // characterModeChanged (modAi): reel/recoil/die -> #dazed (freeze intent); recovery -> #findTarget.
  characterModeChanged(_next: NextFn, charMode: string): void {
    const dazing = charMode === "#reel" || charMode === "#recoil" || charMode === "#die" ||
      charMode === "#dead" || charMode === "#look" || charMode === "#finish" ||
      charMode === "#reelFly" || charMode === "#reelLanded" || charMode === "#reelSit";
    if (dazing) this.mode = "dazed";
    else if (this.mode === "dazed") this.mode = "findTarget";
  }

  // eventNotification(#leaveGame, obj): if my committed target left play, drop it and re-acquire.
  eventLeaveGame(_next: NextFn, obj: Entity): void {
    if (obj === this.target) { this.target = null; this.refreshTarget(); }
  }

  update(next: NextFn): void {
    const m = this.entity.get(Movement);
    if (this.attackT > 0) this.attackT--;
    if (this.entity.send("isDead")) { this.idle(m); return next(); }
    if (this.builder) { this.updateBuilder(m); return next(); }
    if (this.ghost) { this.updateGhost(m); return next(); }
    switch (this.mode) {
      case "dazed": this.idle(m); break;                       // frozen while reeling/dying
      case "findTarget":
        this.refreshTarget();
        if (this.target) { this.noTargetCtr = 0; this.goMode("moveToAttack", m); }
        else {
          this.idle(m);
          // objAiCPU #noTargetFound (232-237): a #leaveWhenFinished ally with NO targets left (room clear)
          // teleports OUT — armyTeleportOut banks it to the reserve and removes it (it doesn't linger). The
          // grace counter avoids retiring before the room's enemies have spawned/registered.
          if (this.leaveWhenFinished && ++this.noTargetCtr >= CpuAI.LEAVE_GRACE) this.leaveGame();
        }
        break;
      case "moveToAttack": this.updateMoveToAttack(m); break;
      case "runReload": this.updateRunReload(m); break;
      case "optimumPosition": this.updateMoveToOptimumPosition(m); break;
    }
    next();
  }

  private goMode(mode: CpuMode, m: Movement): void {
    this.mode = mode;
    if (mode === "moveToAttack") this.retargetCtr = 0; // CounterReset(pRetargetCounter)
    if (mode === "dazed" || mode === "findTarget") this.idle(m);
  }

  // leaveGame (objCharacter.leaveGame -> objAiCPU #noTargetFound.armyTeleportOut): a #leaveWhenFinished ally
  // retires when the room is clear — banked to the army reserve (if teleportable) and removed (no grave,
  // not killedInAction). The main loop sweeps the `left`-flagged entity out of game.entities.
  private leaveGame(): void {
    if (this.entity.flags.has("left")) return;
    game.armyMaster.teleportOut(this.entity);  // armyTeleportOut: bank to the reserve if it's a teleportable ally
    this.entity.flags.add("left");
  }

  // updateMoveToAttack (objAiAttack): tick the retarget throttle, drop dead/gone targets, attack in
  // reach, else path toward the target (K3 beeline→scenic).
  private updateMoveToAttack(m: Movement): void {
    if (++this.retargetCtr >= CpuAI.RETARGET) {       // pRetargetCounter: periodic forced re-eval
      this.retargetCtr = 0; this.target = null; this.refreshTarget();
    }
    const target = this.target;
    if (!target || target.send("isDead")) { this.target = null; this.goMode("findTarget", m); return; }
    const tp = target.send("getPos") as { x: number; y: number };
    const dx = tp.x - m.x, dy = tp.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    // K6 setMultiAttack: a 2-weapon CPU (ninja/shrouder) picks ranged weapon 1 beyond bufferDist, melee
    // weapon 2 within — BEFORE deciding reach/attack, so getCurrentAttack()'s reach/type is correct.
    if (this.multiAttack) {
      this.entity.get(WeaponManager).setMultiAttack(this.entity, tp.x, tp.y, m.x, m.y, this.bufferDist);
      this.syncWeaponMode();
    }
    if (this.targetInReach(d)) { this.idle(m); this.attack(m, dx, dy, target); }
    else this.path.findPathToLoc(m, tp.x, tp.y, game.rng);   // K3 pathfinding (beeline→scenic)
  }

  // syncWeaponMode (K6): after a weapon switch, re-read whether the current weapon is ranged so reach
  // gating uses the right band (a ninja in melee uses its short sword reach, at range its shuriken reach).
  private syncWeaponMode(): void {
    const ca = this.entity.get(WeaponManager).getCurrentAttack();
    if (!ca) return;
    this.ranged = ca.type === "ranged" || ca.type === "magic";
    this.reachRanged = Math.min(220, Math.max(60, ca.reach));
    this.reach = Math.max(16, Math.min(40, ca.reach));
  }

  private targetInReach(d: number): boolean { return d <= (this.ranged ? this.reachRanged : this.reach); }

  // updateRunReload (kite): back away from the target until the shot has cooled, then re-engage.
  private updateRunReload(m: Movement): void {
    if (++this.retargetCtr >= CpuAI.RETARGET) {       // objAiCPU.updateRunReload ticks pRetargetCounter while kiting too
      this.retargetCtr = 0; this.target = null; this.refreshTarget();
    }
    const target = this.target;
    if (!target || target.send("isDead")) { this.target = null; this.goMode("findTarget", m); return; }
    const tp = target.send("getPos") as { x: number; y: number };
    const dx = tp.x - m.x, dy = tp.y - m.y; const d = Math.hypot(dx, dy) || 1;
    if (d < this.reachRanged * 0.7) { m.intentX = -dx / d; m.intentY = -dy / d; } else this.idle(m); // moveAwayFromLoc
    if (this.cooledDown()) this.goMode("moveToAttack", m);
  }

  // refreshTarget: only acquire when the #target relation is empty/dead. Commit + subscribe to #leaveGame.
  private refreshTarget(): void {
    if (this.target && !this.target.send("isDead")) return;
    const t = game.teamMaster.findTarget(this.entity);
    if (t.obj) { this.target = t.obj; game.teamMaster.subscribe(t.obj, this.entity); }
    else this.target = null;
  }

  // attackFin: after a strike, clear + re-acquire (retarget every shot, faithful), then the post-attack
  // mode: K4 dodgers → optimumPosition, runReload kiters → runReload, else moveToAttack / findTarget.
  private attackFin(m: Movement): void {
    this.target = null; this.refreshTarget();
    if (!this.target) this.goMode("findTarget", m);
    else if (this.dodgesBullets) this.goMode("optimumPosition", m);
    else if (this.runReload) this.goMode("runReload", m);
    else this.goMode("moveToAttack", m);
  }

  private idle(m: Movement): void { m.intentX = 0; m.intentY = 0; }

  private attack(m: Movement, dx: number, dy: number, target: Entity): void {
    const wm = this.entity.get(WeaponManager);
    if (!wm.getCooldownFin()) return;
    if (this.ranged) {
      const team = this.entity.send("getTeam") as string;
      // #firingType (modAttack performRangedAttack): the THROW velocity. #proportional (the structMaster
      // default) → throwVect = distToTarget/10, so the projectile always crosses the gap in ~10 frames
      // (near targets get a slow lob, far targets a fast one). #fullstrength → constant speed = the
      // attacker's strength. This governs travel time only; the bullet's damage stays on the calibrated
      // K1 reference (the original couples damage to |getVect()|, but the port's tuned damage model is a
      // deliberate abstraction at a fixed reference speed — kept stable so balance/tests don't shift).
      const ftAttack = wm.getCurrentAttack();
      // objAiAttack.modifyLocWithEyestrain: scatter the aim, scaled by dist/reach, so the player can DODGE
      // ranged/magic CPU fire at distance (without it every shot lands dead-on). The player aims by cursor.
      ({ dx, dy } = aimWithEyestrain(dx, dy, this.eyestrain, ftAttack?.reach ?? this.reachRanged, game.rng));
      const throwDist = Math.hypot(dx, dy) || 1;
      const isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength";
      const throwSpeed = isFullStrength ? Math.max(1, this.strength) : Math.max(0.5, throwDist / 10);
      if (ftAttack?.beam && this.splashBullet) {
        // techMech (#objAiCPU + laserBeam, #beam): objAiAttack dispatches #ranged+beam -> performBeamAttack.
        // The beam spawns AT the target loc (stretched/rotated), detonating its explode #attack on the first
        // frame — an INSTANT hit, not a travelling bullet. (faithful: objAiCPU inherits objAiAttack.attack.)
        const tg = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
        performBeamAttack(this.entity.id, m.x, m.y - 6, m.x + dx, m.y + dy, this.splashBullet, team,
          this.splashBullet.hits, tg?.allegiance ?? "#enemy");
      } else if (this.splashBullet) {
        // a static turret (dwarfTower) / splash caster fires its real splash bullet (towerAxe): on
        // land/collide it resolves an AREA hit through SplashDamage (same A1 vector scale).
        const tg = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
        const sb = fireSplashBullet(this.entity.id, m.x, m.y - 6, dx, dy, throwSpeed, this.splashBullet, team,
          this.splashBullet.hits, tg?.allegiance ?? "#enemy", 140, this.bulletChar);
        if (this.bulletReincarnate.length) sb.get(Projectile).reincarnateAs = this.bulletReincarnate; // flamingRock -> #fire
      } else {
        // J1: a magic-weapon CPU caster routes by its #attack payload, like the player's castMagic —
        // a summoner spawns a unit, a healer fires a heal bolt at its (friendly) target — instead of
        // every caster firing a generic damage bolt. Plain bolt-casters (energyBlast/dark/arctic) unchanged.
        const ca = this.entity.get(WeaponManager).getCurrentAttack();
        if (ca && ca.type === "magic" && (ca.explodeFunction === "#summonUnit" || ca.explodeFunction === "summonUnit")) {
          // summon the multistage tier the caster's mana affords (chargeMaxOf = its real charge ceiling).
          // Pass game.rng so a #randomSummon spell (goblin/undead/sc/skeleton summon) wobbles the tier
          // per cast (calcAttackChargeMax) instead of always reaching the deterministic top tier — this is
          // a one-shot at the summon release (cooldown-gated), so it can't jitter.
          const sc = chargeMaxOf(ca, this.entity.get(Mana), game.rng);
          summonUnit(ca, sc, m.x, m.y, this.entity.id); // summon at the caster's loc
        } else if (ca && ca.type === "magic" && (ca.explodeFunction === "#depositMines" || ca.explodeFunction === "depositMines")) {
          // verdanlinInGame energyMines: deposit charge/chargePerUnit #energyMine actors at the target loc
          // (the spell's would-be landing point). The mines carry #aldevar so they hit the caster's enemies.
          depositMines(ca, chargeMaxOf(ca, this.entity.get(Mana)), m.x + dx, m.y + dy);
        } else if (ca && ca.type === "magic" && ca.payloadFunction.includes("takeHeal")) {
          const tgc = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
          fireBulletPayload(this.entity.id, m.x, m.y - 6, dx, dy, ca.spellSpeed / 6,
            Math.round(SPELL_FX.dmgPerUnit * (ca.chargeMaxBasic || 5)), team, ca,
            tgc?.hits ?? ["#teamMembers"], "#friendly", SPELL_FX.life);
        } else if (ca && ca.type === "magic" && !isStreaming(ca)) {
          // FAITHFUL CPU damage/status caster (energyBlast/darkBlast/cBlastAi/arcticBlast): release a real
          // objSpell (grow-fly-explode) toward the target, exactly like the player's castMagic — the
          // explosion's radial damage (and any takeFreeze) scales with the caster's CHARGE ceiling
          // (capacity·chargeMaxModifier + chargeMaxBasic via chargeMaxOf), not a fixed per-actor bolt. So a
          // high-mana / leveled caster hits harder, matching objAiCPUSpellCaster (released at full charge).
          const tgc = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
          const hits = ca.hits && ca.hits.length ? ca.hits : ["#teamMembers", "#teamBuildings"];
          const spell = spawnSpell(ca, this.entity.id, m.x, m.y - 6, team, hits, tgc?.allegiance ?? "#enemy");
          const sa = spell.get(SpellActor);
          sa.setCharge(chargeMaxOf(ca, this.entity.get(Mana)), m.x, m.y - 6); // full charge at release
          sa.release(m.x + dx, m.y + dy, Math.max(2, ca.spellSpeed / 3));
        } else {
          // bullet's collision-vector L1 (= power·speed·BULLET_DAMAGE_SCALE), with mult from the bullet's
          // damageMultiplier. archerArrow (power 0.6, mult 4) etc. The bullet's #attack is resolved once
          // at spawn (bulletAttack). When the fired bolt has NO data record (energyBlastBullet — mageOrc's
          // goblinSummon), fall back to the caster spell's power·this.strength (objBullet spawned from the
          // spell), so a record-less magic bolt still does ≈ today's damage.
          const speed = throwSpeed;                      // firingType-derived travel velocity (above)
          const dmgRef = 4.5;                            // calibrated K1 damage reference (decoupled from travel speed)
          const ba = this.bulletAttack;
          const l1 = ba ? ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE
            : this.power * dmgRef * BULLET_DAMAGE_SCALE;  // record-less bolt -> caster power (this.power)
          const bmult = ba ? ba.damageMultiplier : 1;
          // a bullet carrying a STATUS payload (iceBoulder/freezeBlast: #takeFreeze) applies it on hit, not
          // just damage — route through the payload path so applyPayload runs the bullet's payloadFunction
          // ([#takeFreeze,#takeHit]) off the same collision vector. (We do NOT reproduce objBullet.updateFly's
          // direct-takeHit + payload-takeHit double-damage bug — applyPayload runs the list once.)
          const status = ba && (ba.payloadFunction.includes("takeFreeze") || ba.payloadFunction.includes("takeHeal"));
          let pb: Entity;
          if (status && ba) {
            const alleg = ba.payloadFunction.includes("takeHeal") ? "#friendly" : "#enemy";
            const hits = ba.hits.length ? ba.hits : ["#teamMembers", "#teamBuildings"];
            pb = fireBulletPayload(this.entity.id, m.x, m.y - 6, dx, dy, speed, l1, team, ba, hits, alleg, 100);
          } else {
            pb = fireBullet(this.entity.id, m.x, m.y - 6, dx, dy, speed, l1, team, 100, 0, bmult, this.bulletChar);
          }
          if (this.bulletReincarnate.length) pb.get(Projectile).reincarnateAs = this.bulletReincarnate; // lizardEgg->#bug, ostrichEgg->#babyOstrich
        }
      }
    } else {
      // performMeleeAttack -> teamMaster.impactMeleeAttack: AREA resolution (every hostile in reach,
      // role-filtered by #hits), each via A1's aimed-vector takeHit. K1: enemy melee is now the FAITHFUL
      // power·strength·mult·ENEMY_DAMAGE_SCALE (unified with the player path — both build the vector via
      // meleeHitFn -> A1 takeHit, only the scale constant differs), damageMultiplier data-driven, inertia-
      // damped at the victim. The tuned this.power scalar is retired for melee (kept only as the
      // record-less bullet fallback above). Restores the faithful ordering blackOrc > swordOrc ≈ warrior.
      const ca = this.entity.get(WeaponManager).getCurrentAttack();
      const base = ca ? enemyMeleeBasePower(ca, this.strength) : this.power;
      const mult = ca ? ca.damageMultiplier : 1;
      game.teamMaster.impactMeleeAttack(this.entity, meleeHitFn(this.entity, this.entity.id, base, mult));
    }
    m.facingLeft = dx < 0;
    this.attackT = CpuAI.ATTACK_FRAMES; // #attack-mode window: drives modWeaponTechnique accumulation
    if (this.atkSound) game.audio?.play(this.atkSound, 0.5); // #attack.sound (quieter than player)
    wm.resetCooldown(); // restart this weapon's cooldown counter
    this.attackFin(m); // re-acquire / kite
  }

  // ── K4 bullet-dodge optimumPosition (objAiCPUSpellCaster.updateMoveToOptimumPosition) ────────────
  // A spellcaster (reach 9999, always "in reach") drives its positioning here instead of moveToAttack.
  // Strict priority chain: dodge an incoming bullet (run TANGENT to it) > flee a near enemy > approach
  // the target (with a buffer ring) > idle. Layers on the existing runReload band for plain ranged enemies.
  private updateMoveToOptimumPosition(m: Movement): void {
    const target = this.target;
    if (!target || target.send("isDead")) { this.target = null; this.goMode("findTarget", m); return; }
    // 1) runTangentToObjects(findNearestEnemyBullets, bulletSafeDistance): dodge bullets perpendicular.
    if (this.runTangentToNearestBullet(m)) return;
    // 2) runFromObjects(findNearestEnemies, enemySafeDistance): flee a near enemy (its midpoint).
    if (this.runFromNearEnemy(m, target)) return;
    // 3) runTowardsObject(target): approach if farther than √(safe²+buffer²) (hysteresis).
    const tp = target.send("getPos") as { x: number; y: number };
    const distSq = (tp.x - m.x) ** 2 + (tp.y - m.y) ** 2;
    if (distSq - CpuAI.ENEMY_SAFE * CpuAI.ENEMY_SAFE > 20 * 20) {
      this.path.findPathToLoc(m, tp.x, tp.y, game.rng);
      if (this.cooledDown() && distSq <= this.reachRanged * this.reachRanged) this.attack(m, tp.x - m.x, tp.y - m.y, target);
      return;
    }
    // 4) stopMoving — but still fire if cooled and in range (the caster shoots from its safe spot).
    this.idle(m);
    if (this.cooledDown()) this.attack(m, tp.x - m.x, tp.y - m.y, target);
  }

  // runTangentToObjects (objAiCPUSpellCaster 171-259): run perpendicular to the nearest incoming bullet,
  // blended 25-75% with the straight-flee mirror point. Returns true (running) if a bullet was too close.
  private runTangentToNearestBullet(m: Movement): boolean {
    const near = game.teamMaster.findNearestEnemyBullets(this.entity, m.x, m.y, 2);
    const closest = near.closestList[near.closestPos - 1];
    if (!closest || !closest.obj || closest.dist >= CpuAI.BULLET_SAFE) return false;
    const b1 = closest.obj.send("getPos") as { x: number; y: number };
    const second = near.closestList[near.closestPos === 1 ? 1 : 0];
    // refVect = bulletLoc - myLoc; run perpendicular (swap+negate) away to a point ~2·safe to the side,
    // with a small safe/5 along-axis nudge — the GeomTangentPoint shape. Side chosen from the 2-bullet geom.
    const refX = b1.x - m.x, refY = b1.y - m.y;
    const rl = Math.hypot(refX, refY) || 1;
    let side = 1;
    if (second && second.obj) {
      const b2 = second.obj.send("getPos") as { x: number; y: number };
      // sign of the cross product me->b1 × b1->b2 picks the side that opens away from both bullets.
      const cross = refX * (b2.y - b1.y) - refY * (b2.x - b1.x);
      side = cross >= 0 ? 1 : -1;
    }
    const perpX = (-refY / rl) * side, perpY = (refX / rl) * side;       // unit perpendicular
    const safe = CpuAI.BULLET_SAFE;
    const tangentX = m.x + perpX * 2 * safe - (refX / rl) * (safe / 5);  // 2·safe to the side, safe/5 back
    const tangentY = m.y + perpY * 2 * safe - (refY / rl) * (safe / 5);
    // straight-flee mirror point (away from the bullet) — blend 25-75% (random per call) with the tangent.
    const mirrorX = m.x - (refX / rl) * safe, mirrorY = m.y - (refY / rl) * safe;
    const t = 0.25 + game.rng.next() * 0.5;
    const destX = tangentX * t + mirrorX * (1 - t), destY = tangentY * t + mirrorY * (1 - t);
    this.path.findPathToLoc(m, destX, destY, game.rng);
    return true;
  }

  // runFromObjects(findNearestEnemies, enemySafeDistance): flee the nearest hostile if within the safe ring.
  private runFromNearEnemy(m: Movement, target: Entity): boolean {
    const tg = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
    const near = game.teamMaster.findHostileWithin(this.entity, m.x, m.y, CpuAI.ENEMY_SAFE,
      tg?.hits ?? ["#teamMembers", "#teamBuildings"], tg?.allegiance ?? "#enemy");
    if (!near.obj) return false;
    const ep = near.obj.send("getPos") as { x: number; y: number };
    const dx = m.x - ep.x, dy = m.y - ep.y; const d = Math.hypot(dx, dy) || 1;
    // GeomMirrorPoint: run to a point bulletSafe away on the far side from the enemy.
    this.path.findPathToLoc(m, m.x + (dx / d) * CpuAI.ENEMY_SAFE, m.y + (dy / d) * CpuAI.ENEMY_SAFE, game.rng);
    void target;
    return true;
  }

  // ── K5 ghost possession (objAiCPUGhost) ──────────────────────────────────────────────────────────
  // Drift aimlessly looking for a #monk to possess. findTarget → goToLoc → (on arrival) attemptPossess.
  // Where no #monk is rostered on the possess team, findUnitOfType returns null → drift to random map
  // points forever (faithful: samii places monkGhosts but 0 monks → drift-only there).
  private updateGhost(m: Movement): void {
    switch (this.ghostMode) {
      case "findTarget": this.ghostFindTarget(m); break;          // always fins → goToLoc
      case "goToLoc": {
        const arrived = this.ghostGoToLoc(m);
        if (arrived) this.ghostAttemptPossess(m);
        break;
      }
    }
  }

  private ghostFindTarget(m: Movement): void {
    const team = this.teamWhenAlive || (this.entity.send("getTeam") as string);
    const monk = game.teamMaster.findUnitOfType("#monk", team);
    if (monk) {
      this.target = monk; game.teamMaster.subscribe(monk, this.entity);
      const p = monk.send("getPos") as { x: number; y: number };
      this.ghostTargetX = p.x; this.ghostTargetY = p.y;
    } else {
      this.target = null;
      // PointRandomInRect(mapRect): a random point anywhere on the map (drift).
      const g = game.grid;
      this.ghostTargetX = game.rng.next() * g.cols * g.tilePx;
      this.ghostTargetY = game.rng.next() * g.rows * g.tilePx;
    }
    this.ghostMode = "goToLoc";
    this.path.reset();
    void m;
  }

  // goToLoc: head to the committed monk's live loc (or the random drift loc); done within possessDist.
  private ghostGoToLoc(m: Movement): boolean {
    let tx = this.ghostTargetX, ty = this.ghostTargetY;
    const t = this.target;
    if (t && !t.send("isDead")) { const p = t.send("getPos") as { x: number; y: number }; tx = p.x; ty = p.y; }
    this.path.findPathToLoc(m, tx, ty, game.rng);
    return Math.hypot(tx - m.x, ty - m.y) < CpuAI.POSSESS_DIST;
  }

  // attemptPossess: a live committed monk within 10px → mergeExperience (full imWorth+gained) + glowPink
  // + goMode(#finish) (the ghost dies). Else restart findTarget (drift).
  private ghostAttemptPossess(m: Movement): void {
    const monk = this.target;
    if (!monk || monk.send("isDead")) { this.ghostMode = "findTarget"; return; }
    const p = monk.send("getPos") as { x: number; y: number };
    if (Math.hypot(p.x - m.x, p.y - m.y) < CpuAI.POSSESS_DIST) {
      // mergeExperience(targetUnit): full experience = pExperienceImWorth + pExperienceGained, glowPink.
      const exp = this.entity.tryGet(Experience);
      const worth = (exp?.imWorth ?? 0) + (exp?.xp ?? 0);
      monk.send("gainXp", worth);
      monk.tryGet(ColourTransform)?.glowPink();
      // goMode(#finish): the ghost finalizes (dies → grave). Route through takeHit so death/leaveGame fire
      // cleanly via the combat tick (no double #leaveGame), faithful to the existing death-finalize path.
      this.entity.send("takeHit", 999999, 0, this.entity.id);
    } else {
      this.ghostMode = "findTarget";
    }
  }

  // ── K8a builder AI (objAiCPUBuilder + modBuilder) ─────────────────────────────────────────────────
  // lookForBuilding → walkToBuilding (spawn/continue the dwelling preBuilt=false) → build (accrue
  // buildRate, advance build frames) → on finish, buildOne/buildDie/leaveWhenFinished disposition.
  // Fallback: a builder with no unitToBuild (or already built its one) fights as a plain CpuAI.
  private updateBuilder(m: Movement): void {
    if (this.builderMode === "fight") { this.builderFightFallback(m); return; }
    switch (this.builderMode) {
      case "lookForBuilding": this.builderLookForBuilding(m); break;
      case "walkToBuilding": {
        const inRange = this.builderWalkToBuilding(m);
        if (inRange) this.builderMode = "build";
        break;
      }
      case "build": this.builderBuild(m); break;
    }
  }

  // startBuilding: if buildOne and we've already built one → fall back to fighting. Otherwise spawn a fresh
  // dwelling/tower preBuilt=false at loc + point(32,0) and commit to building it.
  private builderLookForBuilding(m: Movement): void {
    if (this.unitToBuild.length === 0 || (this.buildOne && this.builtCount >= 1)) {
      this.builderMode = "fight"; return;
    }
    const sym = this.unitToBuild[game.rng.range(0, this.unitToBuild.length - 1)]!; // getUnitToBuild (random)
    const spawn = game.spawnFromSymbol;
    if (!spawn) { this.builderMode = "fight"; return; }
    const b = spawn(sym, m.x + 32, m.y); // startLoc = loc + point(32,0)
    if (!b) { this.builderMode = "fight"; return; }
    if (!game.entities.includes(b)) game.entities.push(b); // join the world (RoomManager does this for tile spawns)
    // build it incrementally (objAICPUBuilder preBuilt=false): mark it "under construction" while building.
    b.flags.add("underConstruction");
    this.building = b; this.buildAmount = 0; this.buildProgress = 0;
    this.builderMode = "walkToBuilding";
    void m;
  }

  // walkToBuilding: path to the construction site; in range when within pBuildRange (50px).
  private builderWalkToBuilding(m: Movement): boolean {
    const b = this.building;
    if (!b || b.send("isDead")) { this.building = null; this.builderMode = "lookForBuilding"; return false; }
    const p = b.send("getPos") as { x: number; y: number };
    this.path.findPathToLoc(m, p.x, p.y, game.rng);
    return (p.x - m.x) ** 2 + (p.y - m.y) ** 2 <= CpuAI.BUILD_RANGE * CpuAI.BUILD_RANGE;
  }

  // updateBuild: accrue buildRate; every full 100 advances one build frame. When the building finishes,
  // apply the disposition (buildDie/leaveWhenFinished → the builder retires; buildOne → fight; else loop).
  private builderBuild(m: Movement): void {
    this.idle(m);
    const b = this.building;
    if (!b || b.send("isDead")) { this.building = null; this.builderMode = "lookForBuilding"; return; }
    this.buildAmount += this.buildRate;
    const frames = Math.floor(this.buildAmount / 100);
    this.buildAmount = this.buildAmount % 100;
    let finished = false;
    for (let i = 0; i < frames; i++) { if (this.advanceBuildFrame(b)) { finished = true; break; } }
    if (finished) this.buildingFinished(b, m);
  }

  // advanceBuildFrame (objDwelling.advanceBuildFrame): a building under construction needs BUILD_FRAMES
  // advances to finish. We track progress on the building's flag set; on the last frame mark it built.
  private static readonly BUILD_FRAMES = 8;
  private buildProgress = 0;
  private advanceBuildFrame(b: Entity): boolean {
    this.buildProgress++;
    if (this.buildProgress >= CpuAI.BUILD_FRAMES) {
      this.buildProgress = 0;
      b.flags.delete("underConstruction");   // markBuilt: it's now a live combatant/dwelling
      return true;
    }
    return false;
  }

  private buildingFinished(b: Entity, m: Movement): void {
    this.builtCount++;
    this.building = null; this.buildProgress = 0;
    if (this.buildDie || this.leaveWhenFinished) {
      // buildDie (goblinBuilder) / leaveWhenFinished (dwarf): walk to the building and retire (die).
      const p = b.send("getPos") as { x: number; y: number };
      m.x = p.x; m.y = p.y;
      this.entity.send("takeHit", 999999, 0, this.entity.id);   // finalize → grave (no #killedInAction reincarnate)
      return;
    }
    // buildOne → no more building; else look for the next site.
    this.builderMode = (this.buildOne && this.builtCount >= 1) ? "fight" : "lookForBuilding";
  }

  // builderFightFallback: a builder that can't (or shouldn't) build any more behaves as a plain CpuAI —
  // it has a natural #attack (dwarf throwAxe / goblinHammer), so run the standard committed-target loop.
  private builderFightFallback(m: Movement): void {
    switch (this.mode) {
      case "dazed": this.idle(m); break;
      case "findTarget":
        this.refreshTarget();
        if (this.target) this.goMode("moveToAttack", m); else this.idle(m);
        break;
      case "moveToAttack": this.updateMoveToAttack(m); break;
      case "runReload": this.updateRunReload(m); break;
      case "optimumPosition": this.updateMoveToOptimumPosition(m); break;
    }
  }
}

// Back-compat alias: the archetype slot was named EnemyAI; CpuAI is the objAiCPU FSM that replaces it.
export { CpuAI as EnemyAI };
