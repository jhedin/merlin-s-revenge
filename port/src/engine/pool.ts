// Object pool for high-churn archetypes (bullets, stars). Mandatory per PLAN_REVIEW §2 /
// PORTING_PLAN §2.5: bullets/stars are created+destroyed hundreds/sec, so we recycle instances
// (reset via Component.reset) instead of allocating, avoiding GC-scavenge hitches at 30 Hz.

import { Archetype, type Entity, makeEntityId } from "./dispatch";

export class Pool {
  private free: Entity[] = [];
  private created = 0;
  constructor(private readonly archetype: Archetype) {}

  acquire(): Entity {
    const e = this.free.pop();
    if (e) { e.dead = false; return e; }
    this.created++;
    return this.archetype.create(makeEntityId());
  }

  release(e: Entity): void {
    e.resetForPool();
    this.free.push(e);
  }

  get stats(): { free: number; created: number } { return { free: this.free.length, created: this.created }; }
}
