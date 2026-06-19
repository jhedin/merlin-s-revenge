// Dwelling (objDwelling + modResidents): a static building that periodically produces resident
// units of its team, up to a cap, until destroyed. The construction/army economy in miniature —
// the player must destroy dwellings to stop the flow of enemies.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { spriteCharOr } from "./anim";
import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";

export class Dwelling extends Component {
  static handles = ["update"];
  produces = "warrior";
  ranged = false;
  period = 210;   // ticks between residents (~7s)
  cap = 3;
  private timer = 60;
  private residents: Entity[] = [];

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["produces"] === "string") this.produces = cfg["produces"];
    if (typeof cfg["period"] === "number") this.period = cfg["period"];
    if (typeof cfg["cap"] === "number") this.cap = cfg["cap"];
    this.ranged = cfg["producesRanged"] === true;
    this.timer = Math.floor(this.period / 3);
    this.residents = [];
  }

  update(next: NextFn): void {
    if (this.entity.send("isDead")) return next();
    // forget dead/removed residents so the cap reflects living units
    this.residents = this.residents.filter((e) => !e.send("isDead") && game.entities.includes(e));
    if (++this.timer >= this.period && this.residents.length < this.cap && game.spawnEnemy) {
      this.timer = 0;
      const m = this.entity.get(Movement);
      const a = game.rng.next() * Math.PI * 2, r = 20 + game.rng.next() * 16;
      // produced units keep their real data (by name) but fall back to a stand-in sprite if unbundled
      const animChar = spriteCharOr(this.produces);
      const e = game.spawnEnemy(this.produces, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r,
        { animChar, ranged: this.ranged });
      game.entities.push(e);
      this.residents.push(e);
    }
    next();
  }
}
