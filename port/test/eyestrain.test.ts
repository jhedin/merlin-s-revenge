// objAiAttack.modifyLocWithEyestrain: a ranged/magic CPU shot is scattered by ±eyestrain px per axis,
// scaled by dist/reach (0 at point-blank, full at max range) — the mechanic that lets the player dodge
// ranged fire at distance. The TS port previously fired with perfect accuracy.
import { describe, it, expect } from "vitest";
import { aimWithEyestrain, Rng } from "@/engine/math";

describe("eyestrain aim scatter (objAiAttack.modifyLocWithEyestrain)", () => {
  it("zero eyestrain leaves the aim perfect", () => {
    const rng = new Rng(1);
    expect(aimWithEyestrain(100, 0, 0, 150, rng)).toEqual({ dx: 100, dy: 0 });
  });

  it("at point-blank (dist ~ 0) there is no scatter even with high eyestrain", () => {
    const rng = new Rng(1);
    expect(aimWithEyestrain(0, 0, 70, 150, rng)).toEqual({ dx: 0, dy: 0 });
  });

  it("at max range the scatter spans up to ±eyestrain px on each axis", () => {
    const rng = new Rng(12345);
    let maxAbs = 0;
    for (let i = 0; i < 500; i++) {
      const a = aimWithEyestrain(150, 0, 70, 150, rng); // dist == reach -> full eyestrain (70)
      maxAbs = Math.max(maxAbs, Math.abs(a.dy));         // dy scatter (perpendicular to the 150,0 aim)
    }
    expect(maxAbs).toBeGreaterThan(40);                  // meaningful scatter at distance
    expect(maxAbs).toBeLessThanOrEqual(70);              // bounded by eyestrain
  });

  it("scatter GROWS with distance (half range scatters less than full range)", () => {
    const spread = (dist: number): number => {
      const rng = new Rng(999);
      let max = 0;
      for (let i = 0; i < 500; i++) max = Math.max(max, Math.abs(aimWithEyestrain(dist, 0, 70, 150, rng).dy));
      return max;
    };
    expect(spread(75)).toBeLessThan(spread(150)); // half range -> ~half the scatter ceiling
  });
});
