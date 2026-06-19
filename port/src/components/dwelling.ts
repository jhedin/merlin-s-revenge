// Dwelling (objDwelling + modResidents): a static building that periodically produces resident
// units, up to a cap, until destroyed. WHAT it produces comes from the building's own data
// (#residentGroups, resolved in spawnDwelling) — goblinHut makes goblins, orcHouse makes orcs.
// Residents are routed by their own team (a #village hut produces allies), and a stand-in sprite
// is used when a resident's anims aren't bundled.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { spriteCharOr } from "./anim";
import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";

export class Dwelling extends Component {
  static handles = ["update"];
  residentTypes: string[] = []; // the unit names this building produces (from #residentGroups)
  period = 210;                 // ticks between residents (~7s)
  cap = 3;
  private timer = 60;
  private residents: Entity[] = [];

  override init(cfg: Record<string, any>): void {
    this.residentTypes = Array.isArray(cfg["residentTypes"]) ? cfg["residentTypes"] : [];
    if (typeof cfg["period"] === "number") this.period = cfg["period"];
    if (typeof cfg["cap"] === "number") this.cap = cfg["cap"];
    this.timer = Math.floor(this.period / 3);
    this.residents = [];
  }

  update(next: NextFn): void {
    if (this.entity.send("isDead") || this.residentTypes.length === 0) return next();
    // forget dead/removed residents so the cap reflects living units
    this.residents = this.residents.filter((e) => !e.send("isDead") && game.entities.includes(e));
    const spawn = game.spawnUnit ?? game.spawnEnemy;
    if (++this.timer >= this.period && this.residents.length < this.cap && spawn) {
      this.timer = 0;
      const m = this.entity.get(Movement);
      const a = game.rng.next() * Math.PI * 2, r = 20 + game.rng.next() * 16;
      // pick one of the building's resident types (multi-group huts vary their output)
      const name = this.residentTypes[Math.floor(game.rng.next() * this.residentTypes.length)]!;
      // real data drives stats/team/ranged; fall back to a stand-in sprite if unbundled
      const e = spawn(name, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, { animChar: spriteCharOr(name) });
      game.entities.push(e);
      this.residents.push(e);
    }
    next();
  }
}
