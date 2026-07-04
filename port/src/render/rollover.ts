// characterEnergyRollOverMaster (gCharacterEnergyRolloverOn=1): hovering the mouse over a character shows
// its energy bar + level (stars) + experience, floating at the unit (objMoveableEnergyBar/LevelBar/
// ExperienceBar). Merlin's Revenge has NO always-on bars (gEnemyEnergyMasterOn=0) — this is the only
// per-unit health UI.
//
// Targeting is a STICKY single-slot FSM (characterEnergyRollOverMaster.update), not a per-frame "who's
// under the cursor right now" query:
//   closestChar = teamMaster.findTarget(me)          -- nearest LIVE hoverable char to the CURSOR, unrestricted
//   if closestChar = #none then  clearTarget          -- only clears when NO hoverable char exists anywhere
//   else if mouse INSIDE closestChar's sprite rect then setTarget(closestChar)   -- (re)lock on
//   -- else: do nothing -- the CURRENT target is left alone even though the mouse has moved off it
// So once you've hovered a unit, its bars keep following it and stay visible as you move the mouse away,
// until either you hover directly over a *different* valid unit, or your current target dies, or every
// hoverable character is gone. `pickHoveredUnit` below is the same one-shot lock rule with no memory
// (useful standalone / for tests); `HealthRollover` is the stateful per-game singleton that adds the
// stickiness and is what `main.ts` actually drives.
//
// Layout (objMoveableEnergyBar/LevelBar/ExperienceBar, all keyed off the STAND pose specifically —
// calcEnergyRectBottom/displayAboveTarget read strip #stand frame 1, not whatever's currently playing, so
// the UI doesn't jitter with the swing/attack pose):
//   - level stars float ABOVE the sprite, no background: bottom edge = spriteTop − 4px gap.
//   - energy bar sits directly BELOW the sprite, spanning its full width, height 4 (surroundHeight).
//   - experience bar sits 3px further below that (same width) — and is HIDDEN entirely when the unit has
//     0 accumulated XP (a fresh level-0 grunt), not drawn as an empty bar.
//   There is no shared black panel behind all three — each element is its own thin strip/plain image.

import type { Entity } from "../engine/dispatch";
import type { Renderer } from "./renderer";
import type { Assets } from "./assets";
import { Energy } from "../components/combat";
import { Experience } from "../components/experience";
import { Anim } from "../components/anim";
import { teamColourCss } from "./teamColour";

const HOVER_TYPES = new Set(["enemy", "ally", "player", "dwelling"]);

// objMoveableLevelBar.calcNumbersOfStars: level in base-5/10 stars — large(×10), medium(×5), tiny(×1),
// drawn large→medium→tiny (pSizes) left-to-right. Returns the member names in draw order.
export function starRow(level: number): string[] {
  const large = Math.floor(level / 10), rem = level % 10, medium = Math.floor(rem / 5), tiny = rem % 5;
  return [...Array(large).fill("star_large"), ...Array(medium).fill("star_medium"), ...Array(tiny).fill("star_tiny")];
}

function isHoverable(e: Entity): boolean { return HOVER_TYPES.has(e.type) && e.send("isDead") !== true; }

/** objObject.getSpriteRect hit-test: is `cur` inside `e`'s CURRENT (live-pose) sprite rect? Falls back to
 *  the old fixed body-box heuristic when the sprite strip isn't loaded (keeps hover usable pre-asset-load
 *  and in tests that stub out `game.assets`). */
function spriteContains(cur: { x: number; y: number }, e: Entity): boolean {
  const b = e.tryGet(Anim)?.getWorldBounds(false);
  if (b) return cur.x >= b.left && cur.x <= b.right && cur.y >= b.top && cur.y <= b.bottom;
  const p = e.send("getPos") as { x: number; y: number };
  return Math.abs(cur.x - p.x) <= 16 && cur.y >= p.y - 30 && cur.y <= p.y + 4;
}

/** teamMaster.findTarget(#closestDistance): the nearest live hoverable character to the cursor, full stop —
 *  no proximity/box gating (that only happens afterward, in the hit-test). */
function nearestToCursor(cur: { x: number; y: number }, entities: Entity[]): Entity | null {
  let best: Entity | null = null, bd = Infinity;
  for (const e of entities) {
    if (!isHoverable(e)) continue;
    const p = e.send("getPos") as { x: number; y: number };
    const d = (p.x - cur.x) ** 2 + (p.y - cur.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** One-shot (non-sticky) version of the original's lock rule: "the nearest char to the cursor, but only if
 *  the cursor is actually over it" — i.e. what a FRESH `HealthRollover` would pick on its very first call.
 *  Exported standalone for tests / simple callers; `HealthRollover` is what the game actually drives. */
export function pickHoveredUnit(cur: { x: number; y: number } | null, entities: Entity[]): Entity | null {
  if (!cur) return null;
  const nearest = nearestToCursor(cur, entities);
  return nearest && spriteContains(cur, nearest) ? nearest : null;
}

/** characterEnergyRollOverMaster: the stateful, sticky single-slot targeting + draw. One instance per game
 *  (matches the original's singleton `g.characterEnergyRollOverMaster`). */
export class HealthRollover {
  private target: Entity | null = null;

  /** characterEnergyRollOverMaster.update() targeting half: advances the sticky-lock FSM and returns the
   *  (possibly unchanged) current target, or null. Call once per tick before draw(). */
  update(cur: { x: number; y: number } | null, entities: Entity[]): Entity | null {
    // objMoveable*Bar.update(): a tracked target that has died (or left the world) clears itself.
    if (this.target && (this.target.send("isDead") === true || !entities.includes(this.target))) this.target = null;
    if (!cur) return this.target; // no cursor concept this tick: leave the sticky target as-is
    const nearest = nearestToCursor(cur, entities);
    if (!nearest) { this.target = null; return null; }              // obj = #none -> clearTarget (everyone)
    if (spriteContains(cur, nearest)) this.target = nearest;        // checkMouseOverObj -> (re)setTarget
    // else: sticky — mouse isn't over the nearest candidate, so the CURRENT target is left alone
    return this.target;
  }

  /** draw the locked target's bars/stars, if any. */
  draw(renderer: Renderer, assets?: Assets): void {
    const t = this.target;
    if (!t) return;
    drawUnitRollover(renderer, t, assets);
  }

  /** update() + draw() in one call, for callers that don't need the intermediate target. */
  tick(renderer: Renderer, cur: { x: number; y: number } | null, entities: Entity[], assets?: Assets): void {
    this.update(cur, entities);
    this.draw(renderer, assets);
  }
}

function drawUnitRollover(renderer: Renderer, best: Entity, assets?: Assets): void {
  const p = best.send("getPos") as { x: number; y: number };
  const anim = best.tryGet(Anim);
  // STAND-pose bounds position the UI (no jitter from the current attack/swing frame); fall back to a
  // synthetic box centred on the loc when the strip isn't loaded yet.
  const b = anim?.getWorldBounds(true) ?? { left: p.x - 13, top: p.y - 26, right: p.x + 13, bottom: p.y + 6 };
  const w = b.right - b.left;
  const ctx = renderer.ctx;
  const frac = best.get(Energy).energyFrac();
  const teamCss = teamColourCss(best.send("getTeam") as string);

  // energy bar: directly below the sprite, full sprite width, 4px tall (surroundHeight).
  const barY = Math.round(b.bottom);
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(Math.round(b.left), barY, Math.round(w), 4);
  ctx.fillStyle = teamCss; ctx.fillRect(Math.round(b.left) + 1, barY + 1, Math.max(0, Math.round((w - 2) * frac)), 2);

  // experience bar: 3px further below, same width — HIDDEN entirely (not just empty) when xp is 0.
  const xp = best.tryGet(Experience);
  if (xp && xp.xp > 0) {
    const xpY = barY + 3;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(Math.round(b.left), xpY, Math.round(w), 4);
    ctx.fillStyle = "#8cf"; ctx.fillRect(Math.round(b.left) + 1, xpY + 1, Math.max(0, Math.round((w - 2) * Math.min(1, xp.frac()))), 2);
  }

  // level stars: float ABOVE the sprite, no background, centred over it.
  const lvl = (best.send("getLevel") as number) || 0;
  const stars = assets ? starRow(lvl).map((n) => assets.member(n)).filter((m): m is NonNullable<typeof m> => !!m) : [];
  if (stars.length) {
    const starW = stars.reduce((s, m) => s + m.w, 0), starH = stars.reduce((h, m) => Math.max(h, m.h), 0);
    let sx = Math.round(b.left + (w - starW) / 2);
    const rowTop = Math.round(b.top) - 4 - starH;
    for (const m of stars) { ctx.drawImage(m.img, sx, rowTop + (starH - m.h)); sx += m.w; }
  }
}

// enemyEnergyMaster (an always-on floating bar over every damaged CPU unit, independent of the mouse) is
// REMOVED — it never runs in Merlin's Revenge. actorMaster.start() only calls
// `g.enemyEnergyMaster.start()` `if gEnemyEnergyMasterOn = true`, and this game's OWN init override
// (`MovieScript 1 - GameSpecific.ls` `on GameInitGlobals` — confirmed as this title's config by
// `gGameName = #merlin_3`, `gGameSaveFile = "mr4_saveGame_0_03.txt"`, `gKeySetFileName =
// "MerlinsRevengeKeys.txt"`) sets `gEnemyEnergyMasterOn = 0` (only `gCharacterEnergyRolloverOn = 1` is
// on). So `enemyEnergyMaster` never starts and `objCPUCharacter.initEnergyBar`'s
// `g.enemyEnergyMaster.requestEnergyBar(...)` call has no live master to talk to — no enemy ever shows a
// health bar without being hovered. A prior version of this file carried a `drawEnemyEnergyBars` that drew
// exactly such an always-on bar for every damaged enemy/ally, based on a comment asserting the opposite
// flag value ("gEnemyEnergyMasterOn=1, the shipped main.ls config") — self-contradicting the correct note
// two lines above it that this file's own header already carried. The on-hover `HealthRollover` above is
// the ONLY per-unit health UI the original ever shows.
