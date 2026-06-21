// Effects layer — lightweight cosmetic particles that aren't combat entities.
//
// modStarReleaser + starMaster.experienceStar: a unit that LEVELS UP releases a star that rises from it
// (act_experienceStar: #character experienceStar, initVect point(0,-2), friction point(1,10), inertia 50,
// #lifeCount 30 — so it drifts upward, decelerating, then vanishes after 30 frames). starMaster draws it
// just BEHIND the unit (setLocZ(locZ-1)). It's a pure flourish — no pickup, no XP, no collision — so it
// is modelled here as a particle list rather than a full ECS entity (which the combat/AI systems would
// otherwise have to special-case).

import type { Renderer } from "./renderer";
import { game } from "../game/context";

interface StarParticle { x: number; y: number; vy: number; life: number; }

const STAR_LIFE = 30;                 // act_experienceStar #lifeCount
const STAR_CHAR = "experienceStar";
const STAR_FRICTION_Y = 0.9;          // friction point(1,10): the upward drift decelerates each tick

export class Effects {
  private stars: StarParticle[] = [];

  /** starMaster.experienceStar(theObj): a star rises from (x,y) — spawned on a unit's level-up. */
  spawnLevelUpStar(x: number, y: number): void {
    this.stars.push({ x, y: y - 6, vy: -2, life: 0 }); // startLoc = unit loc; initVect point(0,-2)
  }

  update(): void {
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i]!;
      s.y += s.vy;
      s.vy *= STAR_FRICTION_Y;                  // decelerate the rise (vertical friction)
      if (++s.life >= STAR_LIFE) this.stars.splice(i, 1); // #lifeCount expiry -> vanish
    }
  }

  /** drawn BEHIND the actors (starMaster setLocZ(locZ-1)) — call before the actor sprite pass. */
  draw(renderer: Renderer): void {
    if (this.stars.length === 0) return;
    const anim = game.assets.index.anims[STAR_CHAR + "_stand"];
    const f = anim?.frames[0];
    if (!f) return;
    if (!game.assets.images.has(f.file)) { void game.assets.ensureChar(STAR_CHAR); return; }
    const img = game.assets.img(f.file) as CanvasImageSource | null;
    if (!img) return;
    const ctx = renderer.ctx;
    for (const s of this.stars) {
      ctx.drawImage(img, Math.round(s.x - f.reg[0]), Math.round(s.y - f.reg[1]));
    }
  }

  /** drop all particles (room change / new game). */
  clear(): void { this.stars.length = 0; }

  get count(): number { return this.stars.length; } // test seam
}
