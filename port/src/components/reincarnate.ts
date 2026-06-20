// Reincarnate (modReincarnate): on a REAL combat death ("killed in action"), spawn each non-#none
// entry of the actor's #reincarnateAs / #reincarnateInto at the dying actor's corpse location, then
// let the parent finish. Each spawned part re-arms its OWN Reincarnate from its act-data, so the
// cascade depth is implicit in the data chain (skelitonLord -> Upper -> TorsoTank -> Head is 4 deep).
//
// Faithful to modReincarnate.txt:
//   internalEvent(#leftTeam): if me.big.getKilledInAction() then me.reincarnate()
//   reincarnate(): repeat with i in pReincarnateAs: if i<>#none then newActor({typ:i, startLoc:loc,
//                  useOffset:(j>1)})  -- one spawn per non-#none entry, in list order.
// The gate (#killedInAction) rides modEnergy.pKilledInAction — set ONLY on a lethal damage loss, never
// on a retire/room-exit/cull. So a #leaveWhenFinished ally (monk) or a room transition does NOT split.
//
// CARDINAL CORRECTNESS (plan §f.1):
//   (a) FIRE-ONCE LATCH (`done`) set BEFORE the spawn loop, so a double-update in the death frame can't
//       duplicate the cascade.
//   (b) STILL-VALID CORPSE LOC: spawn at the death-finalize edge reading getPos while the dying entity
//       is still in game.entities with a valid position (dead actors persist as graves in the port, so
//       the loc stays valid — but we still spawn synchronously on the first dead+killedInAction tick to
//       match the original's "spawn during leaveTeam, before the sprite is freed" timing).
//   (c) INFINITE-REINCARNATE GUARD: a depth budget threaded into each spawned child (decremented one tier
//       per generation). A data CYCLE (a typo: A->A) can't spawn forever — at depth 0 the cascade stops.
//       The original has NO guard (its data is acyclic); the cap is a port-only safety that never fires on
//       the shipped acyclic chains (the deepest is 4).
//
// Team & level come from each CHILD's own act-data (spawnUnit resolves the child's #team/#startingLevel) —
// NOTHING is inherited from the parent (faithful: newActor carries only typ + startLoc).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

// Default depth budget: deeper than any shipped chain (4) with headroom. A cyclic data typo terminates
// here instead of spawning forever. Not a behavioural cap on real content (which never reaches it).
const DEFAULT_DEPTH = 12;

// The depth budget for the NEXT spawn generation, set by the spawning parent immediately before each
// child build so the child's Reincarnate.init reads it (module-local hand-off; avoids threading a param
// through every spawn factory). Reset to DEFAULT_DEPTH after the spawn loop.
let pendingDepth = DEFAULT_DEPTH;

/** Normalize #reincarnateAs / #reincarnateInto to a string[] of bare actor keys, #none entries kept. */
function parseReincarnate(v: unknown): string[] {
  const one = (s: unknown): string | null => (typeof s === "string" ? s.replace(/^#/, "") : null);
  if (typeof v === "string") { const s = one(v); return s ? [s] : []; }   // bare symbol (hydra3 -> #hydra2)
  if (Array.isArray(v)) return v.map(one).filter((s): s is string => s !== null);
  return [];
}

export class Reincarnate extends Component {
  static handles = ["update"];
  private reincarnateAs: string[] = []; // normalized child keys (#none kept, skipped at spawn)
  private radius = 0;                   // #reincarnateRadius — scatter hint for offset spawns
  private depth = DEFAULT_DEPTH;        // remaining cascade budget (infinite-reincarnate guard)
  private done = false;                 // fire-once latch

  override init(cfg: Record<string, any>): void {
    // #reincarnateInto is honored as well as #reincarnateAs (both seen in the data family).
    this.reincarnateAs = parseReincarnate(cfg["reincarnateAs"] ?? cfg["reincarnateInto"]);
    this.radius = typeof cfg["reincarnateRadius"] === "number" ? cfg["reincarnateRadius"] : 0;
    this.depth = pendingDepth;          // budget handed off by the spawning parent (or DEFAULT at top level)
    this.done = false;
  }
  override reset(): void { this.done = false; }

  update(next: NextFn): void {
    if (!this.done && this.reincarnateAs.length > 0 && this.depth > 0) {
      // death-finalize edge: dead AND killed-in-action (NOT a retire/room-exit/cull).
      if ((this.entity.send("isDead") as boolean) && (this.entity.send("getKilledInAction") as boolean)) {
        this.done = true;                 // latch BEFORE spawning — no re-entry / duplication
        this.reincarnate();
      }
    }
    next();
  }

  // reincarnate(): one spawn per non-#none entry, in list order, at the corpse loc. j=1 (first) no offset;
  // j>1 fan out by #reincarnateRadius (the original's useOffset toggle through actorMaster.startActor).
  private reincarnate(): void {
    const pos = this.entity.send("getPos") as { x: number; y: number }; // still-valid corpse loc
    if (!game.spawnUnit) return;
    const childDepth = this.depth - 1;    // one tier shallower than me (the guard)
    let spawned = 0;
    for (let i = 0; i < this.reincarnateAs.length; i++) {
      const typ = this.reincarnateAs[i]!;
      if (typ === "none" || typ === "") continue;     // #none placeholders skipped (keeps "[#head,#none]"=1)
      // fan-out: first non-#none child spawns exactly at the corpse; the rest scatter on a ring so they
      // don't perfectly overlap (useOffset=true). Deterministic angle by spawn index.
      let dx = 0, dy = 0;
      if (spawned > 0) {
        const r = this.radius > 0 ? this.radius : 20;
        const ang = (spawned / Math.max(1, this.reincarnateAs.length)) * Math.PI * 2;
        dx = Math.cos(ang) * r; dy = Math.sin(ang) * r;
      }
      pendingDepth = childDepth;          // hand the budget to the child's Reincarnate.init
      const child = game.spawnUnit(typ, pos.x + dx, pos.y + dy, {});
      pendingDepth = DEFAULT_DEPTH;       // restore (top-level / non-reincarnate spawns get the full budget)
      game.entities.push(child);
      spawned++;
    }
  }
}
