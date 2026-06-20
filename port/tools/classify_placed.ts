import { readFileSync } from "fs";
import { parseMap } from "../src/world/map";
import { parseTileKey, tileSymbol } from "../src/data/tlk";
import { registry } from "../src/game/data";
import { PICKUPS, SKIP_SPAWN } from "../src/world/spawnTable";
import assets from "../src/generated/assets.json";

const src = readFileSync("/home/user/merlin-s-revenge/maps/works/mr4Demo.txt", "utf8");
const map = parseMap(src, (s: string) => (assets as any).tilesets?.[s]?.tile);
const objSym = map.layerDefs.find((d: any) => d.name === "#objects")?.tileSet ?? "";
const key = parseTileKey(readFileSync("/home/user/merlin-s-revenge/port/public/assets/" + (assets as any).tilesets[objSym].keyFile, "utf8"));
const placed = new Set<string>();
for (const room of map.rooms.values()) { const o = room.layer("#objects"); if (!o) continue;
  for (const row of o.grid) for (const n of row) if (n > 0) { const s = tileSymbol(key, n); if (s !== "#none") placed.add(s); } }

const buckets: Record<string, string[]> = { pickup: [], skipped: [], unit: [], dwelling: [], noRecord: [], otherObjType: [] };
for (const sym of placed) {
  const name = sym.slice(1);
  if (PICKUPS[sym]) { buckets.pickup.push(name); continue; }
  if (SKIP_SPAWN.has(sym)) { buckets.skipped.push(name); continue; }
  const d = registry.resolveActor(name);
  if (!d) { buckets.noRecord.push(name); continue; }
  const ot = (d as any).objType as string;
  if (ot === "#objCPUCharacter" || ot === "#objActorPlayer") buckets.unit.push(name);
  else if (ot === "#objDwelling") buckets.dwelling.push(name);
  else buckets.otherObjType.push(`${name}(${ot ?? "no-objType"})`);
}
for (const [k, v] of Object.entries(buckets)) console.log(`\n[${k}] (${v.length})\n  ${v.sort().join("  ")}`);
