// objMulticolourEnergyBar — the player's own HUD health bar colour model.
//
// The whole bar is ONE colour that slides along a red(0%) -> yellow(50%) -> green(100%) range as energy
// changes, interpolating linearly within each half (objMulticolourEnergyBar.updateEnergy + VarColRange).
// The original colour stops are rgb(255,0,0), rgb(255,255,0), rgb(0,200,0) at 0% / 50% / 100%.
// (The port previously used a binary #3c9/#e44 threshold at 30% — no yellow band, wrong cut point.)

const HEALTH_STOPS: readonly [number, number, number][] = [[255, 0, 0], [255, 255, 0], [0, 200, 0]];

export function healthBarColour(frac: number): string {
  const pct = Math.max(0, Math.min(100, frac * 100));
  const RANGE = 100 / (HEALTH_STOPS.length - 1); // pRangePercent = 50
  // colRange == last range exactly at 100% -> the final stop, no interpolation (objMulticolourEnergyBar:40).
  if (pct >= 100) { const c = HEALTH_STOPS[HEALTH_STOPS.length - 1]!; return `rgb(${c[0]},${c[1]},${c[2]})`; }
  const idx = Math.floor(pct / RANGE);                 // 0 (red->yellow) or 1 (yellow->green)
  const t = ((Math.floor(pct) % RANGE) * 2) / 100;     // colPercent/100: 0..~0.98 within the band
  const a = HEALTH_STOPS[idx]!, b = HEALTH_STOPS[idx + 1]!;
  const mix = (i: 0 | 1 | 2) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}
