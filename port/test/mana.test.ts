import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Mana } from "@/components/mana";

// modCharacterAttackProperties: the mana_* stats tune the charged spell (no pool). capacity is the
// charge ceiling, flow the rate, burst the start bonus, regeneration the cooldown divisor.
describe("mana charge stats (act_player mana_*)", () => {
  const arch = new Archetype("c", [Mana]);

  it("reads the four charge tuners from config (no pool/current)", () => {
    const e = arch.create(1).build({ mana_capacity: 12, mana_flow: 2, mana_burst: 3, mana_regeneration: 1.5 });
    const m = e.get(Mana);
    expect([m.capacity, m.flow, m.burst, m.regeneration]).toEqual([12, 2, 3, 1.5]);
    expect("current" in m).toBe(false); // the depleting pool is gone
  });

  it("potions raise each stat by its real increment", () => {
    const e = arch.create(2).build({ mana_capacity: 10, mana_flow: 1, mana_burst: 1 });
    const m = e.get(Mana);
    m.incCapacity(); m.incFlow(); m.incBurst();
    expect(m.capacity).toBeCloseTo(10.75);
    expect(m.flow).toBeCloseTo(1.5);
    expect(m.burst).toBeCloseTo(1.75);
  });

  it("a level-up bumps exactly one random stat by its IncLevel", () => {
    const e = arch.create(3).build({
      mana_capacity: 10, mana_flow: 1, mana_burst: 1, mana_regeneration: 1,
      mana_capacityIncLevel: 0.5, mana_flowIncLevel: 0.1, mana_burstIncLevel: 0.1, mana_regenerationIncLevel: 0.1,
    });
    const m = e.get(Mana);
    const before = m.capacity + m.flow + m.burst + m.regeneration;
    e.send("levelUp");
    const after = m.capacity + m.flow + m.burst + m.regeneration;
    expect(after).toBeGreaterThan(before);       // one stat grew
    expect(after - before).toBeLessThanOrEqual(0.5 + 1e-9); // by at most the largest IncLevel
  });
});
