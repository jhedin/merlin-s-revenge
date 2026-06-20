// Control components set Movement intent each tick (run before Movement in the chain).
// PlayerControl reads input, auto-aims/melees through teamMaster, and fires projectiles; CpuAI
// (objAiCPU) is a committed-target FSM (findTarget/moveToAttack/runReload/dazed) that hunts via
// teamMaster.findTarget and resolves melee through teamMaster.impactMeleeAttack.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { Mana } from "./mana";
import { game } from "../game/context";
import { fireBullet, fireSplashBullet, fireBulletPayload, performBeamAttack } from "../systems/bullets";
import { registry } from "../game/data";
import { meleeHitFn } from "../systems/teams";
import { Targeting } from "./combat";
import { WeaponManager, meleeBasePower, resolveAttack, type AttackData } from "./weapon";
import { summonUnit } from "./summon";
import { chargeMaxOf, chargeStartOf, chargeSpeedOf } from "./charge";
import type { Entity } from "../engine/dispatch";

// Damage/bolt-speed are still tuned per charge-unit to the px slice (PLAN_REVIEW: damage == knockback;
// full base charge ~12.5 fells a rank-and-file 300-energy enemy). The CHARGE math (chargeMax/Start/Speed)
// now flows from the magic weapon's #attack × Mana via charge.ts instead of an inline SPELL constant.
const SPELL_FX = { dmgPerUnit: 26, speedBase: 4.5, speedPerUnit: 0.28, speedCap: 9, releaseFrames: 6, life: 110 };
const MELEE_FRAMES = 6; // the melee anim-strip window (presentational)
const bare = (s: string): string => (s.startsWith("#") ? s.slice(1) : s); // #energyBeam -> energyBeam (resolveActor key)

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

  override init(cfg: Record<string, any>): void {
    this.strength = typeof cfg["strength"] === "number" ? cfg["strength"] : 8;
    this.strengthInc = typeof cfg["strengthIncLevel"] === "number" ? cfg["strengthIncLevel"] : 0.1;
    this.charge = 0; this.charging = false; this.releaseT = this.meleeT = 0; this.usingSword = false;
    this.gmgCollected_ = false; this.gmgOn = false; this.stream = null;
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
    if (this.entity.send("isDead")) { const m = this.entity.get(Movement); m.intentX = m.intentY = 0; return next(); }

    const input = game.input;
    const m = this.entity.get(Movement);
    const mv = input.moveVector();
    m.intentX = mv.x; m.intentY = mv.y;

    // G key (objAiPlayer.interpretGameKeys -> setGmg): toggle the Golden Machine Gun on/off (edge).
    if (input.pressed("g")) this.setGmg();

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
    const primary = input.mouseDown() || input.held(" ");
    const gmg = this.gmgOn;

    // hold-to-charge magic — only once Merlin owns a magic weapon. No pool gate; the recast gate is the
    // magic weapon's own cooldown counter (getCooldownFin), reset on FIRE.
    const magicReady = magic ? wm.cooldownFinFor(magic.name) : false;
    if (magic && primary && magicReady) {
      if (!this.charging) { this.charge = chargeStartOf(magic, mana, gmg); game.audio?.play("spell_charge"); }
      this.charging = true;
      m.facingLeft = this.aimLeft;
      const cm = chargeMaxOf(magic, mana, undefined, gmg);
      this.charge = Math.min(cm, this.charge + chargeSpeedOf(magic, mana, gmg));
      // I7 auto-fire (objAiPlayer.internalEvent #spellCharged): under GMG with gmgAutoFire, the instant
      // the charge reaches max, release the spell and immediately re-charge (continuous machine-gun fire).
      if (gmg && magic.gmgAutoFire && this.charge >= cm) {
        this.castMagic(magic, m, aim, wm);              // playerAttackRelease
        this.charge = chargeStartOf(magic, mana, gmg);  // playerAttackCharge (re-charge from gmgChargeStart)
      }
    } else if (this.charging) {
      if (magic) this.castMagic(magic, m, aim, wm); // released or cooled down -> fire at whatever charge was held
      this.charging = false; this.charge = 0;
    } else if (melee) {
      this.tryMelee(melee, m, wm); // not casting -> auto-swing the melee weapon at anything in reach
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

  private castMagic(attack: AttackData, m: Movement, aim: { x: number; y: number }, wm: WeaponManager): void {
    const c = this.charge; // already >= chargeStart
    const team = this.entity.send("getTeam") as string;

    // I8 streaming release (modFireBullets #spellReleased): a releaseFunction:#fireBullets spell does NOT
    // fire one bolt — it starts a bullet stream draining chargePerUnit per shot over fireDelay frames.
    // Under GMG, ensureSpell forces fireDelay=0 -> the stream empties in one tick.
    if (attack.releaseFunction === "#fireBullets" || attack.releaseFunction === "fireBullets") {
      const delay = this.gmgOn ? 0 : Math.round(attack.fireDelay);
      this.stream = { attack, charge: c, delay, counter: 0, aimX: aim.x, aimY: aim.y, team };
      m.facingLeft = this.aimLeft;
      wm.resetCooldownFor(attack.name);
      this.releaseT = SPELL_FX.releaseFrames;
      return;
    }

    const dmg = Math.round(SPELL_FX.dmgPerUnit * c);
    const speed = Math.min(SPELL_FX.speedCap, SPELL_FX.speedBase + c * SPELL_FX.speedPerUnit);
    const dirX = aim.x - m.x, dirY = (aim.y - 6) - m.y;

    // SUMMON spell (armySummon/monsterSummon): release summons the highest affordable tier at the cast
    // loc (modSpellMultistage), then the bolt still fires (faithful — selectPayload keeps payload non-blank).
    if (attack.explodeFunction === "#summonUnit" || attack.explodeFunction === "summonUnit") {
      summonUnit(attack, c, m.x, m.y, this.entity.id);
    }

    // The bolt: arctic/freeze/heal carry a payload list (takeFreeze/takeHeal/takeHit) resolved on hit;
    // a heal bolt targets friendlies. Plain blasts (energyBlast/cBlast/darkBlast) keep the tuned takeHit.
    const payloadList = attack.payloadFunction;
    const isHeal = payloadList.includes("takeHeal");
    const isStatus = isHeal || payloadList.includes("takeFreeze");
    if (isStatus) {
      const allegiance = isHeal ? "#friendly" : "#enemy";
      const hits = attack.hits.length ? attack.hits : ["#teamMembers", "#teamBuildings"];
      fireBulletPayload(this.entity.id, m.x, m.y - 6, dirX, dirY, isHeal ? attack.spellSpeed / 6 : speed,
        dmg, team, attack, hits, allegiance, SPELL_FX.life);
    } else {
      fireBullet(this.entity.id, m.x, m.y - 6, dirX, dirY, speed, dmg, team, SPELL_FX.life);
    }
    m.facingLeft = this.aimLeft;
    wm.resetCooldownFor(attack.name); // recast gate = the magic weapon's cooldown counter (cd/manaRegeneration)
    this.releaseT = SPELL_FX.releaseFrames;
    game.audio?.play(isHeal ? "heal_spell_release" : "spell_release"); // act #releaseSound
  }

  private tryMelee(attack: AttackData, m: Movement, wm: WeaponManager): void {
    if (!wm.cooldownFinFor(attack.name)) return;                 // per-weapon cooldown counter gate
    const target = game.teamMaster.findTarget(this.entity).obj;
    if (!target) return;
    const p = target.send("getPos") as { x: number; y: number };
    if (Math.hypot(p.x - m.x, p.y - m.y) > attack.reach) return; // swing only when something's in reach
    m.facingLeft = p.x < m.x;
    // performMeleeAttack -> teamMaster.impactMeleeAttack: area resolution. A swing knocks back EVERY
    // hostile (role #hits) within reach, each via A1's aimed-vector takeHit. Damage = power·strength·SCALE
    // carried as the vector L1, times damageMultiplier as `mult` (now data-driven from the weapon).
    const base = meleeBasePower(attack, this.strength);
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
    return Math.min(1, this.charge / chargeMaxOf(magic, this.entity.get(Mana)));
  }
}

// CpuAI (objAiCPU): the committed-target decision FSM. A referenced controller (objAiGameObject.pAI)
// whose update() drives modes findTarget -> moveToAttack -> attack -> attackFin, with runReload (kite)
// and dazed (reel/recoil/die). The single best target is acquired ONCE via teamMaster.findTarget,
// COMMITTED as a #target relationship (teamMaster.subscribe), dropped reactively on #leaveGame, and
// only re-evaluated on a 30-frame throttle or after an attack — not re-scanned every tick (the cardinal
// behaviour change vs the old per-tick nearest scan). Allegiance/criteria/roles flow from Targeting.
type CpuMode = "findTarget" | "moveToAttack" | "runReload" | "dazed";

export class CpuAI extends Component {
  static handles = ["update", "eventLeaveGame", "characterModeChanged", "getAiMode", "getAiTarget",
    "getTargetDetails", "setAiTarget"];
  reach = 22;          // melee strike reach (targetInReachMelee)
  reachRanged = 150;   // ranged targetInReachRanged (GeomDist < reach)
  power = 8;           // melee-vector strength source (strength); bullet damage uses weapon power
  ranged = false;
  runReload = false;   // getRunReload: kite away after a shot until cooled (ranged casters)
  atkSound = "";       // #attack.sound
  ghost = false;       // objAiCPUGhost approximation (drift; not a real possessor — out of scope)
  splashBullet: AttackData | null = null; // towerAxe/energyPulse etc: fire a SPLASH bullet, not single-target
  private strength = 5;

  private mode: CpuMode = "findTarget";
  private target: Entity | null = null;
  private retargetCtr = 0;                  // pRetargetCounter: forced re-eval every 30 frames
  private static readonly RETARGET = 30;
  private wanderAng = 0; private wanderTimer = 0;
  private detourT = 0; private detourX = 0; private detourY = 0; // wall-detour (pathfinding fallback)

  override init(cfg: Record<string, any>): void {
    this.strength = typeof cfg["strength"] === "number" ? cfg["strength"] : 5;
    const strPow = this.strength / 3;
    const atkPow = typeof cfg["atkPower"] === "number" ? cfg["atkPower"] : 0;
    this.power = Math.max(4, Math.round(strPow + atkPow));
    this.ranged = cfg["ranged"] === true;
    this.runReload = cfg["runReload"] === true; // spellcaster kite
    this.ghost = cfg["ghost"] === true;
    if (typeof cfg["atkReach"] === "number") {
      if (this.ranged) this.reachRanged = Math.min(220, Math.max(60, cfg["atkReach"])); // cap magic's 9999
      else this.reach = Math.max(16, Math.min(40, cfg["atkReach"]));
    }
    this.atkSound = typeof cfg["atkSound"] === "string" ? cfg["atkSound"] : "";
    this.splashBullet = (cfg["splashBullet"] as AttackData | undefined) ?? null; // a ranged CPU's splash bullet (tower)
    this.retargetCtr = 0;
    this.mode = "findTarget"; this.target = null;
    this.wanderAng = 0; this.wanderTimer = 0; this.detourT = 0;
  }
  override reset(): void { this.mode = "findTarget"; this.target = null; this.retargetCtr = 0; }

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
    if (this.entity.send("isDead")) { this.idle(m); return next(); }
    switch (this.mode) {
      case "dazed": this.idle(m); break;                       // frozen while reeling/dying
      case "findTarget":
        this.refreshTarget();
        if (this.target) this.goMode("moveToAttack", m); else this.idle(m);
        break;
      case "moveToAttack": this.updateMoveToAttack(m); break;
      case "runReload": this.updateRunReload(m); break;
    }
    next();
  }

  private goMode(mode: CpuMode, m: Movement): void {
    this.mode = mode;
    if (mode === "moveToAttack") this.retargetCtr = 0; // CounterReset(pRetargetCounter)
    if (mode === "dazed" || mode === "findTarget") this.idle(m);
  }

  // updateMoveToAttack (objAiAttack): tick the retarget throttle, drop dead/gone targets, attack in
  // reach, else seek toward the ideal attack loc. Ghosts keep the drift approximation (possession is
  // out of scope), still committing a target so they don't twitch.
  private updateMoveToAttack(m: Movement): void {
    if (++this.retargetCtr >= CpuAI.RETARGET) {       // pRetargetCounter: periodic forced re-eval
      this.retargetCtr = 0; this.target = null; this.refreshTarget();
    }
    const target = this.target;
    if (!target || target.send("isDead")) { this.target = null; this.goMode("findTarget", m); return; }
    const tp = target.send("getPos") as { x: number; y: number };
    const dx = tp.x - m.x, dy = tp.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.ghost) { this.wander(m, dx, dy, d); if (d < this.reach + 6) this.attack(m, dx, dy, target); return; }
    if (this.targetInReach(d)) { this.idle(m); this.attack(m, dx, dy, target); }
    else this.seek(m, dx, dy, d);
  }

  private targetInReach(d: number): boolean { return d <= (this.ranged ? this.reachRanged : this.reach); }

  // updateRunReload (kite): back away from the target until the shot has cooled, then re-engage.
  private updateRunReload(m: Movement): void {
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

  // attackFin: after a strike, clear + re-acquire, then runReload (kite) / moveToAttack / findTarget.
  private attackFin(m: Movement): void {
    this.target = null; this.refreshTarget();
    if (!this.target) this.goMode("findTarget", m);
    else if (this.runReload) this.goMode("runReload", m);
    else this.goMode("moveToAttack", m);
  }

  private idle(m: Movement): void { m.intentX = 0; m.intentY = 0; }

  private attack(m: Movement, dx: number, dy: number, target: Entity): void {
    const wm = this.entity.get(WeaponManager);
    if (!wm.getCooldownFin()) return;
    if (this.ranged) {
      const team = this.entity.send("getTeam") as string;
      if (this.splashBullet) {
        // a static turret (dwarfTower) / splash caster fires its real splash bullet (towerAxe): on
        // land/collide it resolves an AREA hit through SplashDamage (same A1 vector scale).
        const tg = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
        fireSplashBullet(this.entity.id, m.x, m.y - 6, dx, dy, 5, this.splashBullet, team,
          this.splashBullet.hits, tg?.allegiance ?? "#enemy", 140);
      } else {
        // J1: a magic-weapon CPU caster routes by its #attack payload, like the player's castMagic —
        // a summoner spawns a unit, a healer fires a heal bolt at its (friendly) target — instead of
        // every caster firing a generic damage bolt. Plain bolt-casters (energyBlast/dark/arctic) unchanged.
        const ca = this.entity.get(WeaponManager).getCurrentAttack();
        if (ca && ca.type === "magic" && (ca.explodeFunction === "#summonUnit" || ca.explodeFunction === "summonUnit")) {
          // summon the multistage tier the caster's mana affords (chargeMaxOf = its real charge ceiling)
          const sc = chargeMaxOf(ca, this.entity.get(Mana));
          summonUnit(ca, sc, m.x, m.y, this.entity.id); // summon at the caster's loc
        } else if (ca && ca.type === "magic" && ca.payloadFunction.includes("takeHeal")) {
          const tgc = this.entity.send("getTargeting") as { hits: string[]; allegiance: string } | undefined;
          fireBulletPayload(this.entity.id, m.x, m.y - 6, dx, dy, ca.spellSpeed / 6,
            Math.round(SPELL_FX.dmgPerUnit * (ca.chargeMaxBasic || 5)), team, ca,
            tgc?.hits ?? ["#teamMembers"], "#friendly", SPELL_FX.life);
        } else {
          fireBullet(this.entity.id, m.x, m.y - 6, dx, dy, 4.5, this.power * 2, team);
        }
      }
    } else {
      // performMeleeAttack -> teamMaster.impactMeleeAttack: AREA resolution (every hostile in reach,
      // role-filtered by #hits), each via A1's aimed-vector takeHit. NO-REGRESSION CHOICE (B2 §f.1):
      // enemy melee keeps the slice's tuned scalar damage (this.power, mult 1) — the enemy #attack
      // powers are calibrated for the engine's native units, so routing them through power·strength·mult
      // (as the player does) would inflate enemy lethality 5–25× and break room-1. The faithful
      // damageMultiplier-from-data win applies to the PLAYER's weapons (where it's calibrated/tested);
      // a holistic enemy power-rescale is deferred with the inertia-damage coupling (C-phase).
      game.teamMaster.impactMeleeAttack(this.entity, meleeHitFn(this.entity, this.entity.id, this.power));
    }
    m.facingLeft = dx < 0;
    if (this.atkSound) game.audio?.play(this.atkSound, 0.5); // #attack.sound (quieter than player)
    wm.resetCooldown(); // restart this weapon's cooldown counter
    this.attackFin(m); // re-acquire / kite
  }

  // Head toward (dx,dy) but, when wedged on a wall (modPathFinding: beeline -> scenic), commit to
  // a perpendicular detour for a short window so the unit slides around obstacles instead of stalling.
  private seek(m: Movement, dx: number, dy: number, d: number): void {
    if (this.detourT > 0) { this.detourT--; m.intentX = this.detourX; m.intentY = this.detourY; return; }
    if (m.hitX || m.hitY) { // blocked last tick -> sidestep perpendicular to the desired heading
      const sign = game.rng.next() < 0.5 ? 1 : -1;
      this.detourX = (-dy / d) * sign; this.detourY = (dx / d) * sign;
      this.detourT = 18;
      m.intentX = this.detourX; m.intentY = this.detourY;
    } else { m.intentX = dx / d; m.intentY = dy / d; }
  }

  // objAiCPUGhost approximation: drift on a slowly-changing heading biased toward the target.
  private wander(m: Movement, dx: number, dy: number, d: number): void {
    if (--this.wanderTimer <= 0) { this.wanderAng = game.rng.next() * Math.PI * 2; this.wanderTimer = 40 + Math.floor(game.rng.next() * 40); }
    m.intentX = Math.cos(this.wanderAng) * 0.7 + (dx / d) * 0.3;
    m.intentY = Math.sin(this.wanderAng) * 0.7 + (dy / d) * 0.3;
  }
}

// Back-compat alias: the archetype slot was named EnemyAI; CpuAI is the objAiCPU FSM that replaces it.
export { CpuAI as EnemyAI };
