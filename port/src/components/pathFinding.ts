// PathFinding (modPathFinding): the faithful beeline→scenic waypoint pather (NOT A*). Walk straight at
// the goal; if BLOCKED — the rendered movement delta is point(0,0) for `stallTime` (5) consecutive frames
// — pick ONE random waypoint within ±pathDist (100) px of the current loc (PointRoughly) and head there;
// when blocked again, flip back to beeline. A random-walk-around-obstacles, not a planned path.
//
// This is a plain helper (not a chain Component) held by CpuAI: each tick the AI calls findPathToLoc(tx,ty)
// to set the Movement intent toward the target/waypoint, and the helper tracks the actual position delta
// (the port's stand-in for objMoveXY.getMoveVect) to detect a stall. Arrival within 5px (modMoveToLoc).
//
// No-regression: in open terrain the unit never stalls (it always moves toward the goal), so it stays in
// #beeline = a straight chase — behaviourally identical to the old seek() no-collision path.

import type { Movement } from "./movement";
import type { Rng } from "../engine/math";
import { game } from "../game/context";

const clampRange = (v: number, lo: number, hi: number): number => (hi < lo ? v : v < lo ? lo : v > hi ? hi : v);

const ARRIVE = 5;          // modMoveToLoc arrival radius (GeomDistSqr < 5px)
const PATH_DIST = 100;     // pPathFindingDistance (PointRoughly radius)
const STALL_TIME = 5;      // pathFindingStallTime (frames of zero movement → stalled)

export class PathFinding {
  private mode: "beeline" | "scenic" = "beeline";
  private waypointX = 0; private waypointY = 0;
  private stallCtr = 0;
  private lastX = NaN; private lastY = NaN;

  reset(): void { this.mode = "beeline"; this.stallCtr = 0; this.lastX = this.lastY = NaN; }
  getMode(): "beeline" | "scenic" { return this.mode; }       // test/debug
  getWaypoint(): { x: number; y: number } { return { x: this.waypointX, y: this.waypointY }; }

  // findPathToLoc(tx,ty): set Movement intent toward the goal (beeline) or the scenic waypoint, detecting
  // stalls off the actual per-tick position delta. Returns true once within ARRIVE of the ultimate goal.
  findPathToLoc(m: Movement, tx: number, ty: number, rng: Rng): boolean {
    const arrived = Math.hypot(tx - m.x, ty - m.y) <= ARRIVE;
    if (arrived) { m.intentX = 0; m.intentY = 0; this.lastX = m.x; this.lastY = m.y; return true; }

    if (this.mode === "beeline") {
      this.steerTo(m, tx, ty);
      if (this.updateStall(m)) this.goScenic(m, rng);          // blocked → pick a random waypoint
    } else { // scenic
      this.steerTo(m, this.waypointX, this.waypointY);
      // arrival at the waypoint OR a fresh stall flips us back to beeline (faithful: updateScenic returns
      // fin on the next stall; we also break out once the waypoint is reached so we don't loiter).
      const atWaypoint = Math.hypot(this.waypointX - m.x, this.waypointY - m.y) <= ARRIVE;
      if (atWaypoint || this.updateStall(m)) this.mode = "beeline";
    }
    return false;
  }

  // PointRoughly(currentLoc, 100): a uniformly random point within ±100px per axis of the CURRENT loc
  // (NOT relative to the obstacle or target — faithful to goPathFindingMode(#scenic)). Clamped to the map
  // rect so a unit pinned against a boundary can't drift off-map (the original's units stay within the map).
  private goScenic(m: Movement, rng: Rng): void {
    const g = game.grid;
    const maxX = g ? g.cols * g.tilePx : Infinity, maxY = g ? g.rows * g.tilePx : Infinity;
    this.waypointX = clampRange(m.x + (rng.next() * 2 - 1) * PATH_DIST, 8, maxX - 8);
    this.waypointY = clampRange(m.y + (rng.next() * 2 - 1) * PATH_DIST, 8, maxY - 8);
    this.mode = "scenic";
    this.stallCtr = 0;
  }

  private steerTo(m: Movement, tx: number, ty: number): void {
    const dx = tx - m.x, dy = ty - m.y;
    const d = Math.hypot(dx, dy) || 1;
    m.intentX = dx / d; m.intentY = dy / d;
  }

  // updateStallCount: stall = the rendered movement this tick was point(0,0) for STALL_TIME consecutive
  // frames (any movement resets). The port reads the actual position delta (Movement integrates next),
  // so we compare last-vs-current loc — |Δ| ≈ 0 means objMoveXY produced no moveVect.
  private updateStall(m: Movement): boolean {
    const moved = Number.isNaN(this.lastX) ? true
      : Math.abs(m.x - this.lastX) > 0.01 || Math.abs(m.y - this.lastY) > 0.01;
    this.lastX = m.x; this.lastY = m.y;
    if (moved) { this.stallCtr = 0; return false; }
    if (++this.stallCtr >= STALL_TIME) { this.stallCtr = 0; return true; }
    return false;
  }
}
