// Projectile (objBullet): flies in a straight line (Movement, ordered before this), dies on
// wall contact, lifetime expiry, or on hitting a non-friendly target. A plain bullet applies the
// single-target payload (takeHit) to the entity it collides with (B2, unchanged). A SPLASH bullet
// (#type:#explode or #splashDamageOn) instead, on its trigger event (collide/land/expire), runs the
// SplashDamage resolver — radius damage hitting ALL hostiles in the disc through the same A1 vector
// scale, with the full (possibly-list) payloadFunction. Pooled (reset()) since bullets churn heavily.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";
import { aimedVect } from "../engine/math";
import type { AttackData } from "./weapon";
import { resolveSplash, applyPayload } from "./splash";
import { spawnFromSymbol } from "../entities/actorSerial";

export class Projectile extends Component {
  static handles = ["update", "isFinished", "getTeam"];
  life = 0; maxLife = 100; power = 10; team = ""; ownerId = -1; done = false; freeze = 0; mult = 1;
  char = ""; // objBullet sprite char (archerArrow/gobarrow/axe/crossBolt…) -> the `<char>_fly` strip, rotated to flight
  // #friction (objMoveXY): percent of speed lost each frame (exponential decay). When speed falls below
  // STALL_SPEED for STALL_FRAMES, the bullet has come to a natural halt — splash detonates / plain lands.
  friction = 0;
  exploding = false;        // modExploder.goMode(#explode): playing the <char>_explode burst strip in place before retiring
  private stallCtr = 0;
  private static readonly STALL_SPEED = 0.2;  // pStallSpeed
  private static readonly STALL_FRAMES = 10;  // pStallCount.tim = [1,10]
  // splash payload (C2): when set, the bullet resolves an area hit on trigger instead of single-target.
  private splash: AttackData | null = null;
  private splashHits: string[] = ["#teamMembers", "#teamBuildings"];
  private splashAllegiance = "#enemy";
  // single-target payload (C2): a player spell bolt (arctic/heal) carries its spell #attack so its hit
  // runs the full (possibly-list) payloadFunction (takeFreeze/takeHeal/takeHit) off the bolt's vector.
  private payload: AttackData | null = null;
  // I8 beam (objBullet.setBeam / performBeamAttack): a non-travelling bullet spawned AT the target loc,
  // its sprite stretched to the caster->target distance + rotated, detonating its explode #attack on the
  // first frame. beamDist/beamAngle/beamCasterX/Y drive the renderer's stretched-line draw.
  beam = false; beamDist = 0; beamAngle = 0; beamCasterX = 0; beamCasterY = 0; beamLife = 0;
  // bullet #reincarnateAs (objBullet.reincarnate): on death the bullet spawns these actors at its corpse
  // loc — flamingRock -> #fire (a lingering fire mine), lizardEgg -> #bug, ostrichEgg -> #babyOstrich (eggs
  // HATCH into creatures). Empty for ordinary bolts. Each child uses its OWN act-data (team/objType).
  reincarnateAs: string[] = [];

  configure(power: number, team: string, ownerId: number, maxLife = 100, freeze = 0, mult = 1): void {
    this.life = 0; this.power = power; this.team = team; this.ownerId = ownerId;
    this.maxLife = maxLife; this.freeze = freeze; this.mult = mult; this.done = false;
    this.splash = null; this.payload = null; this.friction = 0; this.stallCtr = 0;
  }
  // configurePayload: a single-target bolt whose hit runs the spell's payloadFunction list. `power` is
  // the L1 magnitude carried as the collision vector (the tuned spell damage). Heal bolts pass a friendly
  // team so they only "hit" friendlies; the payload (#takeHeal) heals them.
  configurePayload(power: number, team: string, ownerId: number, attack: AttackData, hits: string[], allegiance: string, maxLife = 100): void {
    this.life = 0; this.power = power; this.team = team; this.ownerId = ownerId; this.maxLife = maxLife;
    this.done = false; this.splash = null; this.payload = attack;
    this.splashHits = hits; this.splashAllegiance = allegiance;
    this.friction = attack.friction; this.stallCtr = 0;
  }
  // configureSplash: this bullet carries a splash/explode attack (towerAxe/energyPulse/thunder/freeze).
  // It still flies as a straight bullet; on trigger it resolves the area hit via SplashDamage.
  configureSplash(attack: AttackData, team: string, ownerId: number, maxLife = 100, hits?: string[], allegiance = "#enemy"): void {
    this.life = 0; this.team = team; this.ownerId = ownerId; this.maxLife = maxLife; this.done = false;
    this.splash = attack; this.splashHits = hits ?? attack.hits; this.splashAllegiance = allegiance;
    this.friction = attack.friction; this.stallCtr = 0;
  }
  // configureBeam: an energyBeam shot — spawned at the target loc, stretched/rotated, detonates its
  // explode #attack on the first frame (a one-frame beam line from caster to target).
  configureBeam(attack: AttackData, team: string, ownerId: number, hits: string[], allegiance: string,
    dist: number, angle: number, casterX: number, casterY: number): void {
    this.life = 0; this.team = team; this.ownerId = ownerId; this.maxLife = 8; this.done = false;
    this.splash = attack; this.splashHits = hits; this.splashAllegiance = allegiance; this.payload = null;
    this.beam = true; this.beamDist = dist; this.beamAngle = angle; this.beamCasterX = casterX; this.beamCasterY = casterY;
    this.beamLife = 4; // a few frames so the line is visible before it sweeps out
  }
  override reset(): void { this.done = false; this.life = 0; this.ownerId = -1; this.freeze = 0; this.mult = 1; this.splash = null; this.payload = null; this.beam = false; this.reincarnateAs = []; this.char = ""; this.friction = 0; this.stallCtr = 0; this.exploding = false; }
  isFinished(): boolean { return this.done; }
  // a splash/beam bullet IS the attacker passed to resolveSplash; expose its owner team so the area
  // search resolves the right hostile teams (calcTargetTeams reads attacker.getTeam). objBullet.setTeam.
  getTeam(_next: NextFn): string { return this.team; }

  private detonate(x: number, y: number): void {
    const a = this.splash!;
    resolveSplash(this.entity, a, x, y, this.ownerId, this.splashHits, this.splashAllegiance);
    if (a.attackType === "#explode" && a.explodeSound && a.explodeSound !== "#none") game.audio?.play(a.explodeSound, 0.5);
    // modExploder.goMode(#explode): play the <char>_explode burst strip in place before retiring. A bullet
    // whose char ships no explode strip (towerAxe/needle splash) retires immediately, as before.
    const strip = this.char ? game.assets.index.anims[`${this.char}_explode`] : undefined;
    if (strip && strip.frames.length > 0) {
      this.exploding = true; this.life = 0;
      const m = this.entity.get(Movement); m.vx = 0; m.vy = 0; m.x = x; m.y = y;
    } else {
      this.finish(x, y);
    }
  }

  // finish: the single death choke-point — latch `done` (idempotent so a bullet can't finalize twice) and
  // spawn any #reincarnateAs children at the corpse loc (objBullet.reincarnate: fire mine / hatched egg). A
  // direct target hit passes reincarnate=false (modExploder routes #bulletCollidedWithTarget to die(), not
  // #land) — only a land-stall / explode hatches.
  private finish(x: number, y: number, reincarnate = true): void {
    if (this.done) return;
    this.done = true;
    if (!reincarnate) return;
    for (let i = 0; i < this.reincarnateAs.length; i++) {
      const typ = this.reincarnateAs[i]!;
      if (!typ || typ === "none") continue;
      const child = spawnFromSymbol(typ, x, y);
      if (child) game.entities.push(child);
    }
  }

  // a heal-payload bolt targets FRIENDLIES (same team), every other bolt targets non-team hostiles.
  private heals(): boolean { return this.payload !== null && this.splashAllegiance === "#friendly"; }
  private isTarget(e: import("../engine/dispatch").Entity): boolean {
    const sameTeam = e.send("getTeam") === this.team;
    return this.heals() ? sameTeam : !sameTeam;
  }

  update(next: NextFn): void {
    const m = this.entity.get(Movement);
    // I8 beam: detonate the explode #attack at the target on the FIRST frame (#bulletArrivedAtTargetLoc),
    // then linger a few frames so the stretched line renders before the bullet retires.
    if (this.beam) {
      if (this.life === 0) {
        resolveSplash(this.entity, this.splash!, m.x, m.y, this.ownerId, this.splashHits, this.splashAllegiance);
        game.audio?.play("spell_release", 0.4);
      }
      if (++this.life >= this.beamLife) this.done = true;
      return next();
    }
    // modExploder.goMode(#explode): a detonated splash bullet plays its <char>_explode burst strip IN PLACE
    // (no movement, no further collision), then retires + spawns its #reincarnateAs (flamingRock -> fire).
    if (this.exploding) {
      const strip = game.assets.index.anims[`${this.char}_explode`];
      const total = strip ? strip.frames.reduce((s, f) => s + Math.max(1, f.dela ?? strip.delay ?? 1), 0) : 6;
      if (++this.life >= total) this.finish(m.x, m.y);
      return next();
    }
    // objBullet does NOT collide with terrain (passThrough) — a bullet flies through walls and dies on a
    // target hit, when it STALLS (friction decay below pStallSpeed), or when its maxLife backstop expires.
    if (++this.life > this.maxLife) { if (this.splash) this.detonate(m.x, m.y); else this.finish(m.x, m.y); return next(); }
    // objMoveXY friction: lose `friction`% of the speed each frame (exponential decay, scaled by gGameSpeed),
    // and when the bullet slows below pStallSpeed for STALL_FRAMES it has come to a natural halt — a splash
    // bullet detonates where it landed (bomb/rock lob), a plain bullet lands. Beams (friction 0) never decay.
    if (this.friction > 0) {
      const speed = Math.abs(m.vx) + Math.abs(m.vy);
      if (speed <= Projectile.STALL_SPEED) {
        if (++this.stallCtr >= Projectile.STALL_FRAMES) {
          if (this.splash) this.detonate(m.x, m.y); else this.finish(m.x, m.y);
          return next();
        }
      } else {
        this.stallCtr = 0;
        const factor = Math.max(0, 1 - (this.friction / 100) * game.gameSpeed); // VarValRange: friction% of speed
        m.vx *= factor; m.vy *= factor;
      }
    }
    for (const e of game.entities) {
      if (e.id === this.ownerId || (e.type !== "player" && e.type !== "enemy" && e.type !== "ally")) continue;
      if (e.send("isDead") || !this.isTarget(e)) continue;
      const p = e.send("getPos") as { x: number; y: number };
      if (Math.abs(p.x - m.x) < 12 && Math.abs(p.y - m.y) < 12) {
        if (this.splash) { this.detonate(m.x, m.y); break; } // explode/splash on collide -> hit the disc
        const v = aimedVect(m.vx, m.vy, this.power);
        if (this.payload) {
          // a payload bolt (arctic/heal): run the full (possibly-list) payloadFunction off this vector.
          applyPayload(this.payload.payloadFunction, e, v.x, v.y, this.payload, this.ownerId);
        } else {
          // plain bullet (B2, unchanged): collisionVect = velocity carrying L1 magnitude `power`; damage
          // = (|vx|+|vy|)*mult, knockback along travel (modEnergy/objGameObject via takeHit chain).
          e.send("takeHit", v.x, v.y, this.ownerId, this.mult);
          if (this.freeze > 0) e.send("takeFreeze", this.freeze, 0, this.ownerId, 1, false); // legacy scalar path
        }
        this.finish(m.x, m.y, false); // modExploder #bulletCollidedWithTarget -> die() in #fly: a DIRECT hit
        break;                        // does NOT reincarnate (only a land-stall hatches ostrichEgg/lizardEgg)
      }
    }
    next();
  }
}
