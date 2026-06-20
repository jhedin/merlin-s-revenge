// Mine (casts/script_objects/objMine.txt + modAttack + modExploder): a static proximity actor with a
// tiny prime->check->detonate FSM. It sits on its tile and, once primed, every few frames checks for a
// hostile inside its trigger radius; on a hit it detonates — running its #attack (an #explode area hit)
// at its own loc through the SAME resolveSplash engine C2 built. fire/pitMonster carry a damage #attack;
// the five auras carry damageMultiplier:0 + #takeFreeze (a slowing proximity field, NOT a 0-damage hit —
// the freeze is routed through the payload list by resolveSplash/applyPayload, plan §g.7).
//
// FSM (objMine.update):
//   #stand   : count down pPrimeCounter (timeToPrime frames). primed -> #primed.
//   #primed  : every pCheckCounter (timeToCheck=3) frames, findHostileWithin(radius); if any hostile in
//              range -> #mineTriggered -> detonate (resolveSplash) -> #explodeFin.
//   #explodeFin: dieOnExplode -> die; else re-arm (resetMine) + pExplosions++; die once
//                pExplosions >= dieOnExplodeNumber (when dieOnExplodeNumber <> 0). (fire dies after 10;
//                pitMonster + auras re-arm forever.)

import { Component, type NextFn } from "../engine/dispatch";
import { Counter } from "../engine/counter";
import { Movement } from "./movement";
import { game } from "../game/context";
import { resolveSplash } from "./splash";
import type { AttackData } from "./weapon";

type MineMode = "stand" | "primed";

export class Mine extends Component {
  static handles = ["update", "getMineMode", "getExplosions"];
  // Note: detonation kills via the Energy chain (takeHit 999999) — the mine carries Energy so it's a
  // real targetable actor (objMine is an objGameObject), matching dwelling self-destruct.
  private attack!: AttackData;
  private triggerRadius = 20;      // pTriggerRadius (px)
  private dieOnExplode = true;     // pDieOnExplode
  private dieOnExplodeNumber = 0;  // pDieOnExplodeNumber (0 = ignore the count)
  private explosions = 0;          // pExplosions
  private explodeSound = "";       // #explodeSound (#none -> silent)
  private prime!: Counter;         // pPrimeCounter (tim[2]=timeToPrime)
  private check!: Counter;         // pCheckCounter (tim[2]=timeToCheck)
  private mode: MineMode = "stand";

  override init(cfg: Record<string, any>): void {
    this.attack = cfg["attack"] as AttackData;
    this.triggerRadius = typeof cfg["triggerRadius"] === "number" ? cfg["triggerRadius"] : 20;
    this.dieOnExplode = cfg["dieOnExplode"] === true;
    this.dieOnExplodeNumber = typeof cfg["dieOnExplodeNumber"] === "number" ? cfg["dieOnExplodeNumber"] : 0;
    this.explodeSound = typeof cfg["explodeSound"] === "string" ? cfg["explodeSound"] : "";
    const timeToPrime = typeof cfg["timeToPrime"] === "number" ? cfg["timeToPrime"] : 30;
    const timeToCheck = typeof cfg["timeToCheck"] === "number" ? cfg["timeToCheck"] : 3;
    this.prime = new Counter(timeToPrime, 1);
    this.check = new Counter(timeToCheck, 1);
    this.explosions = 0;
    this.resetMine();
  }
  override reset(): void { this.mode = "stand"; this.explosions = 0; }

  getMineMode(): MineMode { return this.mode; }
  getExplosions(): number { return this.explosions; }

  private resetMine(): void {
    this.prime.reset();
    this.check.reset();
    this.mode = "stand";
  }

  update(next: NextFn): void {
    if (this.entity.send("isDead")) return next();
    if (this.mode === "stand") {
      // updatePrime: tick the prime counter; when it fins, go primed.
      if (this.prime.fin) { this.mode = "primed"; } else this.prime.once();
    } else { // primed
      // updateCheck: tick the check counter; on its fin, run a collision check, then reset the counter.
      if (this.check.fin) {
        this.check.reset();
        if (this.collisionDetected()) this.detonate();
      } else this.check.once();
    }
    next();
  }

  // updateCheckCollisions: findTargetWithin(triggerRadius).dist < triggerRadius -> a hostile is in range.
  private collisionDetected(): boolean {
    const m = this.entity.get(Movement);
    const hits = this.attack.hits.length ? this.attack.hits : ["#teamMembers"];
    const r = game.teamMaster.findHostileWithin(this.entity, m.x, m.y, this.triggerRadius, hits);
    return r.obj !== null;
  }

  // #mineTriggered -> modExploder runs the #attack (an #explode area hit at the mine's loc), then
  // #explodeFin: die or re-arm.
  private detonate(): void {
    const m = this.entity.get(Movement);
    const hits = this.attack.hits.length ? this.attack.hits : ["#teamMembers"];
    // resolveSplash runs the #explode disc (damage for fire/pit; #takeFreeze for the auras) — same engine
    // as every bullet/spell explode. Allegiance #enemy resolves the mine team's #hates (team-gated).
    resolveSplash(this.entity, this.attack, m.x, m.y, this.entity.id, hits, "#enemy");
    if (this.explodeSound) game.audio?.play(this.explodeSound, 0.5);
    // #explodeFin
    if (this.dieOnExplode) {
      this.entity.send("takeHit", 999999, 0, this.entity.id); // setDead (self-detonate kill)
    } else {
      this.resetMine();
      this.explosions++;
      if (this.dieOnExplodeNumber !== 0 && this.explosions >= this.dieOnExplodeNumber) {
        this.entity.send("takeHit", 999999, 0, this.entity.id); // setDead (self-detonate kill)
      }
    }
  }
}
