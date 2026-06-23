// Placement parity (AUDIT-CHARTER §6): assert HUD elements land at the cast's coordinates/spacing, not
// "looks right". The medikit display is a horizontal composite [icon][bar][counter] — the port previously
// drew an overlapping row of icons (16px icons at a 10px step). objMedikitDisplayer.txt is the spec.
import { describe, it, expect } from "vitest";
import { medikitLayout } from "@/render/hudLayout";

describe("medikit display placement (objMedikitDisplayer composite)", () => {
  it("lays out [icon][1px][6px bar][1px][counter+3y] from the cast arithmetic", () => {
    // displayLoc (8,30), 16×16 on-member, cast constants pSpacer=1, pEnergyBarWidth=6, vSpacer=3.
    const L = medikitLayout(8, 30);
    expect(L.icon).toEqual({ x: 8, y: 30 });
    // ebRect.left = displayLoc.h + onMember.width(16) + pSpacer(1) = 25; width 6; height = icon height 16.
    expect(L.bar).toEqual({ x: 25, y: 30, w: 6, h: 16 });
    // counter.h = ebRect.right(31) + pSpacer(1) = 32; counter.v = displayLoc.v + vSpacer(3) = 33.
    expect(L.counter).toEqual({ x: 32, y: 33 });
  });

  it("the elements never overlap (the old 10px-step bug drew 16px icons 6px into each other)", () => {
    const L = medikitLayout(8, 30, 16, 16);
    expect(L.bar.x).toBeGreaterThanOrEqual(L.icon.x + 16);      // bar starts past the icon
    expect(L.counter.x).toBeGreaterThanOrEqual(L.bar.x + L.bar.w); // counter starts past the bar
  });

  it("scales the bar/counter to the actual icon width (not a hardcoded step)", () => {
    const L = medikitLayout(0, 0, 20, 18); // a hypothetical 20×18 icon
    expect(L.bar).toEqual({ x: 21, y: 0, w: 6, h: 18 });        // 0 + 20 + 1
    expect(L.counter.x).toBe(28);                               // 21 + 6 + 1
  });
});
