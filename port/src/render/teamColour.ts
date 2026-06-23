// teamMaster.getTeamColour (tem_<team> #colour): each team's display colour, used by the energy bars
// (objMoveableEnergyBar fills the bar with the target's TEAM colour — allegiance, not health). Values are
// the static #colour from casts/data/tem_*.txt; resolved from the bundled data with a hardcoded fallback so
// it works even if the data record is absent. Cached per bare team name.

import { registry } from "../game/data";

export type RGB = [number, number, number];

// the shipped tem_*.txt #colour values (static). A fallback for teams whose data record carries no #colour
// (chatters/collectables/game/healthRollover) and the unknown-team default.
const FALLBACK: Record<string, RGB> = {
  aldevar: [100, 100, 255], blackSorcerer: [100, 100, 100], cave: [34, 34, 34], fire: [100, 100, 255],
  ghosts: [200, 200, 200], goblins: [0, 255, 0], ice: [222, 222, 210], invisible: [100, 100, 100],
  karate: [240, 240, 240], magicalAlliance: [255, 255, 0], monsterSummon: [100, 100, 255],
  monsters: [196, 153, 102], ninja: [75, 75, 75], orcs: [0, 255, 0], pitMonsters: [115, 99, 67],
  scarlet: [100, 100, 100], swamp: [47, 77, 82], undead: [222, 222, 210], village: [100, 100, 255],
};
const DEFAULT: RGB = [200, 200, 200];
const cache = new Map<string, RGB>();

export function teamColour(team: string | undefined): RGB {
  const bare = (team ?? "").replace(/^#/, "");
  const hit = cache.get(bare);
  if (hit) return hit;
  let rgb: RGB | undefined;
  const rec = registry.resolveActor(`tem_${bare}`); // data.json carries tem_<team>.colour {r,g,b}
  const c = rec?.["colour"];
  if (c && typeof c === "object" && typeof (c as any).r === "number") rgb = [(c as any).r, (c as any).g, (c as any).b];
  if (!rgb) rgb = FALLBACK[bare];
  if (!rgb) rgb = DEFAULT;
  cache.set(bare, rgb);
  return rgb;
}

export function teamColourCss(team: string | undefined): string {
  const [r, g, b] = teamColour(team);
  return `rgb(${r},${g},${b})`;
}

/** test seam: drop the memo (team data reloaded). */
export function clearTeamColourCache(): void { cache.clear(); }
