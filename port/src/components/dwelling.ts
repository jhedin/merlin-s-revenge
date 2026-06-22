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
import { registry } from "../game/data";
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
  // the dwelling's experience level. Seeded from #startingLevel, then INCREMENTED once per resident released
  // (modResidents.releaseResident:170 me.big.levelUp()) — so successive residents emerge progressively
  // stronger (setStartingLevel(random(level))) and the dwelling's own max energy decays (energyIncPercentage).
  private level = 0;

  override init(cfg: Record<string, any>): void {
    this.groups = Array.isArray(cfg["residentGroups"]) ? cfg["residentGroups"] : [];
    this.budget = typeof cfg["budget"] === "number" ? cfg["budget"] : 10;
    this.level = typeof cfg["startingLevel"] === "number" ? cfg["startingLevel"] : 0;
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
      // reservationsMaster.getPermissionToRelease: hold if my own wave cap is hit OR the resident's TEAM is
      // already at its global concurrent cap (gMaxEnemies 16 / gMaxFriends 12). The latter is the faithful
      // per-team headcount that stops multiple dwellings from flooding a team past the original's limit.
      const resTeam = registry.resolveActor(this.group!.typ)?.["team"];
      if (this.residents.length >= this.aliveCap ||
        (typeof resTeam === "string" && game.teamMaster.atCapacity(resTeam))) {
        this.timer = this.rnd(this.group!.releaseInterval); return next(); // await permission
      }
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
    // modResidents.releaseResident: params.startLoc = me.getLoc(), useOffset = FALSE — a resident spawns AT
    // the dwelling's reg point, not a random ring offset (the old offset could land it outside the room /
    // in a wall, stranding an unkillable enemy, and just looked wrong — far from the spawner). It then walks
    // out on its own AI. The dwelling's loc is always a valid in-bounds spot.
    const e = spawn(this.group.typ, m.x, m.y, { animChar: spriteCharOr(this.group.typ) });
    // modResidents.releaseResident: setStartingLevel(random(getExperienceLevel)) uses the dwelling's level
    // BEFORE this release. random(level) = 1..level for level>0 (Lingo random(n) ∈ 1..n); 0 when level 0.
    // A fresh (level-0) dwelling fields its first resident unleveled; later residents escalate as the
    // dwelling levels up below.
    const draw = game.rng.next();                       // one rng draw (keeps the per-unit rng stream stable)
    const ups = this.level > 0 ? 1 + Math.floor(draw * this.level) : 0;
    for (let i = 0; i < ups; i++) e.send("forceLevelUp");
    game.entities.push(e);
    this.residents.push(e);
    // me.big.levelUp() (modResidents.releaseResident:170): the dwelling gains a level per release, so the
    // NEXT resident draws from a higher random(level), and the dwelling's own max energy decays by
    // energyIncPercentage (-1%/level). The dwelling entity has no Experience component, so advance the
    // tracked level and fan out #levelUp directly (only Energy responds, applying the decay).
    this.level++;
    this.entity.send("levelUp");
  }
}
