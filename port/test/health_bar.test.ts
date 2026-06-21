// objMulticolourEnergyBar: the player HUD health bar colour slides red(0%) -> yellow(50%) -> green(100%),
// interpolating within each half. Guards against the old binary #3c9/#e44-at-30% threshold regression.
import { describe, it, expect } from "vitest";
import { healthBarColour } from "@/render/healthBar";

const rgb = (s: string) => s.match(/\d+/g)!.map(Number);

describe("player health bar colour (objMulticolourEnergyBar)", () => {
  it("anchors at the three colour stops: red(0%), yellow(50%), green(100%)", () => {
    expect(rgb(healthBarColour(0))).toEqual([255, 0, 0]);     // empty -> red
    expect(rgb(healthBarColour(0.5))).toEqual([255, 255, 0]); // half  -> yellow
    expect(rgb(healthBarColour(1))).toEqual([0, 200, 0]);     // full  -> green
  });
  it("interpolates within the red->yellow half (green channel rises, red stays max)", () => {
    const [r, g, b] = rgb(healthBarColour(0.25)); // quarter -> orange
    expect(r).toBe(255);
    expect(g).toBeGreaterThan(0); expect(g).toBeLessThan(255);
    expect(b).toBe(0);
  });
  it("interpolates within the yellow->green half (red channel falls)", () => {
    const [r, g, b] = rgb(healthBarColour(0.75)); // three-quarters -> yellow-green
    expect(r).toBeGreaterThan(0); expect(r).toBeLessThan(255);
    expect(g).toBeGreaterThan(180);
    expect(b).toBe(0);
  });
  it("is NOT the old binary threshold: 30% health is orange-ish, not solid green or red", () => {
    const [r, g, b] = rgb(healthBarColour(0.3));
    expect(r).toBe(255);                 // still in the red->yellow band
    expect(g).toBeGreaterThan(0);        // not pure red
    expect([r, g, b]).not.toEqual([0, 200, 0]); // and definitely not the old "green above 30%"
  });
  it("clamps out-of-range fractions", () => {
    expect(rgb(healthBarColour(-0.5))).toEqual([255, 0, 0]);
    expect(rgb(healthBarColour(2))).toEqual([0, 200, 0]);
  });
});
