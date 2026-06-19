import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Freeze } from "@/components/freeze";

describe("freeze (modFreeze)", () => {
  const arch = new Archetype("c", [Freeze], { defaults: { isFrozen: false } });
  it("takeFreeze sets a timer that decays and reports isFrozen", () => {
    const e = arch.create(1).build();
    expect(e.send("isFrozen")).toBe(false);
    e.send("takeFreeze", 3);
    expect(e.send("isFrozen")).toBe(true);
    e.send("update"); e.send("update");
    expect(e.send("isFrozen")).toBe(true); // ticks: 3 -> 1
    e.send("update");
    expect(e.send("isFrozen")).toBe(false); // ticks: 0
  });
  it("keeps the longer of overlapping durations", () => {
    const e = arch.create(2).build();
    e.send("takeFreeze", 2); e.send("takeFreeze", 10);
    expect(e.get(Freeze).ticks).toBe(10);
  });
});
