import { describe, it, expect } from "vitest";
import { Archetype } from "@/engine/dispatch";
import { Mana } from "@/components/mana";

describe("mana pool (act_player mana_*)", () => {
  const arch = new Archetype("c", [Mana]);
  it("starts full at capacity from config", () => {
    const e = arch.create(1).build({ mana_capacity: 10, mana_regeneration: 4 });
    expect(e.send("manaFrac")).toBe(1);
    expect(e.get(Mana).current).toBe(10);
  });
  it("spend draws down (min burst) and has() gates on it", () => {
    const e = arch.create(2).build({ mana_capacity: 10, mana_burst: 2 });
    const m = e.get(Mana);
    m.spend(1);            // below burst -> spends burst (2)
    expect(m.current).toBe(8);
    expect(m.has(2)).toBe(true);
    m.spend(8);
    expect(m.current).toBe(0);
    expect(m.has(1)).toBe(false);
  });
  it("regenerates one point every regenTicks", () => {
    const e = arch.create(3).build({ mana_capacity: 5, mana_regeneration: 3 });
    const m = e.get(Mana);
    m.spend(5);
    expect(m.current).toBe(0);
    e.send("update"); e.send("update"); expect(m.current).toBe(0); // 2 ticks
    e.send("update"); expect(m.current).toBe(1);                   // 3rd tick -> +1
  });
});
