// Movement component (objMoveXY): owns world position + velocity, integrates intent with
// friction and tile collision. Intent is set by a control/AI component earlier in the chain.
// Hot path is allocation-free (PORTING_PLAN §2.5).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export interface Pos { x: number; y: number; }

// Knockback (objGameObject.takeHit): a hit's collision vector is added to velocity, damped by inertia.
// At the original's engine scale knockback == the damage magnitude; at this slice's px scale that would
// launch units across the room, so — like the port's px-tuned spell damage — knockback keeps the same
// vector/direction/proportionality but is scaled down and clamped. Damage itself stays faithful (Energy).
const KNOCK_SCALE = 0.4;    // px-scale factor on the (damped) collision vector — a solid hit shoves ~5px
                            // (clamped), decaying over several ticks (~20px total). Was 0.06 (~<1px = no felt
                            // knockback). Big spells/heavy hits clamp at KNOCK_MAX so units aren't flung.
const KNOCK_MAX = 5;        // clamp a single hit's shove so big spells don't fling units
const KNOCK_FRICTION = 0.78; // per-tick decay of the knockback impulse
// nav-mode speed multiplier: objRoom.goNavMode swaps the player's walkAcceleration 2->6 (pNavModeAcceleration)
// in a cleared room. With friction applied every tick the original terminal velocity scales with accel, so
// nav ≈ 3x combat speed (the tile-size move cap ~31px/tick never binds). The port applies it as a maxSpeed x3.
const NAV_SPEED_MULT = 3;

export class Movement extends Component {
  static handles = ["update", "takeHit", "getPos", "levelUp", "addSaveData", "restoreFromSave"];
  x = 0; y = 0;
  vx = 0; vy = 0;           // walk velocity (intent-driven, speed-capped)
  kvx = 0; kvy = 0;         // knockback impulse (uncapped, friction-decayed)
  intentX = 0; intentY = 0;
  accel = 1.4; friction = 0.6; maxSpeed = 4; box = 12; inertia = 0;
  // modMoveToLoc.incWalkSpeedLevel (internalEvent #levelUp): every character's walk speed grows by
  // #walkSpeedIncLevel (engine 0.075) per level — enemies move faster (PointFrameMove at walkSpeed) and the
  // player's top speed rises over a playthrough. Stored already px-converted (player 1:1, enemy ×0.6).
  walkSpeedIncLevel = 0;
  // autoConstrainToPlayArea: a collisionDetection:false UNIT (ghost) is clamped to the room bounds (it
  // ignores walls but can't leave the play area). Bullets pass through AND exit freely (not set).
  constrainToArea = false;
  // #ghost (objCPUCharacter.takeHit: `if me.amGhost() then return`): a true ghost (monkGhost) takes NO hit
  // from external attackers — it's invulnerable; only its own possession-finish (attackerId == self) lands.
  ghost = false;
  facingLeft = false;
  hitX = false; hitY = false;  // wall contact this tick (projectiles read these)
  // objCPUCharacter.collisionWall/collisionVertical: a CPU unit knocked into a wall/ceiling takes
  // (impact − damageSpeed) bonus damage. damageSpeed is the per-actor threshold (modEnergy #damageSpeed=5);
  // knockDmgX/Y are the pending wall-slam damage armed by the hit that knocked the unit (its axis-aligned
  // collision magnitude), consumed on a wall slam while the knockback is still active.
  damageSpeed = 5;
  // #frictionReel (objGameObject, modReel: setFriction on #reel): per-actor friction that decays the
  // knockback shove. Default point(10,10); heavies override high (boulderMonster 40, fourArmGolem 50) so
  // they barely skid. The port's single multiplicative KNOCK_FRICTION ~= the default 10; map a higher
  // frictionReel to a proportionally snappier decay so heavy units stop their slide fast.
  frictionReel = 10;
  private knockFriction = KNOCK_FRICTION;
  private knockDmgX = 0; private knockDmgY = 0; private knockAttacker = -1;
  // objBullet.checkCollisions: bullets do NOT collide with terrain (gBulletsCollideWithBackground is never
  // set, so the ancestor collision check never runs) — they fly THROUGH walls and die only by stalling /
  // hitting a target / expiring. passThrough integrates position with no moveBox so a bullet isn't stopped
  // dead at a wall. Default false (actors collide as before).
  passThrough = false;

  override init(cfg: Record<string, any>): void {
    this.x = cfg["x"] ?? 0; this.y = cfg["y"] ?? 0;
    this.vx = 0; this.vy = 0; this.kvx = 0; this.kvy = 0; this.intentX = 0; this.intentY = 0;
    this.accel = 1.4; this.friction = 0.6; this.maxSpeed = 4; this.inertia = 0; this.passThrough = cfg["passThrough"] === true;
    if (typeof cfg["walkSpeed"] === "number") this.maxSpeed = cfg["walkSpeed"];
    if (typeof cfg["accel"] === "number") this.accel = cfg["accel"];
    if (typeof cfg["friction"] === "number") this.friction = cfg["friction"];
    if (typeof cfg["box"] === "number") this.box = cfg["box"];
    if (typeof cfg["inertia"] === "number") this.inertia = Math.max(0, Math.min(100, cfg["inertia"]));
    this.walkSpeedIncLevel = typeof cfg["walkSpeedIncLevel"] === "number" ? cfg["walkSpeedIncLevel"] : 0;
    this.constrainToArea = cfg["constrainToArea"] === true;
    this.ghost = cfg["ghost"] === true;
    // #initFaceDir (objGameObject): -1 spawns the actor facing LEFT (else right). Cutscene wizards/king face
    // left on entry; without this they spawn facing right for a frame before walkTo/turnToFace corrects them.
    this.facingLeft = cfg["initFaceDir"] === -1;
    this.damageSpeed = typeof cfg["damageSpeed"] === "number" ? cfg["damageSpeed"] : 5;
    this.frictionReel = typeof cfg["frictionReel"] === "number" ? cfg["frictionReel"] : 10;
    // default 10 -> the tuned global 0.78; a stiffer frictionReel decays the shove proportionally faster.
    this.knockFriction = Math.max(0.1, Math.min(0.9, KNOCK_FRICTION * 10 / this.frictionReel));
    this.knockDmgX = this.knockDmgY = 0; this.knockAttacker = -1;
  }

  // modMoveToLoc.internalEvent #levelUp -> incWalkSpeedLevel: bump the walk-speed cap by the per-level
  // increment. Fans out from Experience.levelUp alongside Energy/Mana growth.
  levelUp(next: NextFn): void {
    this.maxSpeed += this.walkSpeedIncLevel;
    next();
  }
  override reset(): void {
    this.vx = this.vy = this.kvx = this.kvy = this.intentX = this.intentY = 0; this.hitX = this.hitY = false;
  }

  // objGameObject.takeHit: damp the collision vector by inertia ONCE (modGameObject), then apply it both
  // as the knockback impulse AND pass it DOWNSTREAM to Energy/Freeze/Heal — so inertia cuts DAMAGE too,
  // exactly like the original (VarValRange(percent,[0,vect]) = vect·(100−inertia)/100 read by modEnergy).
  // Ordered first in the chain (Movement precedes Energy/Hurt/Experience in every archetype). The enemy/
  // player attack powers are now the faithful data values (K1: power·strength·mult), calibrated for this
  // coupling. Player inertia is 0 (undamped attacking); heavy orcs (inertia 60–80) take ~20–40% — tanky.
  // See docs/parity/plans/K1-faithful-damage.md.
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
    // amGhost gate (objCPUCharacter.takeHit:200): a ghost ignores ALL external attacks (no damage, no
    // knockback, no chain) — only its OWN possession-finish (attackerId == its id) is allowed through.
    if (this.ghost && attackerId !== this.entity.id) return;
    const d = (100 - this.inertia) / 100;
    const dvx = vx * d, dvy = vy * d;                 // the inertia-damped collision vector (modGameObject)
    // objGameObject.takeHit applies the knockback impulse to EVERY unit. #reelProof (modReel.takeHit:111)
    // only gates goDamageMode() — the reel STAGGER, handled in Hurt — NOT the shove. So a reel-proof unit
    // (skelitonHead/towers/plant) is still pushed back by a hit; it just doesn't enter the reel animation.
    let kx = dvx * KNOCK_SCALE, ky = dvy * KNOCK_SCALE;
    const km = Math.hypot(kx, ky);
    if (km > KNOCK_MAX) { kx = (kx / km) * KNOCK_MAX; ky = (ky / km) * KNOCK_MAX; }
    this.kvx += kx; this.kvy += ky;
    // arm the wall-slam damage (objCPUCharacter only — the player has no collisionWall handler). If this
    // knockback carries the CPU unit into a wall before it decays, it takes (|dv| − damageSpeed) bonus on
    // that axis. Tracks X/Y separately to match collisionWall (vectX) vs collisionVertical (vectY).
    if (this.entity.type !== "player") {
      this.knockDmgX = Math.abs(dvx); this.knockDmgY = Math.abs(dvy); this.knockAttacker = attackerId;
    }
    return next(dvx, dvy, attackerId, mult);          // damped vector -> Energy/Freeze/Heal (the coupling)
  }

  moving(): boolean { return this.vx !== 0 || this.vy !== 0; }
  getPos(): Pos { return { x: this.x, y: this.y }; } // query

  // save/restore are ordered fold messages: each component writes a namespaced sub-dict.
  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["move"] = { x: this.x, y: this.y, vx: this.vx, vy: this.vy };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["move"];
    if (s) { this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy; }
    return next(sd);
  }

  update(next: NextFn): void {
    // A settled GRAVE (a dead actor that leaves a grave) is frozen in place: the original blits the grave
    // member into the room background ONCE at the death loc and drops the actor from the sim (objRoom.
    // drawAndRecordGrave), so it can't slide from the killing blow's residual knockback or be shoved by a
    // later area hit (the reelProof "shove all units" path reaches dead bodies too). Hold position; zero all
    // velocity so nothing accumulates. (Dead player/ghost are not graves — they fall through to the normal path.)
    if (this.entity.send("isDead") === true && this.entity.send("getGraveOn") === true) {
      this.vx = this.vy = this.kvx = this.kvy = 0;
      return next();
    }
    this.vx += this.intentX * this.accel;
    this.vy += this.intentY * this.accel;
    if (this.intentX === 0) this.vx *= this.friction;
    if (this.intentY === 0) this.vy *= this.friction;
    // nav mode (objRoom.goNavMode, gNavMode=1): in a CLEARED room the player accelerates at 6 vs combat 2 —
    // ~3x faster. The port's hard-cap model folds this into a maxSpeed multiplier, player-only (goNavMode
    // only swaps the player's walkAcceleration). Combat (uncleared room) is unchanged.
    const nav = this.entity.type === "player" && game.navMode ? NAV_SPEED_MULT : 1;
    const cap = this.maxSpeed * nav * (this.entity.send("freezeFactor") as number ?? 1); // modFreeze (0.5x frozen)
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > cap) { this.vx = (this.vx / sp) * cap; this.vy = (this.vy / sp) * cap; }
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;
    // facing follows the walk direction — EXCEPT mid-attack, where it's locked to the swing's aim (set once
    // at attack entry). A moving unit attacking keeps facing its target/aim instead of flipping to its walk.
    if (this.entity.send("attackActive") !== true) {
      if (this.vx < 0) this.facingLeft = true; else if (this.vx > 0) this.facingLeft = false;
    }

    // passThrough (bullets + ghosts): integrate position with NO terrain collision — fly straight through
    // walls (objBullet never collides with the background; ghost units run collisionDetectionOff), dying
    // only on target-hit / expiry.
    if (this.passThrough) {
      this.x += this.vx + this.kvx; this.y += this.vy + this.kvy;
      this.hitX = this.hitY = false;
      this.kvx *= this.knockFriction; this.kvy *= this.knockFriction;
      // autoConstrainToPlayArea (objGameObject:164): a collisionDetection:false UNIT (ghost) is clamped to
      // the play area so it can't drift off-map (bullets don't set this — they exit and expire). Bounds are
      // the room grid extent, inset by the unit's half-box.
      if (this.constrainToArea && game.grid) {
        const b = this.box / 2;
        const w = game.grid.cols * game.grid.tilePx, h = game.grid.rows * game.grid.tilePx;
        this.x = Math.max(b, Math.min(w - b, this.x));
        this.y = Math.max(b, Math.min(h - b, this.y));
      }
      return next();
    }

    // integrate walk velocity (capped, above) + knockback impulse (uncapped) together, then decay knockback
    const b = this.box;
    const oldTop = this.y - b / 2;
    const knx = this.kvx, kny = this.kvy; // knockback velocity this tick (before it's zeroed by a wall)
    // was the box validly INSIDE the play area before this move? (A spawn placed half-out-of-bounds gets
    // CLAMPED inward and moveBox reports a wall event for that — not a real slam. Only an in-bounds box
    // being DRIVEN into a wall counts.)
    const gw = game.grid.cols * game.grid.tilePx, gh = game.grid.rows * game.grid.tilePx;
    const inBounds = this.x - b / 2 >= 0 && this.y - b / 2 >= 0 && this.x + b / 2 <= gw && this.y + b / 2 <= gh;
    const r = game.grid.moveBox(this.x - b / 2, this.y - b / 2, b, b, this.vx + this.kvx, this.vy + this.kvy, oldTop);
    this.hitX = r.hitX; this.hitY = r.hitY;
    // objCPUCharacter.collisionWall/collisionVertical: a unit DRIVEN into a wall/ceiling by its knockback
    // (knockDmg armed by the hit, still active) takes (impact − damageSpeed) bonus damage on that axis. Gate
    // on the DIRECTIONAL collision event matching the knockback sign — so a unit merely clamped at the play-
    // area boundary while knocked AWAY isn't hit. loseEnergy is damage-only (no further knockback); the
    // combat tick + reincarnate.ts handle a resulting death off isDead, just like a takeHit kill.
    if (inBounds && this.knockDmgX > this.damageSpeed && ((r.events.wallRight && knx > 0) || (r.events.wallLeft && knx < 0))) {
      this.entity.send("loseEnergy", this.knockDmgX - this.damageSpeed, this.knockAttacker); this.knockDmgX = 0;
    }
    if (inBounds && this.knockDmgY > this.damageSpeed && r.events.ceiling && kny < 0) {
      this.entity.send("loseEnergy", this.knockDmgY - this.damageSpeed, this.knockAttacker); this.knockDmgY = 0;
    }
    if (r.hitX) { this.vx = 0; this.kvx = 0; }
    if (r.hitY) { this.vy = 0; this.kvy = 0; }
    // disarm the wall-slam once the knockback impulse has decayed (so a later WALK into a wall deals nothing).
    if ((this.knockDmgX || this.knockDmgY) && Math.abs(this.kvx) + Math.abs(this.kvy) < 0.1) { this.knockDmgX = this.knockDmgY = 0; }
    this.x = r.x + b / 2; this.y = r.y + b / 2;
    // directional collision events (checkCollisions 266-295): dispatch as chain messages so gameplay
    // components (reelFly-landing, AI scenic repathing) can react. Solid grids only ever fire wall*/
    // ceiling; #platform/#none* events come from the typed path. Sent via the entity so any listener
    // on the chain receives them (no-op when nothing handles them).
    const ev = r.events;
    if (ev.wallLeft) this.entity.send("collisionWallLeft");
    if (ev.wallRight) this.entity.send("collisionWallRight");
    if (ev.ceiling) this.entity.send("collisionCeiling");
    if (ev.platform) this.entity.send("collisionPlatform");
    if (ev.noPlatform) this.entity.send("collisionNoPlatform");
    this.kvx *= this.knockFriction; this.kvy *= this.knockFriction;
    if (Math.abs(this.kvx) < 0.05) this.kvx = 0;
    if (Math.abs(this.kvy) < 0.05) this.kvy = 0;
    next();
  }
}
