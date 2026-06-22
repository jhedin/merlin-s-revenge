// characterEnergyRollOverMaster (gCharacterEnergyRolloverOn=1): hovering the mouse over a character shows
// its energy bar + level (stars) + experience, floating at the unit (objMoveableEnergyBar/LevelBar/
// ExperienceBar). Merlin's Revenge has NO always-on bars (gEnemyEnergyMasterOn=0) — this is the only
// per-unit health UI. The original finds the closest char to the mouse via teamMaster then mouse-inside-rect;
// here we pick the nearest character whose body box contains the cursor.

import type { Entity } from "../engine/dispatch";
import type { Renderer } from "./renderer";
import type { Assets } from "./assets";
import { Energy } from "../components/combat";
import { Experience } from "../components/experience";
import { healthBarColour } from "./healthBar";

const HOVER_TYPES = new Set(["enemy", "ally", "player", "dwelling"]);

// objMoveableLevelBar.calcNumbersOfStars: level in base-5/10 stars — large(×10), medium(×5), tiny(×1),
// drawn large→medium→tiny (pSizes) left-to-right. Returns the member names in draw order.
function starRow(level: number): string[] {
  const large = Math.floor(level / 10), rem = level % 10, medium = Math.floor(rem / 5), tiny = rem % 5;
  return [...Array(large).fill("star_large"), ...Array(medium).fill("star_medium"), ...Array(tiny).fill("star_tiny")];
}

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

export function drawHealthRollover(renderer: Renderer, cur: { x: number; y: number } | null, entities: Entity[], assets?: Assets): void {
  const best = pickHoveredUnit(cur, entities);
  if (!best) return;
  const p = best.send("getPos") as { x: number; y: number };
  const ctx = renderer.ctx;
  const bx = Math.round(p.x - 12), by = Math.round(p.y - 36);
  const frac = best.get(Energy).energyFrac();
  const lvl = (best.send("getLevel") as number) || 0;
  // resolve the real level stars (objMoveableLevelBar) so the bg box can wrap them; fall back to pips.
  const stars = assets ? starRow(lvl).map((n) => assets.member(n)).filter((m): m is NonNullable<typeof m> => !!m) : [];
  const starW = stars.reduce((s, m) => s + m.w, 0), starH = stars.reduce((h, m) => Math.max(h, m.h), 0);
  const boxH = 8 + (stars.length ? starH + 1 : 4);
  ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(bx - 1, by - 1, 26, boxH);
  ctx.fillStyle = healthBarColour(frac); ctx.fillRect(bx, by, Math.round(24 * frac), 3);  // energy (multicolour)
  if (stars.length) {                                                                      // level: real star row, centred
    let sx = bx + Math.round((24 - starW) / 2), rowTop = by + 4;
    for (const m of stars) { ctx.drawImage(m.img, sx, rowTop + (starH - m.h)); sx += m.w; }
  } else {                                                                                 // fallback pips
    ctx.fillStyle = "#fc4";
    for (let i = 0; i < Math.min(lvl, 8); i++) ctx.fillRect(bx + i * 3, by + 4, 2, 2);
  }
  const xp = best.tryGet(Experience);                                                       // experience bar
  if (xp) { ctx.fillStyle = "#8cf"; ctx.fillRect(bx, by + boxH - 3, Math.round(24 * Math.min(1, xp.frac())), 2); }
}
