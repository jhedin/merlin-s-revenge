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

export class Projectile extends Component {
  static handles = ["update", "isFinished", "getTeam"];
  life = 0; maxLife = 100; power = 10; team = ""; ownerId = -1; done = false; freeze = 0; mult = 1;
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

  configure(power: number, team: string, ownerId: number, maxLife = 100, freeze = 0, mult = 1): void {
    this.life = 0; this.power = power; this.team = team; this.ownerId = ownerId;
    this.maxLife = maxLife; this.freeze = freeze; this.mult = mult; this.done = false;
    this.splash = null; this.payload = null;
  }
  // configurePayload: a single-target bolt whose hit runs the spell's payloadFunction list. `power` is
  // the L1 magnitude carried as the collision vector (the tuned spell damage). Heal bolts pass a friendly
  // team so they only "hit" friendlies; the payload (#takeHeal) heals them.
  configurePayload(power: number, team: string, ownerId: number, attack: AttackData, hits: string[], allegiance: string, maxLife = 100): void {
    this.life = 0; this.power = power; this.team = team; this.ownerId = ownerId; this.maxLife = maxLife;
    this.done = false; this.splash = null; this.payload = attack;
    this.splashHits = hits; this.splashAllegiance = allegiance;
  }
  // configureSplash: this bullet carries a splash/explode attack (towerAxe/energyPulse/thunder/freeze).
  // It still flies as a straight bullet; on trigger it resolves the area hit via SplashDamage.
  configureSplash(attack: AttackData, team: string, ownerId: number, maxLife = 100, hits?: string[], allegiance = "#enemy"): void {
    this.life = 0; this.team = team; this.ownerId = ownerId; this.maxLife = maxLife; this.done = false;
    this.splash = attack; this.splashHits = hits ?? attack.hits; this.splashAllegiance = allegiance;
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
  override reset(): void { this.done = false; this.life = 0; this.ownerId = -1; this.freeze = 0; this.mult = 1; this.splash = null; this.payload = null; this.beam = false; }
  isFinished(): boolean { return this.done; }
  // a splash/beam bullet IS the attacker passed to resolveSplash; expose its owner team so the area
  // search resolves the right hostile teams (calcTargetTeams reads attacker.getTeam). objBullet.setTeam.
  getTeam(_next: NextFn): string { return this.team; }

  private detonate(x: number, y: number): void {
    const a = this.splash!;
    resolveSplash(this.entity, a, x, y, this.ownerId, this.splashHits, this.splashAllegiance);
    if (a.attackType === "#explode") game.audio?.play("spell_explode", 0.5);
    this.done = true;
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
    if (m.hitX || m.hitY) { if (this.splash) this.detonate(m.x, m.y); else this.done = true; return next(); } // wall / land
    if (++this.life > this.maxLife) { if (this.splash) this.detonate(m.x, m.y); else this.done = true; return next(); }
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
        this.done = true;
        break;
      }
    }
    next();
  }
}
