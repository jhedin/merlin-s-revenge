// UnitMap (teamMaster.pUnitMap + searchUnitMap): a tile-bucketed broad-phase over live units so target
// search is O(units in the nearest occupied shell), not a linear scan of every entity. Faithful to the
// original's expanding square-shell walk: shell 0 (own tile), then rings of radius 1, 2, …, stopping as
// soon as shell > minShell AND something was found, or at maxShell. Rebuilt once per tick before AIs run
// (behaviour-equivalent to the original's lazy poke/peek for a frame-synchronous query).

import type { Entity } from "../engine/dispatch";

export class UnitMap {
  private tiles = new Map<number, Entity[]>();
  constructor(public tileSize = 32, private originX = 0, private originY = 0) {}

  configure(tileSize: number, originX: number, originY: number): void {
    this.tileSize = tileSize; this.originX = originX; this.originY = originY;
  }

  private tx(x: number): number { return Math.floor((x - this.originX) / this.tileSize); }
  private ty(y: number): number { return Math.floor((y - this.originY) / this.tileSize); }
  private key(tx: number, ty: number): number { return ((tx & 0xffff) << 16) | (ty & 0xffff); }

  clear(): void { this.tiles.clear(); }

  insert(e: Entity, x: number, y: number): void {
    const k = this.key(this.tx(x), this.ty(y));
    const bucket = this.tiles.get(k);
    if (bucket) bucket.push(e); else this.tiles.set(k, [e]);
  }

  private collect(tx: number, ty: number, accept: (e: Entity) => boolean, out: Entity[]): void {
    const bucket = this.tiles.get(this.key(tx, ty));
    if (!bucket) return;
    for (const e of bucket) if (accept(e)) out.push(e);
  }

  // searchUnitMap(tileLoc, targetTeams, minShell, maxShell): walk outward in square shells, appending
  // accepted units, and stop once we've gone past minShell with something in hand (so the original's
  // "look one ring further" semantics are preserved). Returns the candidates; caller picks the nearest.
  search(x: number, y: number, accept: (e: Entity) => boolean, minShell = 0, maxShell = 20): Entity[] {
    const tx = this.tx(x), ty = this.ty(y), out: Entity[] = [];
    const cap = Math.min(maxShell, 50); // teamMaster hard cap
    for (let s = 0; s <= cap; s++) {
      if (s === 0) {
        this.collect(tx, ty, accept, out);
      } else {
        for (let dx = -s; dx <= s; dx++) {
          for (let dy = -s; dy <= s; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === s) this.collect(tx + dx, ty + dy, accept, out);
          }
        }
      }
      if (s > minShell && out.length > 0) break;
    }
    return out;
  }
}
