import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Freeze } from "@/components/freeze";
import { ColourTransform } from "@/components/colourTransform";

describe("freeze (modFreeze) — vector takeFreeze", () => {
  const arch = new Archetype("c", [Freeze], { defaults: { isFrozen: false, freezeFactor: 1 } });

  it("takeFreeze(vx,vy,_,mult) = (|vx|+|vy|)·mult·4 ticks; decays to defrost", () => {
    const e = arch.create(1).build();
    expect(e.send("isFrozen")).toBe(false);
    // (|2|+|0|)·1·4 = 8 ticks
    e.send("takeFreeze", 2, 0, -1, 1, false);
    expect(e.get(Freeze).ticks).toBe(8);
    expect(e.send("isFrozen")).toBe(true);
    for (let i = 0; i < 8; i++) e.send("update");
    expect(e.send("isFrozen")).toBe(false); // thawed at 0
    expect(e.get(Freeze).frozen).toBe(false);
  });

  it("freeze magnitude scales with freezeMultiplier (freezeBlast mult 3)", () => {
    const e = arch.create(2).build();
    // (|7|+|3|)·3·4 = 120
    e.send("takeFreeze", 7, 3, -1, 3, false);
    expect(e.get(Freeze).ticks).toBe(120);
  });

  it("ACCUMULATES across hits (not max) — repeated hits extend the thaw", () => {
    const e = arch.create(3).build();
    e.send("takeFreeze", 1, 0, -1, 1, false); // +4
    e.send("takeFreeze", 2, 0, -1, 1, false); // +8 -> 12 total (NOT max(4,8)=8)
    expect(e.get(Freeze).ticks).toBe(12);
  });

  it("the accumulated freeze is CAPPED at the original's tim[2]=1000 (no permanent freeze-lock)", () => {
    const e = arch.create(31).build();
    // a heavy hit alone exceeds the cap: (200+200)·5·4 = 8000 -> clamped to 1000.
    e.send("takeFreeze", 200, 200, -1, 5, false);
    expect(e.get(Freeze).ticks).toBe(1000);
    // further freeze-spam can't push it past the ceiling (modFreeze counter clamps to tim[2]).
    e.send("takeFreeze", 200, 200, -1, 5, false);
    expect(e.get(Freeze).ticks).toBe(1000);
  });

  it("first hit latches frozen + applies 0.5x speed factor + teal; later hits don't re-latch", () => {
    const e = arch.create(4).build();
    expect(e.send("freezeFactor")).toBe(1);
    e.send("takeFreeze", 5, 0, -1, 1, true);
    expect(e.get(Freeze).frozen).toBe(true);
    expect(e.get(Freeze).glowTeal).toBe(true);
    expect(e.send("freezeFactor")).toBe(0.5); // 0.5x movement while frozen
    e.send("takeFreeze", 5, 0, -1, 1, false); // accumulates, stays frozen
    expect(e.get(Freeze).frozen).toBe(true);
  });

  it("the teal glow is HELD for the freeze duration (re-armed on #colourTransformFin), not a 2-frame flash", () => {
    // glowTeal is non-pingpong (speed 100) so it finishes in ~1 tick; modFreeze re-arms it each time it
    // finishes. ColourTransform ordered BEFORE Freeze so its update() finish fans #colourTransformFin to Freeze.
    const arch2 = new Archetype("c2", [ColourTransform, Freeze], { defaults: { isFrozen: false, freezeFactor: 1 } });
    const e = arch2.create(5).build();
    e.send("takeFreeze", 30, 0, -1, 1, true);          // (30)·1·4 = 120 ticks of freeze, with glowTeal
    for (let i = 0; i < 20; i++) e.send("update");     // well past the ~2-tick glowTeal cycle
    const tint = e.send("getColourTransform") as { rgb: [number, number, number] } | null;
    expect(tint).not.toBeNull();                       // STILL glowing teal 20 ticks in (re-armed)
    expect(tint!.rgb[1]).toBeGreaterThan(150);         // teal = high green
    expect(tint!.rgb[2]).toBeGreaterThan(150);         // teal = high blue
    expect(tint!.rgb[0]).toBeLessThan(120);            // low red
    for (let i = 0; i < 110; i++) e.send("update");    // thaw out fully
    expect(e.send("isFrozen")).toBe(false);
    expect(e.send("getColourTransform")).toBeNull();   // defrost -> stopGlowTeal, no tint
  });
});
