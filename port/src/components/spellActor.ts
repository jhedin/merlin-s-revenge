// SpellActor (objSpell, K2): the charged spell is a LIVE actor, not a number on the caster. It grows over
// the caster's head while charging, FLIES to the aim point on release, and EXPLODES radially on arrival —
// the faithful #releaseFunction:#release lifecycle (the default for energyBlast/cBlast/darkBlast/
// arcticBlast/healBlast and the summons). Streaming spells (#fireBullets: energyPulse/beam) keep the I8
// stream path; this actor owns the grow-fly-explode spells.
//
// Faithful chain (objSpell.txt):
//   charge(amount, chargeLoc) (114-121): pCurrentCharge = amount; align(chargeLoc) (over the head via
//     calcChargeOffset #top = point(0,-size/2)); size = pCurrentCharge·chargeSize (calcSize 110-112).
//   release(targetLoc, speed) (228-233) -> releaseNormal (235-248): moveToTarget(targetLoc, speed) — FLIES.
//   moveXYfin (214-217): on arrival -> goMode(#explode).
//   goMode(#explode) (145-161): pCurrentCharge ·= chargeExplodeFactor; startQuickFade;
//     teamMaster.impactAttack(me) — the RADIAL calcCollisionVectSpell area hit at the landing loc; then the
//     #explode internalEvent runs doExplodeFunction (#summonUnit -> summonPayload at the landing loc).
//
// The radial damage reuses C2's resolveSplash (#explode shape (hitRange−dist)·power) with the GROWN charge
// as the radius source (explodeCharge = charge·chargeExplodeFactor) — the K1-deferred spell coupling. A
// single SPELL_RADIAL_SCALE (analogous to MELEE_SCALE) pins the px-scale centre lethality so a base-charge
// energyBlast still fells a rank-and-file enemy (the invariant K1 carried on the scalar to re-pin here).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";
import { Movement } from "./movement";
import { resolveSplash } from "./splash";
import { summonUnit, depositMines } from "./summon";
import type { AttackData } from "./weapon";

// px-scale calibration: the radial centre magnitude (charge·chargeExplodeFactor/2 + TARGET_RADIUS)·power is
// in the engine's native (9999) units; this scale lifts it to the port's damage scale so a full base-charge
// (12.5) energyBlast centre hit ≈ the old dmgPerUnit·12.5 ≈ 325 band (fells a 300-energy enemy). Pinned by
// the spell-lethality test. (energyBlast: power 0.75, chargeExplodeFactor 4 -> (2·12.5+12)·0.75·SCALE.)
export const SPELL_RADIAL_SCALE = 11.7;

export class SpellActor extends Component {
  static handles = ["update", "getTeam", "getActorType", "isFinished", "isDead"];

  attack!: AttackData;
  charge = 0;             // pCurrentCharge
  ownerId = -1;
  team = "";
  hits: string[] = [];
  allegiance = "#enemy";
  offsetSide: "#top" | "#side" = "#top";
  aimDir = 1;             // facing for a #side offset
  private mode: "charge" | "fly" | "explode" = "charge";
  private targetX = 0; private targetY = 0; private speed = 0;
  private flyDirX = 0; private flyDirY = 0; private flyTtl = 0;
  private done = false;

  override reset(): void {
    this.charge = 0; this.ownerId = -1; this.team = ""; this.hits = []; this.allegiance = "#enemy";
    this.offsetSide = "#top"; this.aimDir = 1; this.mode = "charge"; this.done = false;
    this.targetX = this.targetY = this.speed = 0; this.flyDirX = this.flyDirY = this.flyTtl = 0;
  }

  getTeam(): string { return this.team; }
  getActorType(): string { return "spell"; }     // a spell has no actor record; never snapshotted/respawned
  isFinished(): boolean { return this.done; }     // swept back to the pool when finished
  isDead(): boolean { return this.done; }

  // setup (objSpell.setSpellProperties + the charge-counter seed): arm a fresh charge-mode spell.
  configure(attack: AttackData, ownerId: number, team: string, hits: string[], allegiance: string): void {
    this.attack = attack; this.ownerId = ownerId; this.team = team;
    this.hits = hits.length ? hits : ["#teamMembers", "#teamBuildings"];
    this.allegiance = allegiance; this.offsetSide = "#top"; this.mode = "charge"; this.done = false;
  }

  // charge(amount, casterX, casterY) (objSpell.charge): set the live charge and re-align the orb over the
  // caster's head (calcChargeOffset #top = point(0, −size/2); #side = ±size/2 by facing).
  setCharge(amount: number, casterX: number, casterY: number): void {
    this.charge = amount;
    const half = this.size() / 2;
    const m = this.entity.get(Movement);
    if (this.offsetSide === "#side") { m.x = casterX + half * this.aimDir; m.y = casterY; }
    else { m.x = casterX; m.y = casterY - half; }     // #top: rise over the head as it grows
    m.vx = m.vy = 0;
  }

  size(): number { return this.charge * this.attack.chargeSize; } // calcSize

  // discard: drop a charging spell without releasing it (caster lost the weapon / interrupted) — finish so
  // it's swept back to the pool, no explode.
  discard(): void { this.done = true; }

  // release(targetX, targetY, speed) (objSpell.release -> releaseNormal): fly to the aim point. The spell
  // ignores terrain (objSpell.checkCollisions 123-126 "doesn't need to check collisions"), so it steps
  // manually (Movement, which runs first in the chain, keeps vx/vy=0 and never collides the orb on a wall).
  release(targetX: number, targetY: number, speed: number): void {
    this.targetX = targetX; this.targetY = targetY; this.speed = Math.max(0.5, speed);
    this.mode = "fly";
    const m = this.entity.get(Movement);
    const d = Math.hypot(targetX - m.x, targetY - m.y) || 1;
    this.flyDirX = (targetX - m.x) / d; this.flyDirY = (targetY - m.y) / d;
    this.flyTtl = Math.ceil(d / this.speed) + 2;   // arrival budget (a coincident-aim cast explodes at once)
    m.vx = m.vy = 0;
    game.audio?.play(this.attack.releaseSound !== "#none" ? this.attack.releaseSound : "spell_release");
  }

  update(next: NextFn): void {
    if (this.mode === "fly") {
      const m = this.entity.get(Movement);
      // step toward the target over terrain; arrival when within one speed-step (moveXYfin) or the budget
      // runs out (a degenerate aim never strands the orb). Then goMode(#explode).
      if (Math.hypot(this.targetX - m.x, this.targetY - m.y) <= this.speed + 1 || --this.flyTtl <= 0) {
        m.x = this.targetX; m.y = this.targetY;
        this.explode();
      } else {
        m.x += this.flyDirX * this.speed; m.y += this.flyDirY * this.speed;
      }
    }
    next();
  }

  // goMode(#explode): grow the charge by chargeExplodeFactor, resolve the radial area hit (the spell's
  // payloadFunction off calcCollisionVectSpell over the grown charge), run the #summonUnit explode function
  // at the landing loc, then finish (the port collapses startQuickFade to an immediate finish).
  private explode(): void {
    if (this.mode === "explode") return;
    this.mode = "explode";
    const m = this.entity.get(Movement);
    const grown = this.charge * this.attack.chargeExplodeFactor; // pCurrentCharge ·= chargeExplodeFactor

    // explodeFunction (doExplodeFunction): a summon spell fields its unit AT the landing loc (faithful —
    // armySummon/monsterSummon default to #release, so the orb flies before summoning). The bolt-damage
    // payload still resolves below (selectPayload keeps the payload non-blank).
    if (this.attack.explodeFunction === "#summonUnit" || this.attack.explodeFunction === "summonUnit") {
      summonUnit(this.attack, this.charge, m.x, m.y, this.ownerId);
    } else if (this.attack.explodeFunction === "#depositMines" || this.attack.explodeFunction === "depositMines") {
      // energyMines: drop charge/chargePerUnit #energyMine actors scattered around the landing loc.
      depositMines(this.attack, this.charge, m.x, m.y);
    }

    // the radial area hit: reuse resolveSplash's #explode shape with the GROWN charge as the radius source
    // (radius = explodeCharge/2) and the px-scaled power as the magnitude (calcCollisionVectSpell), running
    // the spell's payloadFunction (takeHit / [takeFreeze,takeHit] / takeHeal) on every hostile in the disc.
    const explodeAttack: AttackData = {
      ...this.attack,
      attackType: "#explode",
      explodeCharge: grown,                                   // radius = grown/2
      powerScalar: this.attack.powerScalar * SPELL_RADIAL_SCALE, // magnitude = (hitRange−dist)·power·SCALE
    };
    // impactAttack(me): the spell IS the attacker (its #team = the owner's), but the takeHit attackerId is
    // the OWNER's id so kills credit the caster's experience (objSpell.gainExperience defers to the owner).
    resolveSplash(this.entity, explodeAttack, m.x, m.y, this.ownerId, this.hits, this.allegiance);
    game.audio?.play("spell_explode");                       // act #explodeSound
    this.done = true; // startQuickFade -> finish (collapsed): swept back to the pool next sweep
  }
}
