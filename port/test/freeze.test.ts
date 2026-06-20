import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Freeze } from "@/components/freeze";

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
});
