// Core math: a Lingo-style integer-ish Point, allocation-conscious vector ops, and a
// deterministic PRNG. The movement hot path must avoid per-frame allocation (see
// PORTING_PLAN §2.5), so the primary vector type is a mutable struct with in-place ops;
// pure helpers exist for cold code.

export interface Vec2 { x: number; y: number; }

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const setv = (o: Vec2, x: number, y: number): Vec2 => { o.x = x; o.y = y; return o; };
export const copyv = (o: Vec2, a: Vec2): Vec2 => { o.x = a.x; o.y = a.y; return o; };
export const clonev = (a: Vec2): Vec2 => ({ x: a.x, y: a.y });

// In-place arithmetic (no allocation) — for hot paths.
export const addInto = (o: Vec2, a: Vec2, b: Vec2): Vec2 => { o.x = a.x + b.x; o.y = a.y + b.y; return o; };
export const subInto = (o: Vec2, a: Vec2, b: Vec2): Vec2 => { o.x = a.x - b.x; o.y = a.y - b.y; return o; };
export const scaleInto = (o: Vec2, a: Vec2, s: number): Vec2 => { o.x = a.x * s; o.y = a.y * s; return o; };

export const eqv = (a: Vec2, b: Vec2): boolean => a.x === b.x && a.y === b.y;

// Lingo `point` distance is Manhattan in several engine paths (AddDist); Euclidean elsewhere.
export const manhattan = (a: Vec2, b: Vec2): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const dist2 = (a: Vec2, b: Vec2): number => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));

export interface Rect { left: number; top: number; right: number; bottom: number; }
export const rect = (left = 0, top = 0, right = 0, bottom = 0): Rect => ({ left, top, right, bottom });
export const rectW = (r: Rect): number => r.right - r.left;
export const rectH = (r: Rect): number => r.bottom - r.top;
export const pointInRect = (p: Vec2, r: Rect): boolean =>
  p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom;
export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export const clamp = (v: number, lo: number, hi: number): number => v < lo ? lo : v > hi ? hi : v;

// Deterministic PRNG (mulberry32). NOTE: this does NOT reproduce Lingo's random();
// it only gives the port internal determinism for save/replay and regression tests
// (see PLAN_REVIEW §4). Lingo random(n) returns 1..n inclusive — mirror that range here.
export class Rng {
  private s: number;
  constructor(seed = 0x9e3779b9) { this.s = seed >>> 0; }
  /** float in [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Lingo random(n): integer 1..n inclusive */
  int(n: number): number { return 1 + Math.floor(this.next() * n); }
  /** integer in [lo, hi] inclusive */
  range(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
  seed(s: number): void { this.s = s >>> 0; }
  state(): number { return this.s; }
}
