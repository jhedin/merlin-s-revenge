// Pure cell-region helpers for the paint tools. Kept free of canvas/DOM so they're unit-testable; the
// EditorApp turns the returned cells into batched setTile edits.

export type Cell = [r: number, c: number];

/** 4-connected flood region: every cell reachable from (r0,c0) sharing its current index. */
export function floodRegion(grid: number[][], r0: number, c0: number): Cell[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (r0 < 0 || c0 < 0 || r0 >= rows || c0 >= cols) return [];
  const target = grid[r0]![c0]!;
  const out: Cell[] = [];
  const seen = new Set<number>();
  const stack: Cell[] = [[r0, c0]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
    const key = r * cols + c;
    if (seen.has(key)) continue;
    seen.add(key);
    if (grid[r]![c] !== target) continue;
    out.push([r, c]);
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return out;
}

/** Every cell in the inclusive rectangle between the two corners (order-independent). */
export function rectRegion(r0: number, c0: number, r1: number, c1: number): Cell[] {
  const out: Cell[] = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++)
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) out.push([r, c]);
  return out;
}
