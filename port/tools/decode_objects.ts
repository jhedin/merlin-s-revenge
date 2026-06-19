import { readFileSync } from "fs";
import { parseMap } from "@/world/map";
import { parseTileKey, tileSymbol } from "@/data/tlk";
const map = parseMap(readFileSync("public/assets/map.txt", "utf8"));
const objKey = parseTileKey(readFileSync("public/assets/objects_key.txt", "utf8"));
const tally: Record<string, Record<number, number>> = {};
for (const [num, room] of map.rooms) {
  const layer = room.layers.find((l) => l.name === "#objects");
  if (!layer) continue;
  for (const row of layer.grid) for (const n of row) {
    if (n <= 0) continue;
    const sym = tileSymbol(objKey, n);
    (tally[sym] ??= {})[num] = ((tally[sym] ??= {})[num] ?? 0) + 1;
  }
}
for (const [sym, rooms] of Object.entries(tally).sort()) {
  const total = Object.values(rooms).reduce((a, b) => a + b, 0);
  console.log(`${String(total).padStart(3)}  ${sym.padEnd(22)} rooms: ${Object.keys(rooms).join(",")}`);
}
