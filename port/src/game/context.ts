// Shared game context (the Lingo `g` globals): the collision grid, input, asset store, RNG,
// and the live entity list. Components read this for cross-cutting needs (target lookup, grid).

import type { CollisionGrid } from "../world/collision";
import type { Input } from "../systems/input";
import type { Assets } from "../render/assets";
import type { AudioSystem } from "../systems/audio";
import type { Entity } from "../engine/dispatch";
import { Rng } from "../engine/math";
import { TeamMaster } from "../systems/teams";
import { ArmyMaster } from "../systems/armyMaster";
import { PotionMaster } from "../systems/potionMaster";
import { MagicLimitMaster } from "../systems/magicLimit";

export interface GameContext {
  grid: CollisionGrid;
  input: Input;
  assets: Assets;
  audio?: AudioSystem;
  rng: Rng;
  tilePx: number;
  /** gGameSpeed (objAnimStrip.init: pDelay.inc = 1 * gGameSpeed): the per-tick frame-advance scale.
   *  Default 1 (anim cadence == 1 frame-tick per game tick). A single global, never per-entity. */
  gameSpeed: number;
  entities: Entity[];
  player: Entity | null;
  tick: number;
  /** teamMaster: data allegiance + unit-map broad-phase + findTarget/impactMeleeAttack (B1) */
  teamMaster: TeamMaster;
  /** armyMaster: the summoned-ally reserve bank (teleport-out on room-leave, re-field at saved level) (G2) */
  armyMaster: ArmyMaster;
  /** potionMaster: per-type "potions drunk" tally (G3b) */
  potionMaster: PotionMaster;
  /** magicLimit: the room-scoped magic charge-limiter (objMagicLimit regions dim limitMagic spells) (I1) */
  magicLimit: MagicLimitMaster;
  /** spawn an enemy by actor name (set in main; lets Dwelling produce units without an import cycle) */
  spawnEnemy?: (name: string, x: number, y: number, opts?: { animChar?: string; ranged?: boolean }) => Entity;
  /** spawn a unit routed by its real team (ally if friendly, else enemy) — used by dwellings */
  spawnUnit?: (name: string, x: number, y: number, opts?: { animChar?: string; ranged?: boolean }) => Entity;
  /** summon a friendly ally (set in main; used by player summon without an import cycle) */
  spawnAlly?: (name: string, x: number, y: number, animChar?: string) => Entity;
  /** spawn any tile/actor-type symbol -> Entity (set in main; K8a builder constructs dwellings/towers) */
  spawnFromSymbol?: (sym: string, x: number, y: number) => Entity | null;
  /** K12: the scene FSM cutscene trigger. A Chatter stone, on player overlap, plays its #scriptToPerform
   *  via playInGameCutScene. Minimal surface (just the trigger + the in-game-cutscene gate) — avoids an
   *  import cycle with sceneManager. */
  scene?: { playInGameCutScene(name: string): void; isInGameCutscene(): boolean };
}

export const game: GameContext = {
  grid: null as unknown as CollisionGrid,
  input: null as unknown as Input,
  assets: null as unknown as Assets,
  rng: new Rng(12345),
  tilePx: 32,
  gameSpeed: 1,
  entities: [],
  player: null,
  tick: 0,
  teamMaster: new TeamMaster(),
  armyMaster: new ArmyMaster(),
  potionMaster: new PotionMaster(),
  magicLimit: new MagicLimitMaster(),
};

export function initContext(c: Partial<GameContext>): void { Object.assign(game, c); }
