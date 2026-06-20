// Dwelling (objDwelling + modResidents): a static building that releases a lifetime budget of
// resident units in randomized groups, then stops (it must still be destroyed to clear the room).
// Faithful to modResidents: pick a group, spend groupSize*buildTime producing it, then release the
// units one at a time spaced by releaseInterval, then the next group, until the budget is spent.
// Residents route by their own team (a #village hut produces allies); a soft concurrent cap stands
// in for reservationsMaster so waves don't flood the slice.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { spriteCharOr } from "./anim";
import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";

interface ResidentGroup { typ: string; buildTime: [number, number]; groupSize: [number, number]; releaseInterval: [number, number]; }

export class Dwelling extends Component {
  static handles = ["update"];
  groups: ResidentGroup[] = [];
  budget = 10;               // lifetime residents remaining (#totalResidents)
  private aliveCap = 6;      // soft concurrent cap (reservationsMaster stand-in)
  private mode: "produce" | "release" | "empty" = "empty";
  private timer = 0;
  private group: ResidentGroup | null = null;
  private groupLeft = 0;     // units still to release in the current group
  private residents: Entity[] = [];

  override init(cfg: Record<string, any>): void {
    this.groups = Array.isArray(cfg["residentGroups"]) ? cfg["residentGroups"] : [];
    this.budget = typeof cfg["budget"] === "number" ? cfg["budget"] : 10;
    this.residents = [];
    this.startProduction();
  }

  private rnd(r: [number, number]): number { return r[0] + Math.floor(game.rng.next() * (r[1] - r[0] + 1)); }

  private startProduction(): void {
    if (this.budget <= 0 || this.groups.length === 0) {
      // modResidents.noMoreResidents -> startDeath: a spent building self-destructs (leaves a grave)
      // rather than standing inert, so the room clears once its residents are dealt with.
      if (this.mode !== "empty" && !this.entity.send("isDead")) {
        this.entity.send("takeHit", 999999, 0, this.entity.id);
      }
      this.mode = "empty";
      return;
    }
    this.group = this.groups[Math.floor(game.rng.next() * this.groups.length)]!;
    this.groupLeft = Math.min(this.rnd(this.group.groupSize), this.budget);
    this.timer = this.groupLeft * this.rnd(this.group.buildTime); // productionTime
    this.mode = "produce";
  }

  update(next: NextFn): void {
    if (this.entity.send("isDead") || this.mode === "empty") return next();
    this.residents = this.residents.filter((e) => !e.send("isDead") && game.entities.includes(e));
    if (--this.timer > 0) return next();

    if (this.mode === "produce") {
      this.mode = "release"; this.timer = this.rnd(this.group!.releaseInterval);
    } else { // release
      if (this.residents.length >= this.aliveCap) { this.timer = this.rnd(this.group!.releaseInterval); return next(); } // await permission
      this.releaseOne();
      this.budget--; this.groupLeft--;
      if (this.groupLeft <= 0) this.startProduction();              // next group (or empty)
      else this.timer = this.rnd(this.group!.releaseInterval);      // next unit in this group
    }
    next();
  }

  private releaseOne(): void {
    const spawn = game.spawnUnit ?? game.spawnEnemy;
    if (!spawn || !this.group) return;
    const m = this.entity.get(Movement);
    const a = game.rng.next() * Math.PI * 2, r = 20 + game.rng.next() * 16;
    const e = spawn(this.group.typ, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, { animChar: spriteCharOr(this.group.typ) });
    // modResidents.setStartingLevel: residents emerge at a small random level (kept modest at slice scale)
    if (game.rng.next() < 0.5) e.send("forceLevelUp");
    game.entities.push(e);
    this.residents.push(e);
  }
}
