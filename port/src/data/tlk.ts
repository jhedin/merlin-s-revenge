// Parser for tlk_*_key tile keys (objTileSetKey.interpretDefinition). Format:
//   [#name:..,#type:#field]      <- header (line 1)
//   tileSize | point(32,32)      <- pipe-delimited directive
//   -- comment / blank           <- skipped (do NOT advance tile index)
//   #symbol                      <- one tile symbol per line, 1-based
// getTileSymbolByNum: tile 0 -> #none, else key[tileNum] (1-based, comments excluded).

export interface TileKey {
  tileSize: { w: number; h: number };
  symbols: string[]; // 1-based: symbols[n-1] is tile n
}

export function parseTileKey(src: string): TileKey {
  const lines = src.split(/\r?\n/);
  let tileSize = { w: 32, h: 32 };
  const symbols: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (raw === "" || raw.startsWith("--")) continue;
    if (i === 0 && raw.startsWith("[")) continue; // header proplist
    if (raw.includes("|")) {
      const m = /tileSize\s*\|\s*point\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(raw);
      if (m) tileSize = { w: Number(m[1]), h: Number(m[2]) };
      continue;
    }
    const first = raw.split(/\s+/)[0]!;
    if (first.startsWith("#")) symbols.push(first);
  }
  return { tileSize, symbols };
}

/** tile number -> symbol (objTileSetKey.getTileSymbolByNum). */
export function tileSymbol(key: TileKey, tileNum: number): string {
  if (tileNum <= 0) return "#none";
  return key.symbols[tileNum - 1] ?? "#none";
}

/** tile numbers whose symbol is #solid (for active-layer collision). */
export function solidTileNums(key: TileKey): Set<number> {
  const s = new Set<number>();
  key.symbols.forEach((sym, idx) => { if (sym === "#solid") s.add(idx + 1); });
  return s;
}
