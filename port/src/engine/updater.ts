// Port of objUpdater (priority buckets) + objAutoUpdate registration. Entities self-register
// into a priority bucket and are ticked each frame; they unregister themselves (calcFin) when
// their finish condition is met. There is no central "for each entity" sweep — matching the
// original's opt-in scheduler.

export type Priority = "hi" | "med" | "lo";
const ORDER: Priority[] = ["hi", "med", "lo"];

export interface Updatable {
  /** advance one logical tick */
  update(): void;
}

export class Updater {
  private buckets: Record<Priority, Updatable[]> = { hi: [], med: [], lo: [] };
  private inBucket = new Map<Updatable, Priority>();
  /** deferred removals so we can splice safely mid-tick */
  private pendingRemove = new Set<Updatable>();
  private ticking = false;

  add(u: Updatable, prio: Priority = "med"): void {
    if (this.inBucket.has(u)) return;
    this.inBucket.set(u, prio);
    this.buckets[prio].push(u);
    this.pendingRemove.delete(u);
  }

  remove(u: Updatable): void {
    if (!this.inBucket.has(u)) return;
    if (this.ticking) { this.pendingRemove.add(u); return; }
    this.spliceOut(u);
  }

  private spliceOut(u: Updatable): void {
    const prio = this.inBucket.get(u);
    if (!prio) return;
    const arr = this.buckets[prio];
    const i = arr.indexOf(u);
    if (i >= 0) arr.splice(i, 1);
    this.inBucket.delete(u);
  }

  tick(): void {
    this.ticking = true;
    for (const prio of ORDER) {
      const arr = this.buckets[prio];
      // index walk; new adds this frame land at the end and run this frame (matches Director)
      for (let i = 0; i < arr.length; i++) {
        const u = arr[i]!;
        if (!this.pendingRemove.has(u)) u.update();
      }
    }
    this.ticking = false;
    if (this.pendingRemove.size) {
      for (const u of this.pendingRemove) this.spliceOut(u);
      this.pendingRemove.clear();
    }
  }

  get size(): number { return this.buckets.hi.length + this.buckets.med.length + this.buckets.lo.length; }
  clear(): void { this.buckets = { hi: [], med: [], lo: [] }; this.inBucket.clear(); this.pendingRemove.clear(); }
}
