import { readFileSync } from "fs";
import { parseMap } from "../src/world/map";
import { parseTileKey, tileSymbol } from "../src/data/tlk";
import assets from "../src/generated/assets.json";

for (const mp of ["/home/user/merlin-s-revenge/maps/works/mr4Demo.txt", "/home/user/merlin-s-revenge/maps/new/mr4Demo.txt"]) {
  const src = readFileSync(mp, "utf8");
  const map = parseMap(src, (s: string) => (assets as any).tilesets?.[s]?.tile);
  const objSym = map.layerDefs.find((d: any) => d.name === "#objects")?.tileSet ?? "";
  const kf = (assets as any).tilesets?.[objSym]?.keyFile;
  const key = parseTileKey(readFileSync("/home/user/merlin-s-revenge/port/public/assets/" + kf, "utf8"));
  const placed = new Map<string, number>();
  for (const room of map.rooms.values()) {
    const obj = room.layer("#objects"); if (!obj) continue;
    for (const row of obj.grid) for (const n of row) {
      if (n <= 0) continue;
      const s = tileSymbol(key, n);
      if (s === "#none") continue;
      placed.set(s, (placed.get(s) || 0) + 1);
    }
  }
  console.log(`\n=== ${mp}  (objSet ${objSym}, ${map.rooms.size} rooms) — ${placed.size} distinct ===`);
  console.log([...placed.entries()].sort((a,b)=>b[1]-a[1]).map(([s,c])=>`${s.slice(1)}:${c}`).join("  "));
}
