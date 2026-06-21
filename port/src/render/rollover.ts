// characterEnergyRollOverMaster (gCharacterEnergyRolloverOn=1): hovering the mouse over a character shows
// its energy bar + level (stars) + experience, floating at the unit (objMoveableEnergyBar/LevelBar/
// ExperienceBar). Merlin's Revenge has NO always-on bars (gEnemyEnergyMasterOn=0) — this is the only
// per-unit health UI. The original finds the closest char to the mouse via teamMaster then mouse-inside-rect;
// here we pick the nearest character whose body box contains the cursor.

import type { Entity } from "../engine/dispatch";
import type { Renderer } from "./renderer";
import { Energy } from "../components/combat";
import { Experience } from "../components/experience";
import { healthBarColour } from "./healthBar";

const HOVER_TYPES = new Set(["enemy", "ally", "player", "dwelling"]);

/** the live character under the cursor (closest to the body centre), or null. Pure — unit-testable. */
export function pickHoveredUnit(cur: { x: number; y: number } | null, entities: Entity[]): Entity | null {
  if (!cur) return null;
  let best: Entity | null = null, bd = Infinity;
  for (const e of entities) {
    if (!HOVER_TYPES.has(e.type) || e.send("isDead")) continue;
    const p = e.send("getPos") as { x: number; y: number };
    if (Math.abs(cur.x - p.x) > 16 || cur.y < p.y - 30 || cur.y > p.y + 4) continue; // body box
    const d = (p.x - cur.x) ** 2 + (p.y - 12 - cur.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function drawHealthRollover(renderer: Renderer, cur: { x: number; y: number } | null, entities: Entity[]): void {
  const best = pickHoveredUnit(cur, entities);
  if (!best) return;
  const p = best.send("getPos") as { x: number; y: number };
  const ctx = renderer.ctx;
  const bx = Math.round(p.x - 12), by = Math.round(p.y - 36);
  const frac = best.get(Energy).energyFrac();
  ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(bx - 1, by - 1, 26, 12);
  ctx.fillStyle = healthBarColour(frac); ctx.fillRect(bx, by, Math.round(24 * frac), 3);  // energy (multicolour)
  const lvl = (best.send("getLevel") as number) || 0;                                      // level in star pips
  ctx.fillStyle = "#fc4";
  for (let i = 0; i < Math.min(lvl, 8); i++) ctx.fillRect(bx + i * 3, by + 4, 2, 2);
  const xp = best.tryGet(Experience);                                                       // experience bar
  if (xp) { ctx.fillStyle = "#8cf"; ctx.fillRect(bx, by + 8, Math.round(24 * Math.min(1, xp.frac())), 2); }
}
