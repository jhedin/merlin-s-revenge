// Team-colour energy UI: the rollover + the always-on enemy bars fill in the unit's TEAM colour
// (objMoveableEnergyBar / enemyEnergyMaster), shown only once a unit is DAMAGED.
import { describe, it, expect, beforeEach } from "vitest";
import { teamColour, clearTeamColourCache } from "@/render/teamColour";
import { drawEnemyEnergyBars } from "@/render/rollover";
import { drawMinimap, type MinimapInputs } from "@/render/minimap";
import { spawnEnemy, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

describe("teamColour (tem_<team> #colour)", () => {
  beforeEach(clearTeamColourCache);
  it("resolves the shipped team colours from the data, with a fallback", () => {
    expect(teamColour("#goblins")).toEqual([0, 255, 0]);
    expect(teamColour("#orcs")).toEqual([0, 255, 0]);
    expect(teamColour("#aldevar")).toEqual([100, 100, 255]);
    expect(teamColour("#blackSorcerer")).toEqual([100, 100, 100]);
    expect(teamColour("#totallyUnknownTeam")).toEqual([200, 200, 200]); // default
  });
});

// a render context that records fillRect calls + the fillStyle in effect at each.
function recordingRenderer() {
  const rects: { x: number; y: number; w: number; h: number; style: string }[] = [];
  let style = "";
  const ctx = {
    get fillStyle() { return style; },
    set fillStyle(v: string) { style = v; },
    fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h, style }),
  };
  return { rects, renderer: { ctx } as any };
}

describe("drawEnemyEnergyBars (enemyEnergyMaster): team-colour, damaged-only", () => {
  beforeEach(() => {
    game.grid = new CollisionGrid(20, 20, 32);
    game.entities = [];
    game.teamMaster.reset(); game.teamMaster.unitMap.configure(32, 0, 0);
    game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
    clearTeamColourCache();
  });

  it("draws a team-colour bar over a DAMAGED enemy, nothing over a full-health one", () => {
    const hurt = spawnEnemy("goblinWarrior", 100, 100);
    const full = spawnEnemy("goblinWarrior", 200, 100);
    game.entities = [hurt, full];
    hurt.get(Energy).energy = Math.round(hurt.get(Energy).max * 0.4); // wound to 40%

    const { rects, renderer } = recordingRenderer();
    drawEnemyEnergyBars(renderer, game.entities);

    // exactly one unit drew (the damaged one): a dark surround + a team-colour fill = 2 rects.
    expect(rects.length).toBe(2);
    const fill = rects[1]!;
    expect(fill.style).toBe("rgb(0,255,0)");          // goblins team colour
    expect(fill.w).toBeGreaterThan(0); expect(fill.w).toBeLessThan(20); // partial width (40% HP)
  });

  it("draws nothing for a dead unit", () => {
    const dead = spawnEnemy("goblinWarrior", 100, 100); dead.get(Energy).dead = true;
    game.entities = [dead];
    const { rects, renderer } = recordingRenderer();
    drawEnemyEnergyBars(renderer, game.entities);
    expect(rects.length).toBe(0);
  });
});

describe("minimap: adaptive cell size + bottom-right anchor", () => {
  function mockAssets() { return { member: () => null } as any; }
  function inp(mapW: number, mapH: number): MinimapInputs {
    const rooms = new Map<number, any>();
    return {
      map: { mapSize: { x: mapW, y: mapH }, roomAt: () => ({ num: 1, miniMapStatus: "#clr" }), rooms } as any,
      loc: { x: 1, y: 1 }, cleared: new Set(), infested: new Set(),
      playerPx: { x: 0, y: 0 }, cursorPx: null,
    };
  }
  it("uses LARGE cells for a small map and SMALL cells for a big one (bottom-right)", () => {
    const small = recordingRenderer();
    drawMinimap(small.renderer, inp(3, 3), 640, 360, mockAssets());
    const big = recordingRenderer();
    drawMinimap(big.renderer, inp(15, 15), 640, 360, mockAssets());
    // the per-room cell (the solid fallback square) is bigger for the 3×3 map than the 15×15 one.
    const cellOf = (rects: { w: number }[]) => Math.max(...rects.filter((r) => r.w <= 8).map((r) => r.w));
    expect(cellOf(small.rects)).toBeGreaterThan(cellOf(big.rects));
    // anchored toward the BOTTOM of the 360px-tall view (y well below the top).
    const maxY = Math.max(...big.rects.map((r) => r.y));
    expect(maxY).toBeGreaterThan(180);
  });
});
