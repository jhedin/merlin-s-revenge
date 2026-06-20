// Shared game context (the Lingo `g` globals): the collision grid, input, asset store, RNG,
// and the live entity list. Components read this for cross-cutting needs (target lookup, grid).

import type { CollisionGrid } from "../world/collision";
import type { Input } from "../systems/input";
import type { Assets } from "../render/assets";
import type { AudioSystem } from "../systems/audio";
import type { Entity } from "../engine/dispatch";
import { Rng } from "../engine/math";
import { TeamMaster } from "../systems/teams";

export interface GameContext {
  grid: CollisionGrid;
  input: Input;
  assets: Assets;
  audio?: AudioSystem;
  rng: Rng;
  tilePx: number;
  entities: Entity[];
  player: Entity | null;
  tick: number;
  /** teamMaster: data allegiance + unit-map broad-phase + findTarget/impactMeleeAttack (B1) */
  teamMaster: TeamMaster;
  /** spawn an enemy by actor name (set in main; lets Dwelling produce units without an import cycle) */
  spawnEnemy?: (name: string, x: number, y: number, opts?: { animChar?: string; ranged?: boolean }) => Entity;
  /** spawn a unit routed by its real team (ally if friendly, else enemy) — used by dwellings */
  spawnUnit?: (name: string, x: number, y: number, opts?: { animChar?: string; ranged?: boolean }) => Entity;
  /** summon a friendly ally (set in main; used by player summon without an import cycle) */
  spawnAlly?: (name: string, x: number, y: number, animChar?: string) => Entity;
}

export const game: GameContext = {
  grid: null as unknown as CollisionGrid,
  input: null as unknown as Input,
  assets: null as unknown as Assets,
  rng: new Rng(12345),
  tilePx: 32,
  entities: [],
  player: null,
  tick: 0,
  teamMaster: new TeamMaster(),
};

export function initContext(c: Partial<GameContext>): void { Object.assign(game, c); }
